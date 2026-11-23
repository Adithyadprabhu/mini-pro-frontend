import { useState, useEffect, useCallback } from 'react';
import { fetchCrimeRiskPrediction } from '../services/api';

const LOCATIONS = [
  { value: 'bc-road-junction', label: 'B.C. Road Junction' },
  { value: 'bus-stand', label: 'B.C. Road Bus Stand' },
  { value: 'market-area', label: 'Market Area' },
  { value: 'highway-nh75', label: 'NH-75 Highway Corridor' },
  { value: 'bantwal-town', label: 'Bantwal Town Center' },
];

const TIME_WINDOWS = [
  { value: 'current', label: 'Current' },
  { value: 'tonight', label: 'Tonight' },
  { value: 'event', label: 'Event Hours' },
  { value: 'custom', label: 'Custom Query' },
];

export default function CrimeRiskMap() {
  const [timeWindow, setTimeWindow] = useState('current');
  const [location, setLocation] = useState('bc-road-junction');
  const [layers, setLayers] = useState({ heatmap: true, incidents: true, tourists: true, units: true });
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mlRunning, setMlRunning] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((title, body, type = 'info') => {
    setToast({ title, body, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const toggleLayer = (layer) => setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetchCrimeRiskPrediction({ timeWindow, location });
        if (!cancelled) setPrediction(res?.prediction || null);
      } catch {
        if (!cancelled) setPrediction(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [timeWindow, location]);

  const runML = async () => {
    setMlRunning(true);
    try {
      const res = await fetchCrimeRiskPrediction({ timeWindow, location });
      if (res?.prediction) {
        setPrediction(res.prediction);
        showToast('Prediction Updated', 'Risk analysis refreshed from AI model.', 'success');
      } else {
        setPrediction(null);
        showToast('Service Unavailable', 'Prediction service is not connected.', 'warning');
      }
    } catch {
      setPrediction(null);
      showToast('Connection Error', 'Failed to connect to prediction service.', 'error');
    } finally {
      setMlRunning(false);
    }
  };

  const currentLocationLabel = LOCATIONS.find((l) => l.value === location)?.label || location;

  const zones = [
    { name: 'B.C. Road Junction', key: 'DOWNTOWN', color: 'emerald' },
    { name: 'Bus Stand Area', key: 'MIDTOWN', color: 'blue' },
    { name: 'Market Zone', key: 'OLD FOURTH WARD', color: 'amber' },
    { name: 'Highway NH-75', key: 'BUCKHEAD', color: 'cyan' },
    { name: 'Bantwal Town', key: 'BANTWAL', color: 'purple' },
  ];

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-bold text-white tracking-tight">Crime Risk Map</h1>
          <p className="text-sm text-slate-500 mt-1">AI-powered spatial risk analysis • B.C. Road, Bantwal</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : prediction ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
          <span className="text-xs text-slate-400 font-medium">{loading ? 'Analyzing...' : prediction ? 'Model Active' : 'Standby'}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-[#0a1128]/80 rounded-2xl p-5 border border-white/[0.06] flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Location</label>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="bg-white/[0.04] text-white rounded-xl border border-white/[0.08] px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 cursor-pointer min-w-[180px]"
          >
            {LOCATIONS.map((loc) => (
              <option key={loc.value} value={loc.value} className="bg-[#0a1128]">{loc.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Time Window</label>
          <select
            value={timeWindow}
            onChange={(e) => setTimeWindow(e.target.value)}
            className="bg-white/[0.04] text-white rounded-xl border border-white/[0.08] px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 cursor-pointer min-w-[140px]"
          >
            {TIME_WINDOWS.map((tw) => (
              <option key={tw.value} value={tw.value} className="bg-[#0a1128]">{tw.label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={runML}
          disabled={mlRunning}
          className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50 text-white rounded-xl px-5 py-2.5 text-sm font-semibold transition-all shadow-lg shadow-emerald-500/20"
        >
          <span className={`material-symbols-outlined text-lg ${mlRunning ? 'animate-spin' : ''}`}>neurology</span>
          {mlRunning ? 'Analyzing...' : 'Run AI Prediction'}
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Map */}
        <div className="lg:col-span-8 bg-[#0a1128]/80 rounded-2xl border border-white/[0.06] overflow-hidden flex flex-col">
          <div className="p-4 flex flex-wrap items-center gap-2 border-b border-white/[0.04]">
            <span className="text-xs text-slate-600 mr-2 font-medium">Layers</span>
            {[
              { key: 'heatmap', label: 'Risk Heatmap', icon: 'layers' },
              { key: 'incidents', label: 'Incidents', icon: 'warning' },
              { key: 'tourists', label: 'Tourist Zones', icon: 'group' },
              { key: 'units', label: 'Patrols', icon: 'local_police' },
            ].map((l) => (
              <button
                key={l.key}
                onClick={() => toggleLayer(l.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  layers[l.key]
                    ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                    : 'bg-white/[0.03] text-slate-600 hover:text-slate-400'
                }`}
              >
                <span className="material-symbols-outlined text-sm">{l.icon}</span>
                {l.label}
              </button>
            ))}
          </div>

          <div className="relative w-full h-[480px] bg-[#050a15]">
            <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:28px_28px] opacity-25" />
            
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 480" fill="none">
              <defs>
                <radialGradient id="glow1" cx="50%" cy="50%"><stop offset="0%" stopColor="#10b981" stopOpacity="0.15" /><stop offset="100%" stopColor="#10b981" stopOpacity="0" /></radialGradient>
                <radialGradient id="glow2" cx="50%" cy="50%"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.1" /><stop offset="100%" stopColor="#3b82f6" stopOpacity="0" /></radialGradient>
              </defs>
              {layers.heatmap && <><circle cx="400" cy="240" r="120" fill="url(#glow1)" /><circle cx="300" cy="180" r="80" fill="url(#glow2)" /><circle cx="520" cy="310" r="90" fill="url(#glow1)" /></>}
              <path d="M 80,240 L 720,240" stroke="#1e293b" strokeWidth="3" /><text x="380" y="232" fill="#334155" fontSize="10" fontFamily="system-ui">NH-75 Highway</text>
              <path d="M 400,40 L 400,440" stroke="#1e293b" strokeWidth="2.5" />
              <path d="M 200,100 L 600,380" stroke="#0f172a" strokeWidth="1.5" strokeDasharray="4,4" />
              <circle cx="400" cy="240" r="5" fill="#10b981" /><circle cx="400" cy="240" r="12" fill="none" stroke="#10b981" strokeWidth="1" opacity="0.4" /><circle cx="400" cy="240" r="20" fill="none" stroke="#10b981" strokeWidth="0.5" opacity="0.2" />
              <text x="425" y="244" fill="#10b981" fontSize="10" fontFamily="system-ui" fontWeight="600">B.C. Road Junction</text>
              <circle cx="300" cy="180" r="4" fill="#3b82f6" /><text x="315" y="184" fill="#3b82f6" fontSize="9" fontFamily="system-ui">Bus Stand</text>
              <circle cx="520" cy="310" r="4" fill="#f59e0b" /><text x="535" y="314" fill="#f59e0b" fontSize="9" fontFamily="system-ui">Market Area</text>
              <circle cx="600" cy="240" r="3" fill="#06b6d4" /><text x="615" y="244" fill="#06b6d4" fontSize="9" fontFamily="system-ui">Bantwal Town</text>
            </svg>

            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-[#0a1128]/90 backdrop-blur-md border border-white/[0.08] rounded-2xl px-6 py-5 flex flex-col items-center gap-2 max-w-xs text-center shadow-2xl">
                <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-1">
                  <span className="material-symbols-outlined text-slate-500 text-2xl">map</span>
                </div>
                <span className="text-sm font-semibold text-white">{prediction ? 'Risk overlay active' : 'Interactive Risk Map'}</span>
                <span className="text-xs text-slate-500">{prediction ? 'AI prediction overlay applied' : 'Run AI prediction for live risk analysis'}</span>
              </div>
            </div>
          </div>

          <div className="p-3 border-t border-white/[0.04] flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="font-medium text-slate-600">Risk:</span>
            {[
              { label: 'Low', color: 'bg-emerald-500' },
              { label: 'Medium', color: 'bg-yellow-500' },
              { label: 'High', color: 'bg-orange-500' },
              { label: 'Critical', color: 'bg-red-500' },
            ].map((r) => (
              <div key={r.label} className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-sm ${r.color}`} />{r.label}</div>
            ))}
            <span className="ml-auto text-slate-700">12.8817°N, 75.0299°E</span>
          </div>
        </div>

        {/* Right Panel */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* Risk Assessment */}
          <div className="bg-[#0a1128]/80 rounded-2xl p-6 border border-white/[0.06]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Risk Assessment</h3>
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${prediction ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20' : 'bg-white/[0.04] text-slate-600'}`}>
                {prediction ? 'Analyzed' : 'Pending'}
              </span>
            </div>
            <div className="text-xs text-slate-500 mb-0.5">Selected Area</div>
            <div className="text-sm font-semibold text-white mb-5">{currentLocationLabel}</div>
            <div className="flex items-center gap-4">
              <div>
                <div className="text-[42px] font-bold text-white leading-none">{prediction?.riskIndex !== undefined ? prediction.riskIndex : '—'}<span className="text-lg text-slate-500 ml-0.5">%</span></div>
                <div className="text-xs text-slate-500 mt-1">{prediction?.riskLevel || 'No data'}</div>
              </div>
              <div className="relative w-20 h-20 ml-auto">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="transparent" stroke="rgba(255,255,255,0.04)" strokeWidth="5" />
                  <circle cx="40" cy="40" r="34" fill="transparent" stroke="url(#gaugeGrad)" strokeWidth="5" strokeDasharray="213.6" strokeDashoffset={prediction?.riskIndex !== undefined ? 213.6 - (213.6 * prediction.riskIndex) / 100 : 213.6} strokeLinecap="round" />
                  <defs><linearGradient id="gaugeGrad"><stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#06b6d4" /></linearGradient></defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="material-symbols-outlined text-emerald-400/50 text-lg">analytics</span>
                </div>
              </div>
            </div>
          </div>

          {/* Zone Comparison */}
          <div className="bg-[#0a1128]/80 rounded-2xl p-6 border border-white/[0.06]">
            <h3 className="text-base font-semibold text-white mb-4">Zone Comparison</h3>
            <div className="space-y-3.5">
              {zones.map((zone) => {
                const risk = prediction?.zones?.[zone.key]?.risk || 0;
                return (
                  <div key={zone.key}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-400 font-medium">{zone.name}</span>
                      <span className="text-white font-semibold">{risk > 0 ? `${risk}%` : '—'}</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                      <div className={`h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-700`} style={{ width: `${risk}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { icon: 'alarm_on', label: 'Peak Risk Time', value: '—', gradient: 'from-amber-500 to-orange-500' },
          { icon: 'groups', label: 'Visitor Exposure', value: '—', gradient: 'from-blue-500 to-indigo-500' },
          { icon: 'shield', label: 'Optimal Patrol Window', value: '—', gradient: 'from-emerald-500 to-cyan-500' },
        ].map((m) => (
          <div key={m.label} className="bg-[#0a1128]/80 rounded-2xl p-5 border border-white/[0.06] flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${m.gradient} flex items-center justify-center shadow-lg`}>
              <span className="material-symbols-outlined text-white text-xl">{m.icon}</span>
            </div>
            <div>
              <div className="text-xs text-slate-500">{m.label}</div>
              <div className="text-xl font-bold text-white">{m.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toast */}
      <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${toast ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0 pointer-events-none'}`}>
        <div className="bg-[#0a1128] border border-white/[0.08] rounded-xl px-5 py-3.5 shadow-2xl shadow-black/40 flex items-center gap-3 max-w-sm backdrop-blur-xl">
          <span className={`material-symbols-outlined text-lg ${toast?.type === 'success' ? 'text-emerald-400' : toast?.type === 'error' ? 'text-red-400' : 'text-amber-400'}`}>
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
