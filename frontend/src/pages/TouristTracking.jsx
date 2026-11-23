import { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchTouristLocations } from '../services/api';

const BC_ROAD = [12.8817, 75.0299];

const STATUS_CFG = {
  active:      { color: '#10b981', bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Active' },
  exploring:   { color: '#06b6d4', bg: 'bg-cyan-500/15', text: 'text-cyan-400', label: 'Exploring' },
  resting:     { color: '#8b5cf6', bg: 'bg-violet-500/15', text: 'text-violet-400', label: 'Resting' },
  'in-transit': { color: '#f59e0b', bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'In Transit' },
};

function markerIcon(status) {
  const c = STATUS_CFG[status]?.color || '#10b981';
  return L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="width:28px;height:28px;border-radius:50%;background:${c};border:3px solid #0a1128;box-shadow:0 0 12px ${c}80;display:flex;align-items:center;justify-content:center;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>
    </div>`,
  });
}

export default function TouristTracking() {
  const [tourists, setTourists] = useState([]);
  const [meta, setMeta] = useState({ totalTracked: 0, activeNow: 0, inSafeZone: 0 });
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});

  const loadData = useCallback(async () => {
    try {
      const data = await fetchTouristLocations();
      if (data && Array.isArray(data.tourists)) {
        setTourists(data.tourists);
        setMeta(data.meta || {});
      }
    } catch (err) {
      console.error('Failed to load tourist locations:', err);
    }
  }, []);

  // Init map
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

    // Safe zone circle
    L.circle(BC_ROAD, {
      radius: 1000,
      color: '#10b981',
      fillColor: '#10b981',
      fillOpacity: 0.06,
      weight: 1.5,
      dashArray: '8 6',
    }).addTo(map).bindPopup('<b>Safe Zone</b><br>B.C. Road, Bantwal');

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

  // Update markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || tourists.length === 0) return;

    // Clear old markers
    Object.values(markersRef.current).forEach(m => map.removeLayer(m));
    markersRef.current = {};

    tourists.forEach(t => {
      const marker = L.marker([t.lat, t.lng], { icon: markerIcon(t.status) })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:sans-serif;min-width:160px;">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${t.name}</div>
            <div style="color:#94a3b8;font-size:11px;margin-bottom:2px;">📍 ${t.nearestLandmark}</div>
            <div style="color:#94a3b8;font-size:11px;margin-bottom:2px;">📱 ${t.phone}</div>
            <div style="color:#94a3b8;font-size:11px;">🔋 ${t.batteryLevel}% · ${t.lastSeen}</div>
          </div>
        `);
      marker.on('click', () => setSelected(t));
      markersRef.current[t.id] = marker;
    });
  }, [tourists]);

  // Auto-refresh every 10s with mount protection
  useEffect(() => {
    let isMounted = true;
    const refresh = async () => {
      try {
        const data = await fetchTouristLocations();
        if (isMounted && data && Array.isArray(data.tourists)) {
          setTourists(data.tourists);
          setMeta(data.meta || {});
        }
      } catch (err) {
        console.error('Failed to load tourist locations:', err);
      }
    };
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const flyTo = (t) => {
    setSelected(t);
    mapInstanceRef.current?.flyTo([t.lat, t.lng], 16, { duration: 0.8 });
    markersRef.current[t.id]?.openPopup();
  };

  const filtered = tourists.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = [
    { label: 'Total Tracked', value: meta.totalTracked, icon: 'groups', gradient: 'from-blue-500 to-cyan-500' },
    { label: 'Active Now', value: meta.activeNow, icon: 'radio_button_checked', gradient: 'from-emerald-500 to-green-500' },
    { label: 'In Safe Zone', value: meta.inSafeZone, icon: 'verified_user', gradient: 'from-violet-500 to-purple-500' },
    { label: 'Outside Zone', value: (meta.totalTracked || 0) - (meta.inSafeZone || 0), icon: 'warning', gradient: 'from-amber-500 to-orange-500' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Tourist Live Tracking</h1>
          <p className="text-slate-500 text-xs mt-0.5">Real-time GPS monitoring · B.C. Road, Bantwal</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-[11px] font-medium">Live</span>
          </div>
          <span className="text-slate-600 text-[11px]">Updated {meta.lastUpdated ? new Date(meta.lastUpdated).toLocaleTimeString() : '—'}</span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-[#0a1128]/80 border border-white/[0.06] rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center shadow-lg`}>
              <span className="material-symbols-outlined text-white text-lg">{s.icon}</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-[11px] text-slate-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid: Map + Sidebar */}
      <div className="grid grid-cols-[1fr_340px] gap-4" style={{ height: 'calc(100vh - 300px)', minHeight: 500 }}>
        {/* Map */}
        <div className="bg-[#0a1128]/80 border border-white/[0.06] rounded-2xl overflow-hidden relative">
          <div ref={mapRef} className="w-full h-full" />

          {/* Map Legend */}
          <div className="absolute bottom-4 left-4 bg-[#0a1128]/90 backdrop-blur-xl border border-white/[0.06] rounded-xl p-3 z-[1000]">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">Status</div>
            <div className="space-y-1.5">
              {Object.entries(STATUS_CFG).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}60` }} />
                  <span className="text-[11px] text-slate-400">{cfg.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full border border-dashed border-emerald-500/50" />
              <span className="text-[11px] text-slate-400">Safe Zone</span>
            </div>
          </div>
        </div>

        {/* Sidebar - Tourist List */}
        <div className="bg-[#0a1128]/80 border border-white/[0.06] rounded-2xl flex flex-col overflow-hidden">
          {/* Search + Filter */}
          <div className="p-3 border-b border-white/[0.06] space-y-2">
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2">
              <span className="material-symbols-outlined text-slate-500 text-lg">search</span>
              <input
                type="text"
                placeholder="Search tourist..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent border-none outline-none text-xs text-white placeholder:text-slate-600 w-full"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {['all', ...Object.keys(STATUS_CFG)].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                    filterStatus === s
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-white/[0.04] text-slate-500 border border-transparent hover:bg-white/[0.06]'
                  }`}
                >
                  {s === 'all' ? 'All' : STATUS_CFG[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* Tourist List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filtered.length === 0 && (
              <div className="text-center text-slate-600 text-xs py-10">No tourists found</div>
            )}
            {filtered.map(t => {
              const cfg = STATUS_CFG[t.status] || STATUS_CFG.active;
              const isSelected = selected?.id === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => flyTo(t)}
                  className={`w-full text-left p-3 rounded-xl transition-all duration-200 ${
                    isSelected
                      ? 'bg-emerald-500/10 border border-emerald-500/20'
                      : 'hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                      {t.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold text-white truncate">{t.name}</span>
                        <span className={`${cfg.bg} ${cfg.text} text-[9px] font-semibold px-1.5 py-0.5 rounded-md`}>{cfg.label}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">📍 {t.nearestLandmark}</div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-slate-600">🔋 {t.batteryLevel}%</span>
                        <span className="text-[10px] text-slate-600">⏱ {t.lastSeen}</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-white/[0.06] flex items-center justify-between">
            <span className="text-[11px] text-slate-500">{filtered.length} tourist{filtered.length !== 1 ? 's' : ''}</span>
            <button onClick={loadData} className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-medium rounded-lg transition-all">
              <span className="material-symbols-outlined text-sm">refresh</span>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Selected Tourist Detail Panel */}
      {selected && (
        <div className="bg-[#0a1128]/80 border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white text-base font-bold">
                {selected.name.charAt(0)}
              </div>
              <div>
                <div className="text-white font-semibold text-[15px]">{selected.name}</div>
                <div className="text-slate-500 text-xs">{selected.email}</div>
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-white/[0.04] text-slate-500 hover:text-white transition-all">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {[
              { icon: 'call', label: 'Phone', value: selected.phone },
              { icon: 'location_on', label: 'Coordinates', value: `${selected.lat.toFixed(4)}°N, ${selected.lng.toFixed(4)}°E` },
              { icon: 'place', label: 'Near', value: selected.nearestLandmark },
              { icon: 'battery_full', label: 'Battery', value: `${selected.batteryLevel}%` },
              { icon: 'schedule', label: 'Last Seen', value: selected.lastSeen },
            ].map(d => (
              <div key={d.label} className="bg-white/[0.03] border border-white/[0.04] rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="material-symbols-outlined text-emerald-400 text-sm">{d.icon}</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">{d.label}</span>
                </div>
                <div className="text-[13px] text-white font-medium truncate">{d.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
