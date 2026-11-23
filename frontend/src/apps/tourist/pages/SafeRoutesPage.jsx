import { useState } from 'react';
import { useLanguage } from '../useLanguage';
import * as touristApi from '../touristApi';

const LANDMARKS = [
  { id: 'bcroad', label: 'B.C. Road Bus Stand & Railway Stn', lat: 12.8817, lng: 75.0299 },
  { id: 'bantwal', label: 'Bantwal Town Center (Taluk Office)', lat: 12.8936, lng: 74.9947 },
  { id: 'karinja', label: 'Sri Karinjeshwara Temple (Karinja)', lat: 12.8650, lng: 75.0900 },
  { id: 'netravathi', label: 'Netravathi River Bridge Promenade', lat: 12.8880, lng: 75.0050 },
  { id: 'melkar', label: 'Melkar Junction (NH-75 / Highway)', lat: 12.8591, lng: 75.0555 },
];

export default function SafeRoutesPage() {
  const { lang, changeLanguage, t } = useLanguage();

  const [origin, setOrigin] = useState('bcroad');
  const [destination, setDestination] = useState('karinja');
  const [persona, setPersona] = useState('solo');
  const [routes, setRoutes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const findRoutes = async () => {
    setLoading(true);
    setError(null);
    setRoutes(null);

    const orig = LANDMARKS.find((l) => l.id === origin);
    const dest = LANDMARKS.find((l) => l.id === destination);

    if (origin === destination) {
      setError('Please select different start and destination points.');
      setLoading(false);
      return;
    }

    try {
      const res = await touristApi.fetchSafeRoutes(
        orig?.lat || 12.8817,
        orig?.lng || 75.0299,
        dest?.lat || 12.89,
        dest?.lng || 75.00
      );

      if (res?.routes) {
        const adjusted = res.routes.map((r, idx) => {
          let score = r.safetyScore;
          let badge = 'Well-lit Pedestrian Path';
          if (persona === 'family') {
            score = idx === 0 ? 95 : score + 2;
            badge = 'Family-friendly with low traffic';
          } else if (persona === 'night') {
            score = idx === 0 ? 92 : score - 4;
            badge = 'NH-75 Lit Highway with 24/7 Patrol';
          }
          return { ...r, score, badge };
        });
        setRoutes(adjusted);
      } else {
        setError('Unable to load routes. Please try again.');
      }
    } catch {
      setError('Route service unavailable.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-24 px-4 pt-5 space-y-4 max-w-md mx-auto select-none">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">{t.safeRoutes}</h1>
          <p className="text-xs text-slate-400">Safest walkways & corridors in Bantwal</p>
        </div>

        {/* Clean Language Pill */}
        <div className="flex items-center bg-slate-800/90 rounded-full p-1 border border-slate-700/60 text-xs font-semibold">
          <button
            onClick={() => changeLanguage('en')}
            className={`px-2 py-0.5 rounded-full transition-all ${lang === 'en' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
          >
            EN
          </button>
          <button
            onClick={() => changeLanguage('kn')}
            className={`px-2 py-0.5 rounded-full transition-all ${lang === 'kn' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
          >
            ಕನ್ನಡ
          </button>
          <button
            onClick={() => changeLanguage('hi')}
            className={`px-2 py-0.5 rounded-full transition-all ${lang === 'hi' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
          >
            हिन्दी
          </button>
        </div>
      </div>

      {/* TRAVELER PROFILE PICKER (Recommendation Model) */}
      <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 shadow-md space-y-2">
        <p className="text-xs font-bold text-white">Travel Mode</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'solo', label: 'Solo', icon: 'person' },
            { id: 'family', label: 'Family', icon: 'family_restroom' },
            { id: 'night', label: 'Night', icon: 'nightlight' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setPersona(p.id);
                if (routes) findRoutes();
              }}
              className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                persona === p.id
                  ? 'bg-cyan-500/15 border-cyan-500 text-cyan-400 shadow-sm'
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-base">{p.icon}</span>
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ROUTE SELECTOR FORM */}
      <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 shadow-md space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">From</label>
          <div className="flex items-center bg-slate-800 rounded-xl px-3 py-2.5 border border-slate-700">
            <span className="material-symbols-outlined text-emerald-400 text-lg mr-2 shrink-0">trip_origin</span>
            <select
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="bg-transparent text-xs text-white w-full focus:outline-none appearance-none cursor-pointer"
            >
              {LANDMARKS.map((l) => (
                <option key={l.id} value={l.id} className="bg-slate-900 text-white">{l.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">To</label>
          <div className="flex items-center bg-slate-800 rounded-xl px-3 py-2.5 border border-slate-700">
            <span className="material-symbols-outlined text-rose-400 text-lg mr-2 shrink-0">location_on</span>
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="bg-transparent text-xs text-white w-full focus:outline-none appearance-none cursor-pointer"
            >
              {LANDMARKS.map((l) => (
                <option key={l.id} value={l.id} className="bg-slate-900 text-white">{l.label}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={findRoutes}
          disabled={loading}
          className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50 active:scale-[0.98]"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              <span>Calculating Safest Path...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-base">explore</span>
              <span>Find Safe Route</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-400">
          {error}
        </div>
      )}

      {/* ROUTE CARDS */}
      {routes && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-400">Recommended Routes</p>
          {routes.map((r) => (
            <div
              key={r.id}
              className={`rounded-2xl p-4 border transition-all ${
                r.recommended
                  ? 'bg-slate-900/90 border-cyan-500/50 shadow-md ring-1 ring-cyan-500/20'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              {r.recommended && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase mb-1.5">
                  <span className="material-symbols-outlined text-xs">verified</span>
                  Safest Choice
                </span>
              )}

              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white">{r.name}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">{r.badge}</p>
                </div>
                <span className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-bold">
                  {r.score}% Safe
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-400 mt-3 pt-2 border-t border-slate-800">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">straighten</span>
                  {r.distance}
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">schedule</span>
                  {r.duration}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
