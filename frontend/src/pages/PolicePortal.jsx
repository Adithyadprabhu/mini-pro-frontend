import { useState, useEffect } from 'react';
import * as api from '../services/api';

export default function PolicePortal() {
  const [incidents, setIncidents] = useState([]);
  const [activeSosCount, setActiveSosCount] = useState(0);
  const [dutyStatus, setDutyStatus] = useState('available');
  const [unitCallsign] = useState('UNIT-504');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const loadIncidents = async () => {
    try {
      const data = await api.fetchPoliceIncidents();
      if (data?.incidents) {
        setIncidents(data.incidents);
        setActiveSosCount(data.activeSosCount || 0);
      }
    } catch {
      // Standby
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const sync = async () => {
      try {
        const data = await api.fetchPoliceIncidents();
        if (isMounted && data?.incidents) {
          setIncidents(data.incidents);
          setActiveSosCount(data.activeSosCount || 0);
        }
      } catch {
        // Standby
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    sync();
    const interval = setInterval(sync, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleRespond = async (incidentId) => {
    try {
      await api.assignPoliceIncident(incidentId, unitCallsign);
      setDutyStatus('enroute');
      showToast('Dispatch Accepted', `${unitCallsign} assigned to ${incidentId}`, 'success');
      loadIncidents();
    } catch (err) {
      showToast('Error', err.message || 'Failed to assign incident', 'error');
    }
  };

  const handleResolve = async (incidentId) => {
    try {
      await api.resolvePoliceIncident(incidentId);
      setDutyStatus('available');
      showToast('Incident Resolved', `${incidentId} marked as cleared`, 'success');
      loadIncidents();
    } catch (err) {
      showToast('Error', err.message || 'Failed to resolve', 'error');
    }
  };

  const showToast = (title, body, type = 'info') => {
    setToast({ title, body, type });
    setTimeout(() => setToast(null), 4000);
  };

  const filteredIncidents = incidents.filter((inc) => {
    if (filter === 'sos') return inc.sos_id || inc.title?.includes('SOS');
    if (filter === 'critical') return inc.priority === 'critical';
    if (filter === 'active') return inc.status !== 'RESOLVED';
    return true;
  });

  const dutyOptions = [
    { key: 'available', label: 'Available', color: 'emerald' },
    { key: 'enroute', label: 'En Route', color: 'blue' },
    { key: 'onscene', label: 'On Scene', color: 'amber' },
  ];

  const getPriorityStyle = (p) => {
    const map = {
      critical: { pill: 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20', dot: 'bg-red-400', border: 'border-l-red-500' },
      high: { pill: 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20', dot: 'bg-amber-400', border: 'border-l-amber-500' },
      medium: { pill: 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20', dot: 'bg-blue-400', border: 'border-l-blue-500' },
    };
    return map[p] || { pill: 'bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20', dot: 'bg-slate-500', border: 'border-l-slate-700' };
  };

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold text-white tracking-tight">Police Portal</h1>
          <p className="text-sm text-slate-500 mt-1">Patrol dispatch and incident response • B.C. Road, Bantwal</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Duty Status */}
          <div className="flex items-center bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 gap-0.5">
            {dutyOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setDutyStatus(opt.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  dutyStatus === opt.key
                    ? `bg-${opt.color}-500/15 text-${opt.color}-400 ring-1 ring-${opt.color}-500/20`
                    : 'text-slate-600 hover:text-slate-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2">
            <span className="material-symbols-outlined text-blue-400 text-lg">badge</span>
            <span className="text-xs text-white font-semibold">{unitCallsign}</span>
          </div>
        </div>
      </div>

      {/* SOS Alert Banner */}
      {activeSosCount > 0 && (
        <div className="bg-red-500/8 border border-red-500/20 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center animate-pulse">
              <span className="material-symbols-outlined text-red-400 text-xl">emergency</span>
            </div>
            <div>
              <span className="text-sm font-semibold text-red-400">
                {activeSosCount} Active Tourist SOS {activeSosCount > 1 ? 'Requests' : 'Request'}
              </span>
              <p className="text-xs text-red-400/60 mt-0.5">Requires immediate response in patrol area</p>
            </div>
          </div>
          <button
            onClick={() => setFilter('sos')}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
          >
            <span className="material-symbols-outlined text-base">priority_high</span>
            View SOS
          </button>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Incidents', value: incidents.length, icon: 'assignment', gradient: 'from-blue-500 to-indigo-500' },
          { label: 'Active SOS', value: activeSosCount, icon: 'emergency', gradient: 'from-red-500 to-rose-500' },
          { label: 'Critical', value: incidents.filter(i => i.priority === 'critical').length, icon: 'warning', gradient: 'from-amber-500 to-orange-500' },
          { label: 'Resolved', value: incidents.filter(i => i.status === 'RESOLVED').length, icon: 'check_circle', gradient: 'from-emerald-500 to-cyan-500' },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#0a1128]/80 rounded-2xl p-5 border border-white/[0.06] flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg`}>
              <span className="material-symbols-outlined text-white text-xl">{stat.icon}</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-slate-500">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Incident Stream - Left */}
        <div className="xl:col-span-7 flex flex-col gap-4">
          {/* Filter Bar */}
          <div className="bg-[#0a1128]/80 rounded-2xl p-4 border border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-400 text-lg">broadcast_on_personal</span>
              <span className="text-sm font-semibold text-white">Live Incident Stream</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/[0.02] border border-white/[0.04] rounded-xl p-1">
              {[
                { id: 'all', label: `All (${incidents.length})` },
                { id: 'sos', label: `SOS (${incidents.filter(i => i.sos_id).length})` },
                { id: 'critical', label: 'Critical' },
                { id: 'active', label: 'Active' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    filter === f.id
                      ? 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/20'
                      : 'text-slate-600 hover:text-slate-400'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Incident Cards */}
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="flex items-center gap-3 text-slate-400">
                <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Syncing incident stream...</span>
              </div>
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="bg-[#0a1128]/80 rounded-2xl border border-white/[0.06] flex flex-col items-center justify-center py-14">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-emerald-400 text-3xl">done_all</span>
              </div>
              <span className="text-base font-semibold text-white mb-1">All Clear</span>
              <span className="text-sm text-slate-500">No active incidents in queue</span>
            </div>
          ) : (
            filteredIncidents.map((inc) => {
              const style = getPriorityStyle(inc.priority);
              return (
                <div
                  key={inc.id}
                  className={`bg-[#0a1128]/80 rounded-2xl p-5 border border-white/[0.06] border-l-[3px] ${style.border} hover:border-white/[0.1] transition-all`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${style.dot} ${inc.priority === 'critical' ? 'animate-pulse' : ''}`} />
                      <span className="text-sm font-semibold text-white">{inc.id}</span>
                      <span className="text-sm text-slate-300">{inc.title}</span>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${style.pill}`}>
                      {inc.priority?.toUpperCase() || 'LOW'}
                    </span>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold mb-1">Location</div>
                      <div className="text-sm text-white font-medium">{inc.location}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold mb-1">Assigned Unit</div>
                      <div className="text-sm text-blue-400 font-semibold">{inc.unit || 'Unassigned'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold mb-1">Status</div>
                      <div className={`text-sm font-semibold ${inc.status === 'RESOLVED' ? 'text-emerald-400' : 'text-amber-400'}`}>{inc.status}</div>
                    </div>
                  </div>

                  {inc.threat && (
                    <div className="text-xs text-slate-400 bg-white/[0.02] rounded-lg p-3 mb-4 border border-white/[0.04]">
                      <span className="text-red-400 font-semibold">Threat: </span>{inc.threat}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.04]">
                    {inc.status !== 'RESOLVED' ? (
                      <>
                        <button
                          onClick={() => handleRespond(inc.id)}
                          className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white rounded-xl px-4 py-2 text-xs font-semibold transition-all shadow-lg shadow-blue-500/15"
                        >
                          <span className="material-symbols-outlined text-sm">local_police</span>
                          Respond ({unitCallsign})
                        </button>
                        <button
                          onClick={() => handleResolve(inc.id)}
                          className="flex items-center gap-2 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 rounded-xl px-4 py-2 text-xs font-semibold transition-all border border-white/[0.06]"
                        >
                          <span className="material-symbols-outlined text-sm">check</span>
                          Resolve
                        </button>
                      </>
                    ) : (
                      <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        Cleared
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Panel */}
        <div className="xl:col-span-5 flex flex-col gap-5">
          {/* Patrol Map */}
          <div className="bg-[#0a1128]/80 rounded-2xl border border-white/[0.06] overflow-hidden">
            <div className="p-4 border-b border-white/[0.04] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-400 text-lg">radar</span>
                <span className="text-sm font-semibold text-white">Patrol Area Map</span>
              </div>
              <span className="text-[11px] text-slate-600 font-medium">B.C. Road Sector</span>
            </div>
            <div className="relative h-56 bg-[#050a15]">
              <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-25" />
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 500 220" fill="none">
                <defs>
                  <radialGradient id="patrolGlow"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.12" /><stop offset="100%" stopColor="#3b82f6" stopOpacity="0" /></radialGradient>
                </defs>
                <circle cx="250" cy="110" r="90" fill="url(#patrolGlow)" />
                <path d="M 50,110 L 450,110" stroke="#1e293b" strokeWidth="3" />
                <text x="200" y="102" fill="#334155" fontSize="9" fontFamily="system-ui">NH-75 Highway</text>
                <path d="M 250,20 L 250,200" stroke="#1e293b" strokeWidth="2" />
                <circle cx="250" cy="110" r="5" fill="#3b82f6" /><circle cx="250" cy="110" r="12" fill="none" stroke="#3b82f6" strokeWidth="1" opacity="0.4" />
                <text x="268" y="114" fill="#3b82f6" fontSize="9" fontFamily="system-ui" fontWeight="600">Patrol Center</text>
                <circle cx="180" cy="80" r="3" fill="#10b981" /><text x="192" y="84" fill="#10b981" fontSize="8" fontFamily="system-ui">Bus Stand</text>
                <circle cx="340" cy="140" r="3" fill="#f59e0b" /><text x="352" y="144" fill="#f59e0b" fontSize="8" fontFamily="system-ui">Market</text>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-[#0a1128]/80 backdrop-blur-sm border border-white/[0.08] rounded-xl px-4 py-3 text-center">
                  <span className="text-xs font-semibold text-white">Active Patrol Zone</span>
                  <div className="text-[11px] text-slate-500 mt-0.5">B.C. Road Junction • Bantwal</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Protocols */}
          <div className="bg-gradient-to-br from-blue-500/5 via-[#0a1128]/80 to-indigo-500/5 rounded-2xl p-6 border border-blue-500/10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-base">menu_book</span>
              </div>
              <h3 className="text-base font-semibold text-white">Patrol Protocols</h3>
            </div>
            <ul className="space-y-2.5 text-sm text-slate-400 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-red-400 text-base mt-0.5 shrink-0">priority_high</span>
                Tourist SOS signals take top priority over routine dispatches.
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-blue-400 text-base mt-0.5 shrink-0">groups</span>
                Coordinate with Bantwal Town beat patrol on shared incidents.
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-base mt-0.5 shrink-0">directions</span>
                Direct non-emergency tourists to Bus Stand or Market safe zones.
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-amber-400 text-base mt-0.5 shrink-0">call</span>
                Contact Bantwal Police: (08255) 232 333 for backup.
              </li>
            </ul>
          </div>

          {/* Emergency Contacts */}
          <div className="bg-[#0a1128]/80 rounded-2xl p-6 border border-white/[0.06]">
            <h3 className="text-base font-semibold text-white mb-4">Emergency Contacts</h3>
            <div className="space-y-2.5">
              {[
                { name: 'Bantwal Police Station', phone: '(08255) 232 333', type: 'Primary', color: 'blue' },
                { name: 'District Control Room', phone: '100', type: 'Emergency', color: 'red' },
                { name: 'Ambulance Service', phone: '108', type: 'Medical', color: 'emerald' },
                { name: 'Fire Service', phone: '101', type: 'Fire', color: 'amber' },
              ].map((contact) => (
                <div key={contact.name} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-${contact.color}-500/10 flex items-center justify-center`}>
                      <span className={`material-symbols-outlined text-${contact.color}-400 text-base`}>call</span>
                    </div>
                    <div>
                      <div className="text-[13px] text-white font-medium">{contact.name}</div>
                      <div className="text-[11px] text-slate-500">{contact.type}</div>
                    </div>
                  </div>
                  <span className="text-sm text-blue-400 font-semibold font-mono">{contact.phone}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${toast ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0 pointer-events-none'}`}>
        <div className="bg-[#0a1128] border border-white/[0.08] rounded-xl px-5 py-3.5 shadow-2xl shadow-black/40 flex items-center gap-3 max-w-sm backdrop-blur-xl">
          <span className={`material-symbols-outlined text-lg ${toast?.type === 'success' ? 'text-emerald-400' : toast?.type === 'error' ? 'text-red-400' : 'text-blue-400'}`}>
            {toast?.type === 'success' ? 'check_circle' : toast?.type === 'error' ? 'error' : 'info'}
          </span>
          <div>
            <div className="text-sm font-semibold text-white">{toast?.title}</div>
            <div className="text-xs text-slate-400 mt-0.5">{toast?.body}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
