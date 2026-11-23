import { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  fetchAdminDailyCheckins,
  triggerDailyCheckins,
  acknowledgeDailyCheckinAlert,
} from '../services/api';

const BC_ROAD = [12.8817, 75.0299];

const STATUS_THEME = {
  SAFE: {
    label: 'SAFE',
    color: '#10b981',
    badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    indicator: 'bg-emerald-400',
    icon: 'check_circle',
  },
  PENDING: {
    label: 'PENDING',
    color: '#f59e0b',
    badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    indicator: 'bg-amber-400',
    icon: 'hourglass_empty',
  },
  NO_RESPONSE: {
    label: 'NO RESPONSE',
    color: '#ef4444',
    badge: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
    indicator: 'bg-rose-500 animate-pulse',
    icon: 'error',
  },
  HELP_REQUESTED: {
    label: 'HELP REQUESTED',
    color: '#dc2626',
    badge: 'bg-red-600/20 text-red-400 border border-red-500/40 animate-pulse',
    indicator: 'bg-red-600 animate-ping',
    icon: 'emergency',
  },
};

function createMarkerIcon(status) {
  const theme = STATUS_THEME[status] || STATUS_THEME.PENDING;
  return L.divIcon({
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    html: `
      <div style="width:32px;height:32px;border-radius:50%;background:${theme.color};border:3px solid #0a1128;box-shadow:0 0 14px ${theme.color}90;display:flex;align-items:center;justify-content:center;">
        <span style="color:#fff;font-size:16px;font-family:'Material Symbols Outlined'">${theme.icon}</span>
      </div>
    `,
  });
}

function getInitialTodayDate() {
  return new Date().toISOString().split('T')[0];
}

export default function DailyCheckinMonitoring() {
  const [data, setData] = useState(() => ({
    kpis: {
      totalActiveTourists: 0,
      safeCount: 0,
      pendingCount: 0,
      noResponseCount: 0,
      helpRequestedCount: 0,
      unacknowledgedAlerts: 0,
    },
    checkins: [],
    filterDate: getInitialTodayDate(),
  }));

  const [loading, setLoading] = useState(true);
  const [selectedCheckin, setSelectedCheckin] = useState(null);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [triggering, setTriggering] = useState(false);
  const [customDeadline, setCustomDeadline] = useState(30);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});

  const showToast = (title, body, type = 'info') => {
    setToast({ title, body, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async (dateParam = data.filterDate) => {
    try {
      const res = await fetchAdminDailyCheckins(dateParam);
      if (res?.checkins) {
        setData(res);
      }
    } catch (err) {
      console.error('Error fetching admin daily checkins:', err);
    } finally {
      setLoading(false);
    }
  }, [data.filterDate]);

  // Leaflet map initialization
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: BC_ROAD,
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    // B.C. Road safety zone perimeter
    L.circle(BC_ROAD, {
      radius: 1200,
      color: '#06b6d4',
      fillColor: '#06b6d4',
      fillOpacity: 0.05,
      weight: 1.5,
      dashArray: '6 6',
    }).addTo(map).bindPopup('<b>B.C. Road Sector Monitoring Perimeter</b>');

    mapInstanceRef.current = map;

    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update map markers when checkins change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !data.checkins) return;

    // Clear previous markers
    Object.values(markersRef.current).forEach((m) => map.removeLayer(m));
    markersRef.current = {};

    data.checkins.forEach((chk) => {
      const lat = chk.latitude || BC_ROAD[0];
      const lng = chk.longitude || BC_ROAD[1];
      const theme = STATUS_THEME[chk.status] || STATUS_THEME.PENDING;

      const marker = L.marker([lat, lng], {
        icon: createMarkerIcon(chk.status),
      })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:sans-serif;min-width:180px;padding:3px">
            <strong style="font-size:13px;color:#0f172a">${chk.user_name}</strong><br/>
            <span style="font-size:11px;color:${theme.color};font-weight:bold">● ${theme.label}</span><br/>
            <small style="color:#64748b">📍 ${chk.location_name || 'B.C. Road Area'}</small><br/>
            <small style="color:#64748b">${chk.is_live_location ? '🟢 Live GPS' : '🟡 Last Known Location'}</small><br/>
            <small style="color:#475569">📞 ${chk.user_phone || 'N/A'}</small>
          </div>
        `);

      marker.on('click', () => setSelectedCheckin(chk));
      markersRef.current[chk.id] = marker;
    });
  }, [data.checkins]);

  // Initial load and auto-refresh every 10 seconds
  useEffect(() => {
    let isMounted = true;
    const sync = async () => {
      try {
        const res = await fetchAdminDailyCheckins(data.filterDate);
        if (isMounted && res?.checkins) {
          setData(res);
        }
      } catch (err) {
        console.error('Error fetching admin daily checkins:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    sync();
    const interval = setInterval(sync, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [data.filterDate]);

  const handleTriggerBroadcast = async () => {
    setTriggering(true);
    try {
      const res = await triggerDailyCheckins(customDeadline);
      showToast('Check-in Broadcast Sent', res.message || 'Notification transmitted to active tourists.', 'success');
      await loadData();
    } catch (err) {
      showToast('Broadcast Failed', err.message || 'Error triggering check-in', 'error');
    } finally {
      setTriggering(false);
    }
  };

  const handleAcknowledge = async (checkinId) => {
    try {
      await acknowledgeDailyCheckinAlert(checkinId);
      showToast('Alert Acknowledged', `Alert for ${checkinId} marked as reviewed.`, 'success');
      await loadData();
      if (selectedCheckin?.id === checkinId) {
        setSelectedCheckin((prev) => ({ ...prev, admin_acknowledged: 1 }));
      }
    } catch (err) {
      showToast('Error', err.message || 'Failed to acknowledge alert', 'error');
    }
  };

  const flyToTourist = (chk) => {
    setSelectedCheckin(chk);
    const lat = chk.latitude || BC_ROAD[0];
    const lng = chk.longitude || BC_ROAD[1];
    mapInstanceRef.current?.flyTo([lat, lng], 16, { duration: 0.8 });
    markersRef.current[chk.id]?.openPopup();
  };

  const filteredCheckins = (data.checkins || []).filter((c) => {
    if (filterStatus !== 'ALL' && c.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchName = c.user_name?.toLowerCase().includes(q);
      const matchEmail = c.user_email?.toLowerCase().includes(q);
      const matchPhone = c.user_phone?.includes(q);
      if (!matchName && !matchEmail && !matchPhone) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Header with Title & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold text-white tracking-tight">
            Daily Safety Check-in Monitoring
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Automated evening safety checks, non-response detection & emergency escalation
          </p>
        </div>

        {/* Broadcast Trigger & Settings */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-[#0a1128]/80 border border-white/[0.06] rounded-xl px-3 py-2 text-xs">
            <span className="text-slate-500">Date:</span>
            <input
              type="date"
              value={data.filterDate}
              onChange={(e) => {
                const newDate = e.target.value;
                setData((prev) => ({ ...prev, filterDate: newDate }));
                loadData(newDate);
              }}
              className="bg-transparent text-white font-medium border-none outline-none cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2 bg-[#0a1128]/80 border border-white/[0.06] rounded-xl px-3 py-2 text-xs">
            <span className="text-slate-500">Window:</span>
            <select
              value={customDeadline}
              onChange={(e) => setCustomDeadline(Number(e.target.value))}
              className="bg-transparent text-white font-medium border-none outline-none cursor-pointer"
            >
              <option value={15} className="bg-[#0a1128]">15 Mins</option>
              <option value={30} className="bg-[#0a1128]">30 Mins (Default)</option>
              <option value={60} className="bg-[#0a1128]">60 Mins</option>
            </select>
          </div>

          <button
            onClick={handleTriggerBroadcast}
            disabled={triggering}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white rounded-xl px-4 py-2 text-xs font-semibold shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            <span className={`material-symbols-outlined text-base ${triggering ? 'animate-spin' : ''}`}>
              send
            </span>
            <span>{triggering ? 'Broadcasting...' : 'Broadcast Check-in Now'}</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Active Tourists', value: data.kpis.totalActiveTourists, icon: 'groups', color: 'from-blue-500 to-cyan-500', text: 'text-cyan-400' },
          { label: 'Confirmed Safe', value: data.kpis.safeCount, icon: 'check_circle', color: 'from-emerald-500 to-green-500', text: 'text-emerald-400' },
          { label: 'Pending Response', value: data.kpis.pendingCount, icon: 'hourglass_top', color: 'from-amber-500 to-yellow-500', text: 'text-amber-400' },
          { label: 'No Response', value: data.kpis.noResponseCount, icon: 'error', color: 'from-rose-500 to-red-500', text: 'text-rose-400' },
          { label: 'Help Requests', value: data.kpis.helpRequestedCount, icon: 'emergency', color: 'from-red-600 to-rose-700', text: 'text-red-400' },
        ].map((k) => (
          <div key={k.label} className="bg-[#0a1128]/80 border border-white/[0.06] rounded-2xl p-4 flex items-center gap-3.5">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${k.color} flex items-center justify-center text-white shadow-lg shrink-0`}>
              <span className="material-symbols-outlined text-xl">{k.icon}</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-white leading-none">{k.value}</div>
              <div className="text-xs text-slate-500 mt-1">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Urgent Alert Banner if Unresponsive or Help Requested */}
      {(data.kpis.helpRequestedCount > 0 || data.kpis.noResponseCount > 0) && (
        <div className="bg-rose-950/40 border border-rose-500/40 rounded-2xl p-4 flex items-center justify-between text-xs animate-pulse">
          <div className="flex items-center gap-2.5 text-rose-400 font-bold">
            <span className="material-symbols-outlined text-2xl">warning</span>
            <span>
              URGENT ATTENTION: {data.kpis.helpRequestedCount} Tourist(s) Requested Help, {data.kpis.noResponseCount} Unresponsive beyond 30-min window.
            </span>
          </div>
          <button
            onClick={() => setFilterStatus('NO_RESPONSE')}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg transition-colors"
          >
            Review Urgent Alerts
          </button>
        </div>
      )}

      {/* 3. Main Grid: Map + Tourist Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" style={{ minHeight: 560 }}>
        {/* Interactive Map (7 Cols) */}
        <div className="lg:col-span-7 bg-[#0a1128]/80 border border-white/[0.06] rounded-2xl overflow-hidden flex flex-col relative">
          <div className="p-3.5 border-b border-white/[0.06] flex items-center justify-between text-xs bg-[#080e22]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-400 text-base">map</span>
              <span className="font-semibold text-white">Live Check-in Spatial Map</span>
            </div>
            <span className="text-[11px] text-slate-500">B.C. Road, Bantwal (12.8817°N, 75.0299°E)</span>
          </div>

          <div ref={mapRef} className="w-full flex-1" style={{ minHeight: 450 }} />

          {/* Map Legend */}
          <div className="absolute bottom-4 left-4 z-[1000] bg-[#0a1128]/90 backdrop-blur-xl border border-white/[0.08] rounded-xl p-3 space-y-1.5 text-[11px]">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Status Legend</span>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-slate-300">SAFE (Confirmed)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="text-slate-300">PENDING (&lt; 30 min)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-slate-300">NO RESPONSE (Overdue)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
              <span className="text-slate-300">HELP REQUESTED</span>
            </div>
          </div>
        </div>

        {/* Tourist Check-in List & Drawer (5 Cols) */}
        <div className="lg:col-span-5 bg-[#0a1128]/80 border border-white/[0.06] rounded-2xl flex flex-col overflow-hidden">
          {/* Search & Filter Pills */}
          <div className="p-3.5 border-b border-white/[0.06] space-y-2.5 bg-[#080e22]">
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-xs">
              <span className="material-symbols-outlined text-slate-500 text-base">search</span>
              <input
                type="text"
                placeholder="Search tourist by name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent border-none outline-none text-white text-xs w-full placeholder-slate-600"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {['ALL', 'PENDING', 'SAFE', 'NO_RESPONSE', 'HELP_REQUESTED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-colors ${
                    filterStatus === st
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-white/[0.04] text-slate-400 hover:text-white'
                  }`}
                >
                  {st === 'ALL' ? 'ALL' : STATUS_THEME[st]?.label || st}
                </button>
              ))}
            </div>
          </div>

          {/* Roster Cards */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5" style={{ maxHeight: 520 }}>
            {loading ? (
              <div className="p-8 text-center text-slate-500 text-xs">Loading check-in stream...</div>
            ) : filteredCheckins.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs space-y-1">
                <span className="material-symbols-outlined text-3xl">fact_check</span>
                <p>No check-in records found for this filter.</p>
              </div>
            ) : (
              filteredCheckins.map((chk) => {
                const theme = STATUS_THEME[chk.status] || STATUS_THEME.PENDING;
                const isSelected = selectedCheckin?.id === chk.id;

                return (
                  <div
                    key={chk.id}
                    onClick={() => flyToTourist(chk)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white/[0.08] border-cyan-500/50 shadow-md'
                        : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${theme.indicator}`} />
                          <h4 className="font-bold text-white text-[13px]">{chk.user_name}</h4>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{chk.user_phone || chk.user_email}</p>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${theme.badge}`}>
                        {theme.label}
                      </span>
                    </div>

                    {/* Location & GPS Flag */}
                    <div className="mt-2.5 pt-2 border-t border-white/[0.04] text-[11px] space-y-1 text-slate-400">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 truncate max-w-[200px]">
                          <span className="material-symbols-outlined text-xs text-slate-500">place</span>
                          {chk.location_name || 'B.C. Road Area'}
                        </span>
                        <span className={chk.is_live_location ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
                          {chk.is_live_location ? '🟢 Live GPS' : '🟡 Last Known'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>Check-in: {chk.notification_sent_at ? new Date(chk.notification_sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                        <span>{chk.response_at ? `Responded: ${new Date(chk.response_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `Deadline: ${new Date(chk.response_deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}</span>
                      </div>
                    </div>

                    {/* Action buttons on card */}
                    <div className="mt-2.5 pt-2 border-t border-white/[0.04] flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`tel:${chk.user_phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="px-2.5 py-1 bg-white/[0.05] hover:bg-white/[0.1] text-cyan-400 rounded-lg text-[11px] font-semibold flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-xs">call</span>
                          Call
                        </a>
                        <a
                          href={`sms:${chk.user_phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="px-2.5 py-1 bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 rounded-lg text-[11px] font-semibold flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-xs">chat</span>
                          SMS
                        </a>
                      </div>

                      {(chk.status === 'NO_RESPONSE' || chk.status === 'HELP_REQUESTED') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAcknowledge(chk.id);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                            chk.admin_acknowledged
                              ? 'bg-slate-800 text-slate-500 cursor-default'
                              : 'bg-rose-600 hover:bg-rose-500 text-white'
                          }`}
                        >
                          {chk.admin_acknowledged ? 'Reviewed ✓' : 'Acknowledge Alert'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 4. Selected Tourist Detailed Drawer */}
      {selectedCheckin && (
        <div className="bg-[#0a1128]/90 border border-white/[0.08] rounded-2xl p-5 shadow-2xl relative animate-fadeIn space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-lg border border-cyan-500/30">
                {selectedCheckin.user_name?.[0] || 'T'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">{selectedCheckin.user_name}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${STATUS_THEME[selectedCheckin.status]?.badge}`}>
                    {STATUS_THEME[selectedCheckin.status]?.label || selectedCheckin.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{selectedCheckin.user_email} • {selectedCheckin.user_phone}</p>
              </div>
            </div>

            <button
              onClick={() => setSelectedCheckin(null)}
              className="text-slate-500 hover:text-white p-1"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-white/[0.03] border border-white/[0.04] p-3 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Emergency Contact Info</span>
              <p className="font-semibold text-white">{selectedCheckin.emergency_contact_name || 'Not Provided'}</p>
              <p className="text-cyan-400">
                {selectedCheckin.emergency_contact_phone ? (
                  <a href={`tel:${selectedCheckin.emergency_contact_phone}`} className="underline font-bold">
                    📞 {selectedCheckin.emergency_contact_phone}
                  </a>
                ) : 'No phone saved'}
              </p>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.04] p-3 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Spatial Coordinates</span>
              <p className="font-semibold text-white">
                {selectedCheckin.latitude ? `${selectedCheckin.latitude.toFixed(4)}°N, ${selectedCheckin.longitude.toFixed(4)}°E` : 'B.C. Road Area'}
              </p>
              <p className={selectedCheckin.is_live_location ? 'text-emerald-400' : 'text-amber-400'}>
                {selectedCheckin.is_live_location ? 'Live GPS Location' : 'Last Known Location (GPS not live)'}
              </p>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.04] p-3 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Check-in Verification Timeline</span>
              <p className="text-slate-300">Sent: {new Date(selectedCheckin.notification_sent_at).toLocaleTimeString()}</p>
              <p className="text-slate-300">
                Deadline: {new Date(selectedCheckin.response_deadline).toLocaleTimeString()} ({selectedCheckin.response_at ? 'Responded' : 'Pending'})
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[10000] bg-[#0a1128] border border-white/[0.1] rounded-xl px-5 py-3 shadow-2xl flex items-center gap-3 animate-fadeIn">
          <span className={`material-symbols-outlined text-lg ${toast.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <div>
            <div className="text-xs font-bold text-white">{toast.title}</div>
            <div className="text-[11px] text-slate-400">{toast.body}</div>
          </div>
        </div>
      )}
    </div>
  );
}
