import { useState, useEffect, useCallback } from 'react';
import * as touristApi from '../touristApi';

export default function DailySafetyCheckin() {
  const [checkin, setCheckin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [confirmHelp, setConfirmHelp] = useState(false);
  const [shareLocationConsent, setShareLocationConsent] = useState(true);
  const [currentCoords, setCurrentCoords] = useState(null);
  const [gpsActive, setGpsActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  // Fetch active check-in
  const loadCheckin = useCallback(async () => {
    try {
      const res = await touristApi.fetchActiveDailyCheckin();
      if (res?.activeCheckin) {
        setCheckin(res.activeCheckin);
      }
    } catch (err) {
      console.error('Failed to load daily safety checkin:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Request GPS with consent
  useEffect(() => {
    let active = true;
    if (shareLocationConsent && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (active) {
            setCurrentCoords({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
            setGpsActive(true);
          }
        },
        () => {
          if (active) setGpsActive(false);
        },
        { timeout: 6000, enableHighAccuracy: true }
      );
    }
    return () => { active = false; };
  }, [shareLocationConsent]);

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const res = await touristApi.fetchActiveDailyCheckin();
        if (active && res?.activeCheckin) {
          setCheckin(res.activeCheckin);
        }
      } catch (err) {
        console.error('Failed to load daily safety checkin:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    init();
    return () => { active = false; };
  }, []);

  // Response countdown timer
  useEffect(() => {
    if (!checkin || checkin.status !== 'PENDING' || !checkin.response_deadline) return;

    const updateTimer = () => {
      const diff = new Date(checkin.response_deadline) - new Date();
      if (diff <= 0) {
        setTimeLeft('Expired');
        loadCheckin();
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins}m ${secs < 10 ? '0' : ''}${secs}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [checkin, loadCheckin]);

  // Read saved emergency contact
  const getSavedEmergencyContact = () => {
    try {
      const raw = localStorage.getItem('tourist_emergency_contact');
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return { name: '', phone: '' };
  };

  const handleRespond = async (status) => {
    if (!checkin) return;
    setSubmitting(true);
    setFeedback(null);

    const emergency = getSavedEmergencyContact();
    const isLive = shareLocationConsent && gpsActive && currentCoords;

    try {
      const res = await touristApi.respondDailyCheckin({
        checkinId: checkin.id,
        status,
        latitude: isLive ? currentCoords.lat : 12.8817,
        longitude: isLive ? currentCoords.lng : 75.0299,
        locationName: isLive ? 'Live GPS Location (B.C. Road Sector)' : 'Last Known Location: B.C. Road Area',
        isLiveLocation: Boolean(isLive),
        emergencyName: emergency.name || checkin.emergency_contact_name || 'Primary Contact',
        emergencyPhone: emergency.phone || checkin.emergency_contact_phone || '+91 98765 43210',
      });

      if (res?.checkin) {
        setCheckin(res.checkin);
        setFeedback(res.message);
      }
    } catch (err) {
      setFeedback(err.message || 'Error transmitting your safety confirmation.');
    } finally {
      setSubmitting(false);
      setConfirmHelp(false);
    }
  };

  if (loading) return null;
  if (!checkin) return null;

  // 1. If tourist is already SAFE, show a clean, non-intrusive status pill
  if (checkin.status === 'SAFE') {
    return (
      <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-3.5 flex items-center justify-between text-xs shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">check_circle</span>
          </div>
          <div>
            <p className="font-bold text-white text-[13px]">Evening Safety Confirmed</p>
            <p className="text-[11px] text-emerald-300/80">
              {feedback || 'Your safety confirmation has been received. Have a safe evening!'}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-1 rounded-lg shrink-0">
          ● SAFE
        </span>
      </div>
    );
  }

  // 2. If tourist clicked HELP REQUESTED
  if (checkin.status === 'HELP_REQUESTED') {
    return (
      <div className="bg-rose-950/60 border border-rose-500/50 rounded-2xl p-4 text-xs shadow-lg space-y-2">
        <div className="flex items-center gap-2 text-rose-400 font-bold text-[13px]">
          <span className="material-symbols-outlined text-xl animate-pulse">emergency</span>
          <span>Emergency Assistance Requested</span>
        </div>
        <p className="text-slate-200 leading-relaxed text-[11px]">
          Bantwal Police and the emergency monitoring command have been alerted with your latest location and emergency contact details.
        </p>
        <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
          <span>Status: <strong className="text-rose-400">HELP REQUESTED</strong></span>
          <a href="tel:112" className="text-cyan-400 font-bold underline flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">call</span>
            Call 112 Directly
          </a>
        </div>
      </div>
    );
  }

  // 3. If deadline passed and tourist did NOT respond
  if (checkin.status === 'NO_RESPONSE') {
    return (
      <div className="bg-amber-950/50 border border-amber-500/40 rounded-2xl p-4 text-xs shadow-lg space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-[13px]">
            <span className="material-symbols-outlined text-xl">warning</span>
            <span>Check-in Window Elapsed</span>
          </div>
          <span className="text-[10px] font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-md">
            NO RESPONSE
          </span>
        </div>
        <p className="text-slate-300 leading-relaxed text-[11px]">
          You missed the safety confirmation deadline. An advisory was logged with local safety monitoring. Please confirm you are safe now:
        </p>
        <button
          onClick={() => handleRespond('SAFE')}
          disabled={submitting}
          className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow"
        >
          <span className="material-symbols-outlined text-base">check</span>
          <span>Confirm I am Safe Now</span>
        </button>
      </div>
    );
  }

  // 4. ACTIVE PENDING DAILY CHECK-IN NOTIFICATION (Default 8:00 PM evening check)
  return (
    <div className="bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border-2 border-cyan-500/40 rounded-3xl p-5 shadow-2xl relative overflow-hidden space-y-3.5 animate-fadeIn">
      {/* Glow accent */}
      <div className="absolute -top-12 -right-12 w-28 h-28 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30">
            <span className="material-symbols-outlined text-2xl">nights_stay</span>
          </div>
          <div>
            <span className="inline-block px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold uppercase tracking-wider">
              Daily Safety Check-in
            </span>
            <h3 className="text-sm font-bold text-white mt-0.5">
              Good evening! Please confirm that you are safe today.
            </h3>
          </div>
        </div>
      </div>

      {/* Deadline reminder countdown */}
      {timeLeft && (
        <div className="flex items-center justify-between px-3 py-2 bg-slate-800/80 rounded-xl border border-slate-700/60 text-[11px]">
          <span className="text-slate-300 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-cyan-400">timer</span>
            Response Window:
          </span>
          <span className="font-mono font-bold text-cyan-300">{timeLeft} remaining</span>
        </div>
      )}

      {/* Location privacy consent */}
      <div className="px-3 py-2 bg-slate-800/40 rounded-xl border border-slate-700/40 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className={`material-symbols-outlined text-base ${gpsActive ? 'text-emerald-400' : 'text-slate-400'}`}>
            {gpsActive ? 'my_location' : 'location_disabled'}
          </span>
          <span className="text-slate-300">
            {gpsActive ? 'Live GPS Active' : 'Last Known Location (GPS not live)'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShareLocationConsent(!shareLocationConsent)}
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border transition-colors ${
            shareLocationConsent
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-slate-700/60 border-slate-600 text-slate-400'
          }`}
        >
          {shareLocationConsent ? 'Sharing Enabled' : 'Sharing Disabled'}
        </button>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2.5 pt-1">
        <button
          onClick={() => handleRespond('SAFE')}
          disabled={submitting}
          className="py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {submitting ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span className="material-symbols-outlined text-lg">sentiment_satisfied</span>
              <span>I'm OK</span>
            </>
          )}
        </button>

        <button
          onClick={() => setConfirmHelp(true)}
          disabled={submitting}
          className="py-3 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-950/40 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-lg">emergency</span>
          <span>Request Help</span>
        </button>
      </div>

      {/* Confirmation Modal for Request Help */}
      {confirmHelp && (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-slate-900 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl border border-rose-500/50">
            <div className="w-14 h-14 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-3xl">emergency</span>
            </div>
            <h3 className="text-base font-bold text-white">Confirm Help Request</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              This will immediately alert the Bantwal safety monitoring command center with your location, identity, and emergency contacts.
            </p>
            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => setConfirmHelp(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRespond('HELP_REQUESTED')}
                disabled={submitting}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg"
              >
                Send Alert Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
