import { useState, useEffect } from 'react';
import { fetchIncidents, dispatchIncident } from '../services/api';

export default function IncidentPrioritization() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [dispatched, setDispatched] = useState({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchIncidents();
        if (!cancelled) setIncidents(res?.incidents || []);
      } catch (err) {
        if (!cancelled) { setError(err.message || 'Connection unavailable'); setIncidents([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleDispatch = async (incidentId) => {
    try {
      const res = await dispatchIncident(incidentId);
      if (res?.success) setDispatched((prev) => ({ ...prev, [incidentId]: true }));
    } catch (err) {
      console.error('Dispatch failed:', err);
    }
  };

  const filteredIncidents = incidents.filter((inc) => filter === 'all' || inc.priority === filter);

  const counts = {
    all: incidents.length,
    critical: incidents.filter((i) => i.priority === 'critical').length,
    high: incidents.filter((i) => i.priority === 'high').length,
    medium: incidents.filter((i) => i.priority === 'medium').length,
    low: incidents.filter((i) => i.priority === 'low').length,
  };

  const getPriorityStyle = (p) => {
    const map = {
      critical: { pill: 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20', border: 'border-l-red-500', dot: 'bg-red-400', label: 'Critical', gradient: 'from-red-500/8' },
      high: { pill: 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20', border: 'border-l-amber-500', dot: 'bg-amber-400', label: 'High', gradient: 'from-amber-500/8' },
      medium: { pill: 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20', border: 'border-l-blue-500', dot: 'bg-blue-400', label: 'Medium', gradient: 'from-blue-500/8' },
    };
    return map[p] || { pill: 'bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20', border: 'border-l-slate-700', dot: 'bg-slate-500', label: 'Low', gradient: 'from-slate-500/5' };
  };

  const filterButtons = [
    { key: 'all', label: 'All', count: counts.all, active: 'bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 text-emerald-400 ring-1 ring-emerald-500/20' },
    { key: 'critical', label: 'Critical', count: counts.critical, active: 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20' },
    { key: 'high', label: 'High', count: counts.high, active: 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20' },
    { key: 'medium', label: 'Medium', count: counts.medium, active: 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20' },
    { key: 'low', label: 'Low', count: counts.low, active: 'bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20' },
  ];

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold text-white tracking-tight">Incident Management</h1>
          <p className="text-sm text-slate-500 mt-1">Monitor and dispatch active safety incidents</p>
        </div>
        <div className="flex items-center gap-1.5 bg-white/[0.02] border border-white/[0.06] rounded-xl p-1">
          {filterButtons.map((btn) => (
            <button
              key={btn.key}
              onClick={() => setFilter(btn.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === btn.key ? btn.active : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              {btn.label} <span className="ml-0.5 opacity-70">{btn.count}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-500/8 border border-red-500/15 text-red-400 rounded-xl px-4 py-3 text-sm">
          <span className="material-symbols-outlined text-lg">error</span>
          Backend connection unavailable: {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-48">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <div className="w-10 h-10 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin" />
            <span className="text-sm">Loading incidents...</span>
          </div>
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Incident Cards */}
          <div className="xl:col-span-7 flex flex-col gap-4">
            {filteredIncidents.length === 0 ? (
              <div className="bg-[#0a1128]/80 rounded-2xl border border-white/[0.06] flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-slate-600 text-3xl">inbox</span>
                </div>
                <span className="text-base font-semibold text-white mb-1">No Active Incidents</span>
                <span className="text-sm text-slate-500">All clear — no incidents match the current filter</span>
              </div>
            ) : (
              filteredIncidents.map((inc) => {
                const style = getPriorityStyle(inc.priority);
                const done = dispatched[inc.id] || inc.dispatched;
                return (
                  <div
                    key={inc.id}
                    className={`relative bg-[#0a1128]/80 rounded-2xl p-5 border border-white/[0.06] border-l-[3px] ${style.border} hover:border-white/[0.1] transition-all overflow-hidden group`}
                  >
                    {/* Subtle gradient tint */}
                    <div className={`absolute top-0 left-0 w-40 h-full bg-gradient-to-r ${style.gradient} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
                    
                    <div className="relative z-10">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                          <span className="text-xs text-slate-500 font-mono">{inc.id}</span>
                          <span className="text-sm font-semibold text-white">{inc.title}</span>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${style.pill}`}>
                          {style.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <div className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold mb-1">Location</div>
                          <div className="text-sm text-white font-medium">{inc.location}</div>
                          <div className="text-xs text-slate-600">{inc.zone || 'B.C. Road Area'}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold mb-1">Unit Assignment</div>
                          <div className="text-sm text-blue-400 font-semibold">{inc.unit || 'Awaiting dispatch'}</div>
                          <div className="text-xs text-slate-600">{inc.eta || '—'}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold mb-1">Severity</div>
                          <div className="text-sm text-white font-medium">{inc.severity || '—'}/100</div>
                          <div className="text-xs text-slate-600">{inc.time || 'Recent'}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${done ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                          <span className="text-xs text-slate-500 font-medium">
                            {done ? 'Dispatched' : 'Pending dispatch'}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDispatch(inc.id)}
                          disabled={done}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                            done
                              ? 'bg-white/[0.04] text-emerald-400 cursor-default'
                              : 'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white shadow-lg shadow-emerald-500/15'
                          }`}
                        >
                          <span className="material-symbols-outlined text-base">
                            {done ? 'check_circle' : 'send'}
                          </span>
                          {done ? 'Dispatched' : 'Dispatch Unit'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Panel */}
          <div className="xl:col-span-5 flex flex-col gap-5">
            {/* Map */}
            <div className="bg-[#0a1128]/80 rounded-2xl border border-white/[0.06] overflow-hidden">
              <div className="p-4 border-b border-white/[0.04] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-400/60 text-lg">explore</span>
                  <span className="text-sm font-semibold text-white">Dispatch Map</span>
                </div>
                <span className="text-[11px] text-slate-600 font-medium">Live View</span>
              </div>
              <div className="relative h-56 bg-[#050a15]">
                <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-25" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-slate-600">
                    <div className="w-12 h-12 rounded-xl bg-white/[0.03] flex items-center justify-center">
                      <span className="material-symbols-outlined text-2xl">near_me</span>
                    </div>
                    <span className="text-xs font-medium">Awaiting incident coordinates</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Response Metrics */}
            <div className="bg-[#0a1128]/80 rounded-2xl p-6 border border-white/[0.06]">
              <h3 className="text-base font-semibold text-white mb-4">Response Metrics</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Avg Response', value: '—', icon: 'timer', gradient: 'from-blue-500 to-indigo-500' },
                  { label: 'Dispatched', value: String(Object.keys(dispatched).length), icon: 'send', gradient: 'from-emerald-500 to-cyan-500' },
                  { label: 'Resolved', value: '—', icon: 'check_circle', gradient: 'from-green-500 to-emerald-500' },
                  { label: 'Pending', value: String(filteredIncidents.length), icon: 'pending', gradient: 'from-amber-500 to-orange-500' },
                ].map((m) => (
                  <div key={m.label} className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 hover:bg-white/[0.04] transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${m.gradient} flex items-center justify-center`}>
                        <span className="material-symbols-outlined text-white text-sm">{m.icon}</span>
                      </div>
                    </div>
                    <span className="text-2xl font-bold text-white">{m.value}</span>
                    <div className="text-[11px] text-slate-500 mt-0.5 font-medium">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-gradient-to-br from-emerald-500/5 via-[#0a1128]/80 to-cyan-500/5 rounded-2xl p-6 border border-emerald-500/10">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-emerald-400 text-lg">insights</span>
                <h3 className="text-base font-semibold text-white">Quick Summary</h3>
              </div>
              <div className="text-sm text-slate-400 leading-relaxed">
                {incidents.length > 0
                  ? `${incidents.length} total incidents tracked. ${counts.critical} critical, ${counts.high} high priority requiring attention.`
                  : 'No active incidents. All zones are clear and operating normally.'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
