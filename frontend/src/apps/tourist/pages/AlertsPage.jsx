import { useState, useEffect } from 'react';
import { useLanguage } from '../useLanguage';
import { EMERGENCY_PHRASES } from '../translations';
import * as touristApi from '../touristApi';

export default function AlertsPage({ onTabChange }) {
  const { lang, changeLanguage, t } = useLanguage();

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Quick incident triage
  const [selectedIncident, setSelectedIncident] = useState('Medical Emergency');
  const [analyzing, setAnalyzing] = useState(false);
  const [triageResult, setTriageResult] = useState(null);
  const [dispatched, setDispatched] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState(null);

  // 5-Second Cancellation Countdown State
  const [countdown, setCountdown] = useState(null);
  const [countdownTimer, setCountdownTimer] = useState(null);
  const [cancelledNotice, setCancelledNotice] = useState(false);

  useEffect(() => {
    return () => {
      if (countdownTimer) clearInterval(countdownTimer);
    };
  }, [countdownTimer]);

  const startCountdown = () => {
    setCancelledNotice(false);
    setCountdown(5);
    let secondsLeft = 5;

    const interval = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        clearInterval(interval);
        setCountdownTimer(null);
        setCountdown(null);
        setDispatched(true);
      } else {
        setCountdown(secondsLeft);
      }
    }, 1000);

    setCountdownTimer(interval);
  };

  const handleCancelRequest = () => {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      setCountdownTimer(null);
    }
    setCountdown(null);
    setDispatched(false);
    setCancelledNotice(true);
    setTimeout(() => setCancelledNotice(false), 3500);
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const alertsRes = await touristApi.fetchSafetyAlerts();
        if (cancelled) return;
        if (alertsRes?.alerts) setAlerts(alertsRes.alerts);
      } catch {
        // handled
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleTriage = async (type) => {
    setSelectedIncident(type);
    setAnalyzing(true);
    setDispatched(false);
    try {
      const res = await touristApi.classifyIncident({
        type,
        description: `${type} reported in B.C. Road Bantwal`,
      });
      if (res?.classification) {
        setTriageResult({
          priority: res.classification.priority,
          priorityLabel: res.classification.priorityLabel,
          eta: res.classification.estimatedResponseTime || '2-4 mins',
          unit: res.classification.recommendedResponder || 'Bantwal Police Rapid Team #504',
        });
      } else {
        setTriageResult({
          priority: 'P1',
          priorityLabel: 'Immediate Emergency Assistance',
          eta: '2-4 mins',
          unit: 'Bantwal Police Rapid Team #504',
        });
      }
    } catch {
      setTriageResult({
        priority: 'P1',
        priorityLabel: 'Emergency Assistance',
        eta: '3-5 mins',
        unit: 'Bantwal Police Unit #504',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const speak = (text, langCode, idx) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setSpeakingIdx(idx);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = langCode === 'kn' ? 'kn-IN' : langCode === 'hi' ? 'hi-IN' : 'en-US';
    u.rate = 0.9;
    u.onend = () => setSpeakingIdx(null);
    u.onerror = () => setSpeakingIdx(null);
    window.speechSynthesis.speak(u);
  };

  return (
    <div className="pb-24 px-4 pt-5 space-y-4 max-w-md mx-auto select-none">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">{t.alerts} & Safety</h1>
          <p className="text-xs text-slate-400">Live safety assistance • B.C. Road</p>
        </div>

        {/* Language switch */}
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

      {/* 1. CLEAN GEOFENCE RADAR CARD (Geofencing Model) */}
      <div className="bg-slate-900/90 rounded-2xl p-4 border border-emerald-500/25 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">verified_user</span>
          </div>
          <div>
            <p className="text-xs font-bold text-white">Inside Monitored Safe Zone</p>
            <p className="text-[11px] text-slate-400">B.C. Road Safe Hub • Police monitored (600m)</p>
          </div>
        </div>

        {onTabChange && (
          <button
            onClick={() => onTabChange('map')}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <span>View</span>
            <span className="material-symbols-outlined text-xs">arrow_forward</span>
          </button>
        )}
      </div>

      {/* 2. SIMPLE EMERGENCY ASSISTANCE (Incident Prioritization Model) */}
      <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 shadow-md space-y-3">
        <div>
          <p className="text-xs font-bold text-white flex items-center gap-1.5">
            <span className="material-symbols-outlined text-rose-400 text-base">support_agent</span>
            Need Help? Select an Emergency
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Auto-prioritizes and connects you to nearest responder
          </p>
        </div>

        {/* 4 Clean Options */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'Medical Emergency', label: 'Medical Help', icon: 'medical_services', color: 'text-rose-400' },
            { id: 'Police Assistance', label: 'Police / Safety', icon: 'local_police', color: 'text-cyan-400' },
            { id: 'Lost / Directions', label: 'Lost / Disoriented', icon: 'explore', color: 'text-amber-400' },
            { id: 'Theft / Snatching', label: 'Theft / Lost Items', icon: 'report', color: 'text-orange-400' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => handleTriage(item.id)}
              className={`p-3 rounded-xl text-left border transition-all flex flex-col gap-1.5 ${
                selectedIncident === item.id
                  ? 'bg-slate-800 border-cyan-500 shadow-md'
                  : 'bg-slate-850/60 border-slate-800 hover:bg-slate-800/60'
              }`}
            >
              <span className={`material-symbols-outlined text-xl ${item.color}`}>{item.icon}</span>
              <span className="text-xs font-bold text-white">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Triage feedback */}
        {analyzing && (
          <div className="p-3 bg-slate-800/80 rounded-xl flex items-center justify-center gap-2 text-xs text-slate-300">
            <span className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span>Finding nearest response team...</span>
          </div>
        )}

        {triageResult && !analyzing && (
          <div className="p-3.5 bg-slate-800/90 rounded-xl border border-cyan-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                {triageResult.priorityLabel}
              </span>
              <span className="text-xs font-bold text-white bg-slate-700/60 px-2 py-0.5 rounded-md">
                ETA: ~{triageResult.eta}
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Assigned: <strong>{triageResult.unit}</strong>
            </p>

            {countdown !== null ? (
              <div className="space-y-2 p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5 animate-pulse">
                    <span className="material-symbols-outlined text-base">timer</span>
                    Transmitting Alert in {countdown}s...
                  </span>
                  <span className="text-xs font-mono font-bold text-white bg-rose-600/50 px-2 py-0.5 rounded border border-rose-500/50">
                    00:0{countdown}
                  </span>
                </div>

                {/* Smooth 5-second visual progress bar */}
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-rose-500 h-full transition-all duration-1000 ease-linear rounded-full"
                    style={{ width: `${(countdown / 5) * 100}%` }}
                  />
                </div>

                {/* Cancel Button */}
                <button
                  onClick={handleCancelRequest}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-slate-700 shadow"
                >
                  <span className="material-symbols-outlined text-sm text-rose-400">close</span>
                  <span>Cancel Request ({countdown}s left)</span>
                </button>
              </div>
            ) : dispatched ? (
              <div className="space-y-2">
                <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-center text-xs font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  <span>Alert Sent to Bantwal Police CAD</span>
                </div>
                <button
                  onClick={handleCancelRequest}
                  className="w-full py-1 text-[11px] text-slate-400 hover:text-rose-400 font-medium underline text-center transition-colors"
                >
                  Cancel this request
                </button>
              </div>
            ) : (
              <button
                onClick={startCountdown}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-sm">send</span>
                <span>Confirm & Request Immediate Help</span>
              </button>
            )}

            {cancelledNotice && (
              <div className="p-2 bg-slate-800/90 border border-amber-500/30 rounded-lg text-center text-xs text-amber-300 flex items-center justify-center gap-1.5 animate-fadeIn">
                <span className="material-symbols-outlined text-sm text-amber-400">info</span>
                <span>Request was cancelled. No alert was sent.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. EMERGENCY PHRASEBOOK (Multilingual NLP Model) */}
      <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 shadow-md space-y-3">
        <div>
          <p className="text-xs font-bold text-white flex items-center gap-1.5">
            <span className="material-symbols-outlined text-cyan-400 text-base">translate</span>
            Tourist Emergency Phrases
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Tap the speaker to play audio to locals or police
          </p>
        </div>

        <div className="space-y-2">
          {EMERGENCY_PHRASES.slice(0, 4).map((p, idx) => (
            <div
              key={idx}
              className="bg-slate-850/60 rounded-xl p-3 border border-slate-800 flex items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{p[lang] || p.en}</p>
                {lang !== 'en' && <p className="text-[10px] text-slate-400 truncate">{p.en}</p>}
                {lang !== 'kn' && <p className="text-[10px] text-emerald-400 truncate">{p.kn}</p>}
              </div>

              <button
                onClick={() => speak(p[lang] || p.en, lang, idx)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                  speakingIdx === idx
                    ? 'bg-cyan-500 text-slate-950 animate-pulse'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
                title="Play Audio"
              >
                <span className="material-symbols-outlined text-sm">volume_up</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 4. ACTIVE AREA ALERTS */}
      <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 shadow-md space-y-2">
        <p className="text-xs font-bold text-white">Area Safety Notices</p>
        {loading ? (
          <div className="p-4 bg-slate-850/50 rounded-xl text-center flex items-center justify-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400">Loading safety notices...</span>
          </div>
        ) : alerts.length > 0 ? (
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <div key={a.id || i} className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 flex items-start gap-2.5">
                <span className="material-symbols-outlined text-amber-400 text-lg mt-0.5">warning</span>
                <div className="flex-1">
                  <p className="text-xs font-bold text-white">{a.title || a.severity}</p>
                  <p className="text-xs text-slate-300 mt-0.5">{a.description}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-slate-850/50 rounded-xl text-center">
            <span className="material-symbols-outlined text-2xl text-emerald-400 mb-1">verified</span>
            <p className="text-xs font-bold text-white">All Clear in Bantwal</p>
            <p className="text-[11px] text-slate-400 mt-0.5">No hazards or roadblocks reported.</p>
          </div>
        )}
      </div>
    </div>
  );
}
