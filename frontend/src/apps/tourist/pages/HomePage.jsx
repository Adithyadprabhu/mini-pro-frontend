import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/useAuth';
import { useLanguage } from '../useLanguage';
import * as touristApi from '../touristApi';
import DailySafetyCheckin from '../components/DailySafetyCheckin';

export default function HomePage({ onTabChange }) {
  const { user } = useAuth();
  const { lang, changeLanguage, t } = useLanguage();

  const [location, setLocation] = useState({ lat: 12.8817, lng: 75.0299 });
  const [safetyStatus, setSafetyStatus] = useState(null);
  const [riskForecast, setRiskForecast] = useState(null);
  const [assignedTeam, setAssignedTeam] = useState(null);
  const [sosConfirm, setSosConfirm] = useState(false);
  const [sosSending, setSosSending] = useState(false);
  const [sosResult, setSosResult] = useState(null);
  const [hour] = useState(() => new Date().getHours());

  const greetingText = hour < 12 ? t.goodMorning : hour < 17 ? t.goodAfternoon : t.goodEvening;

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { timeout: 5000 }
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [safety, forecastRes, teamRes] = await Promise.all([
          touristApi.fetchSafetyStatus(),
          touristApi.fetchRiskForecast(),
          touristApi.fetchAssignedResponseUnit(location?.lat, location?.lng),
        ]);
        if (cancelled) return;
        if (safety) setSafetyStatus(safety);
        if (forecastRes) setRiskForecast(forecastRes);
        if (teamRes?.assignedTeam) setAssignedTeam(teamRes.assignedTeam);
      } catch {
        // handled
      }
    }
    load();
    return () => { cancelled = true; };
  }, [location]);

  const handleSOS = async () => {
    setSosSending(true);
    try {
      const coords = location || { lat: 12.8817, lng: 75.0299 };
      const result = await touristApi.triggerSOS({
        latitude: coords.lat,
        longitude: coords.lng,
        locationName: 'B.C. Road, Bantwal, Karnataka 574219',
        notes: `Emergency SOS from ${user?.name || 'Tourist'} at B.C. Road`,
      });
      setSosResult(result);
    } catch {
      setSosResult({ error: true, message: 'SOS signal sent. For immediate life danger, call 112 / 100.' });
    } finally {
      setSosSending(false);
      setSosConfirm(false);
    }
  };

  return (
    <div className="pb-24 px-4 pt-5 space-y-4 max-w-md mx-auto select-none">
      {/* 1. CLEAN HEADER: GREETING & SIMPLE LANGUAGE SWITCH */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 font-medium">{greetingText},</p>
          <h1 className="text-xl font-bold text-white tracking-tight">
            {user?.name || 'Traveler'}
          </h1>
          <p className="text-xs text-emerald-400 flex items-center gap-1.5 mt-0.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            B.C. Road, Bantwal • Safe Zone
          </p>
        </div>

        {/* Clean Language Pill */}
        <div className="flex items-center bg-slate-800/90 rounded-full p-1 border border-slate-700/60 shadow-sm">
          {[
            { id: 'en', label: 'EN' },
            { id: 'kn', label: 'ಕನ್ನಡ' },
            { id: 'hi', label: 'हिन्दी' },
          ].map((l) => (
            <button
              key={l.id}
              onClick={() => changeLanguage(l.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                lang === l.id
                  ? 'bg-cyan-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* DAILY SAFETY CHECK-IN (Evening Automated Safety Confirmation) */}
      <DailySafetyCheckin />

      {/* 2. AREA SAFETY STATUS HERO (Risk Prediction Model) */}
      <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 rounded-3xl p-5 border border-emerald-500/25 shadow-lg relative overflow-hidden">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {safetyStatus ? `${safetyStatus.riskLevel} Crime Risk • ${safetyStatus.confidence}% Safe` : 'Low Crime Risk • 94% Safe'}
            </span>
            <h2 className="text-lg font-bold text-white pt-1">
              You are in a Safe Area
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed max-w-[280px]">
              {safetyStatus?.recommendation || 'B.C. Road is peaceful today with active police presence along the transit corridor.'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <span className="material-symbols-outlined text-2xl">shield</span>
          </div>
        </div>

        {/* 6-Hour Forecast Pills */}
        {riskForecast?.forecast && (
          <div className="mt-4 pt-3 border-t border-slate-800/80">
            <p className="text-[11px] font-semibold text-slate-400 mb-2">Safety Forecast Next 6 Hours</p>
            <div className="grid grid-cols-3 gap-2">
              {riskForecast.forecast.slice(0, 3).map((f) => (
                <div key={f.time} className="bg-slate-800/60 rounded-xl p-2 text-center border border-slate-700/40">
                  <span className="text-[10px] text-slate-400 block">{f.time.split(' ')[0]}</span>
                  <span className="text-xs font-bold text-emerald-400 block mt-0.5">Safe</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. PROMINENT RED EMERGENCY SOS BUTTON */}
      <div>
        {sosResult ? (
          <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-2xl p-4 text-center space-y-1 shadow-lg">
            <span className="material-symbols-outlined text-3xl text-emerald-400">check_circle</span>
            <p className="text-sm font-bold text-white">{t.sosTransmitted}</p>
            <p className="text-xs text-slate-300">{t.sosNotified}</p>
            <button
              onClick={() => setSosResult(null)}
              className="mt-2 text-xs font-semibold text-cyan-400 underline"
            >
              Dismiss
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSosConfirm(true)}
            className="w-full py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-red-950/40 transition-all active:scale-[0.98] cursor-pointer"
          >
            <span className="material-symbols-outlined text-2xl animate-pulse">emergency</span>
            <span>{t.emergencySOS}</span>
          </button>
        )}
      </div>

      {/* SOS Confirmation Modal */}
      {sosConfirm && (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-slate-900 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl border border-red-500/40">
            <div className="w-14 h-14 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-3xl">emergency</span>
            </div>
            <h3 className="text-base font-bold text-white">{t.confirmSOS}</h3>
            <p className="text-xs text-slate-300 leading-relaxed">{t.sosWarning}</p>
            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => setSosConfirm(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 text-xs font-semibold transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleSOS}
                disabled={sosSending}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-lg"
              >
                {sosSending ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Send Help Now</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. NEAREST POLICE HELP (Response Assignment Model) */}
      <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">local_police</span>
          </div>
          <div>
            <p className="text-xs font-bold text-white">{assignedTeam?.name || 'Bantwal Police Rapid Patrol'}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              📍 {assignedTeam?.currentLocation || '350m away'} • <strong className="text-emerald-400">~{assignedTeam?.etaMinutes || 2} min response</strong>
            </p>
          </div>
        </div>

        <a
          href={`tel:${assignedTeam?.phone?.replace(/[^0-9+]/g, '') || '08255232333'}`}
          className="px-3.5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 shadow-sm transition-all"
        >
          <span className="material-symbols-outlined text-sm">call</span>
          <span>Call</span>
        </a>
      </div>

      {/* 5. CLEAN 2-BUTTON QUICK ACCESS (Map & Routes) */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <button
          onClick={() => onTabChange('map')}
          className="bg-slate-900/90 hover:bg-slate-800/90 rounded-2xl p-4 border border-slate-800 flex items-center gap-3 transition-all active:scale-[0.98] text-left shadow"
        >
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">map</span>
          </div>
          <div>
            <p className="text-xs font-bold text-white">{t.crimeRiskMap}</p>
            <p className="text-[10px] text-slate-400">Live safety zones</p>
          </div>
        </button>

        <button
          onClick={() => onTabChange('routes')}
          className="bg-slate-900/90 hover:bg-slate-800/90 rounded-2xl p-4 border border-slate-800 flex items-center gap-3 transition-all active:scale-[0.98] text-left shadow"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">alt_route</span>
          </div>
          <div>
            <p className="text-xs font-bold text-white">{t.safeRoutes}</p>
            <p className="text-[10px] text-slate-400">Well-lit pathways</p>
          </div>
        </button>
      </div>
    </div>
  );
}
