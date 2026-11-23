import { useState, useEffect } from 'react';
import { fetchOverview, fetchIncidents } from '../services/api';

export default function ExecutiveOverview() {
  const [data, setData] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartPeriod, setChartPeriod] = useState('week');

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const [overviewRes, incidentsRes] = await Promise.allSettled([
          fetchOverview(),
          fetchIncidents(),
        ]);
        if (cancelled) return;
        if (overviewRes.status === 'fulfilled' && overviewRes.value) setData(overviewRes.value);
        else setData(null);
        if (incidentsRes.status === 'fulfilled' && incidentsRes.value?.incidents) setIncidents(incidentsRes.value.incidents);
        else setIncidents([]);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Connection unavailable');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, []);

  const kpis = data?.kpis || null;

  const statCards = [
    {
      label: 'Total Incidents',
      value: kpis?.totalIncidents24h !== undefined ? String(kpis.totalIncidents24h) : '—',
      delta: kpis?.incidentsChange !== undefined ? `${kpis.incidentsChange > 0 ? '+' : ''}${kpis.incidentsChange}%` : null,
      deltaGood: kpis?.incidentsChange <= 0,
      icon: 'warning',
      gradient: 'from-amber-500 to-orange-500',
      glowColor: 'shadow-amber-500/15',
      bgTint: 'from-amber-500/8 to-transparent',
    },
    {
      label: 'High Risk Zones',
      value: kpis?.highRiskZones !== undefined ? String(kpis.highRiskZones) : '—',
      delta: kpis?.highRiskZones > 0 ? 'Active' : null,
      deltaGood: false,
      icon: 'fmd_bad',
      gradient: 'from-red-500 to-rose-500',
      glowColor: 'shadow-red-500/15',
      bgTint: 'from-red-500/8 to-transparent',
    },
    {
      label: 'Active Units',
      value: kpis?.activeUnits !== undefined ? String(kpis.activeUnits) : '—',
      delta: null,
      deltaGood: true,
      icon: 'local_police',
      gradient: 'from-blue-500 to-indigo-500',
      glowColor: 'shadow-blue-500/15',
      bgTint: 'from-blue-500/8 to-transparent',
    },
    {
      label: 'Monitored Tourists',
      value: kpis?.monitoredTourists !== undefined ? kpis.monitoredTourists.toLocaleString() : '—',
      delta: kpis?.touristsChange !== undefined ? `${kpis.touristsChange > 0 ? '+' : ''}${kpis.touristsChange}%` : null,
      deltaGood: kpis?.touristsChange >= 0,
      icon: 'travel_explore',
      gradient: 'from-emerald-500 to-cyan-500',
      glowColor: 'shadow-emerald-500/15',
      bgTint: 'from-emerald-500/8 to-transparent',
    },
  ];

  const chartBars = [
    { day: 'Mon', h: 65 }, { day: 'Tue', h: 45 }, { day: 'Wed', h: 80 },
    { day: 'Thu', h: 55 }, { day: 'Fri', h: 70 }, { day: 'Sat', h: 40 }, { day: 'Sun', h: 60 },
  ];

  const getPriorityPill = (p) => {
    const map = {
      critical: 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20',
      high: 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20',
      medium: 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20',
    };
    return map[p] || 'bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 font-sans">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-10 h-10 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin" />
          <span className="text-sm">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Monitor safety metrics for B.C. Road, Bantwal</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </div>
          <button className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white rounded-xl px-5 py-2.5 text-sm font-semibold transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30">
            <span className="material-symbols-outlined text-lg">download</span>
            Export
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-500/8 border border-red-500/15 text-red-400 rounded-xl px-4 py-3 text-sm">
          <span className="material-symbols-outlined text-lg">error</span>
          Backend connection unavailable: {error}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card, i) => (
          <div
            key={i}
            className={`relative bg-[#0a1128]/80 rounded-2xl p-6 border border-white/[0.06] hover:border-white/[0.1] transition-all duration-300 overflow-hidden group hover:${card.glowColor} hover:shadow-xl`}
          >
            {/* Background gradient tint */}
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${card.bgTint} rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
            
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-4">
                <span className="text-sm text-slate-400">{card.label}</span>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center shadow-lg ${card.glowColor}`}>
                  <span className="material-symbols-outlined text-white text-xl">{card.icon}</span>
                </div>
              </div>
              <div className="flex items-baseline gap-2.5">
                <span className="text-[32px] font-bold text-white leading-none">{card.value}</span>
                {card.delta && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${card.deltaGood ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {card.delta}
                  </span>
                )}
              </div>
              {/* Mini sparkline */}
              <div className="mt-3 flex items-end gap-[3px] h-6">
                {[40, 55, 35, 65, 50, 70, 45, 60, 75, 55, 80, 65].map((v, j) => (
                  <div key={j} className={`flex-1 rounded-sm bg-gradient-to-t ${card.gradient} opacity-20 group-hover:opacity-40 transition-opacity`} style={{ height: `${v}%` }} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div>
        <div className="bg-[#0a1128]/80 rounded-2xl p-6 border border-white/[0.06]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Safety Overview</h2>
              <p className="text-sm text-slate-500 mt-0.5">Incident trends over time</p>
            </div>
            <div className="flex items-center bg-white/[0.04] border border-white/[0.06] rounded-xl p-1">
              {[
                { key: 'week', label: 'Week' },
                { key: 'month', label: 'Month' },
                { key: 'year', label: 'Year' },
              ].map((p) => (
                <button
                  key={p.key}
                  onClick={() => setChartPeriod(p.key)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    chartPeriod === p.key
                      ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-sm'
                      : 'text-slate-500 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Revenue-style large number */}
          <div className="mb-5">
            <span className="text-sm text-slate-500">Total this period</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-bold text-white">{kpis?.totalIncidents24h ?? 42}</span>
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">incidents</span>
            </div>
          </div>

          <div className="w-full h-52">
            <svg className="w-full h-full" viewBox="0 0 700 200" preserveAspectRatio="none">
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
              {[0, 1, 2, 3].map((i) => (
                <line key={i} x1="0" y1={i * 50 + 10} x2="700" y2={i * 50 + 10} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              ))}
              {chartBars.map((bar, i) => {
                const barW = 44;
                const gap = (700 - barW * 7) / 8;
                const x = gap + i * (barW + gap);
                const maxH = 155;
                const h = (bar.h / 100) * maxH;
                const y = 175 - h;
                return (
                  <g key={i}>
                    <rect x={x} y={y} width={barW} height={h} rx="8" fill="url(#barGrad)" opacity="0.85" className="hover:opacity-100 transition-opacity cursor-pointer" />
                    <text x={x + barW / 2} y="195" textAnchor="middle" fill="#475569" fontSize="11" fontFamily="system-ui">{bar.day}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Recent Incidents Table */}
      <div className="bg-[#0a1128]/80 rounded-2xl p-6 border border-white/[0.06]">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-white">Recent Incidents</h2>
            <p className="text-sm text-slate-500 mt-0.5">Latest safety reports from B.C. Road area</p>
          </div>
          <button className="text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors flex items-center gap-1 bg-emerald-500/8 hover:bg-emerald-500/15 px-3 py-1.5 rounded-lg">
            View All
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </button>
        </div>

        {incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-slate-600">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-3xl">inbox</span>
            </div>
            <span className="text-sm font-medium text-slate-400">No incidents reported</span>
            <span className="text-xs text-slate-600 mt-1">All clear in the monitoring area</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['ID', 'Title', 'Location', 'Priority', 'Severity', 'Time'].map((h) => (
                    <th key={h} className="text-left text-[11px] text-slate-600 uppercase tracking-wider font-semibold py-3 px-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {incidents.slice(0, 8).map((inc) => (
                  <tr key={inc.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer">
                    <td className="py-3.5 px-3 text-sm text-slate-400 font-mono text-xs">{inc.id}</td>
                    <td className="py-3.5 px-3 text-sm text-white font-medium">{inc.title}</td>
                    <td className="py-3.5 px-3 text-sm text-slate-400">{inc.location}</td>
                    <td className="py-3.5 px-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${getPriorityPill(inc.priority)}`}>
                        {inc.priority || 'low'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-sm text-slate-300">{inc.severity || '—'}</td>
                    <td className="py-3.5 px-3 text-sm text-slate-500">{inc.time || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
