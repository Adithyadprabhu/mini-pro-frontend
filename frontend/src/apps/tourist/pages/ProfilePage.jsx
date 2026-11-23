
import { useState } from 'react';
import { useAuth } from '../../../context/useAuth';
import { useLanguage } from '../useLanguage';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { lang, changeLanguage } = useLanguage();

  const [emergencyName, setEmergencyName] = useState(() => {
    try {
      const saved = localStorage.getItem('tourist_emergency_contact');
      if (saved) return JSON.parse(saved).name || '';
    } catch { /* ignore */ }
    return '';
  });

  const [emergencyPhone, setEmergencyPhone] = useState(() => {
    try {
      const saved = localStorage.getItem('tourist_emergency_contact');
      if (saved) return JSON.parse(saved).phone || '';
    } catch { /* ignore */ }
    return '';
  });

  const [contactSaved, setContactSaved] = useState(false);

  const saveEmergencyContact = () => {
    localStorage.setItem('tourist_emergency_contact', JSON.stringify({ name: emergencyName, phone: emergencyPhone }));
    setContactSaved(true);
    setTimeout(() => setContactSaved(false), 2000);
  };

  const initial = (user?.name || 'T')[0].toUpperCase();

  return (
    <div className="pb-24 px-4 pt-5 space-y-4 max-w-md mx-auto select-none">
      {/* 1. CLEAN PROFILE CARD */}
      <div className="bg-slate-900/90 rounded-3xl p-5 border border-slate-800 shadow-md flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center text-xl font-bold shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-white truncate">{user?.name || 'Tourist Traveler'}</h2>
          <p className="text-xs text-slate-400 truncate">{user?.email || 'tourist@sentinel.local'}</p>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Protected in B.C. Road
          </span>
        </div>
      </div>

      {/* 2. LANGUAGE PREFERENCE */}
      <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 shadow-md space-y-3">
        <p className="text-xs font-bold text-white">App Language / ಭಾಷೆ</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'en', label: 'English' },
            { id: 'kn', label: 'ಕನ್ನಡ' },
            { id: 'hi', label: 'हिन्दी' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => changeLanguage(item.id)}
              className={`py-2.5 rounded-xl text-center border text-xs font-semibold transition-all ${lang === item.id
                  ? 'bg-cyan-500/15 border-cyan-500 text-cyan-400 shadow-sm'
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-white'
                }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. EMERGENCY CONTACT */}
      <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 shadow-md space-y-3">
        <div>
          <p className="text-xs font-bold text-white">Emergency Contact</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Alerted if you press Emergency SOS</p>
        </div>

        <div className="space-y-2">
          <input
            type="text"
            value={emergencyName}
            onChange={(e) => setEmergencyName(e.target.value)}
            placeholder="Contact Name (Family / Friend)"
            className="w-full bg-slate-800 rounded-xl px-3 py-2 text-xs text-white border border-slate-700 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <input
            type="tel"
            value={emergencyPhone}
            onChange={(e) => setEmergencyPhone(e.target.value)}
            placeholder="Phone Number (+91...)"
            className="w-full bg-slate-800 rounded-xl px-3 py-2 text-xs text-white border border-slate-700 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={saveEmergencyContact}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            {contactSaved ? (
              <>
                <span className="material-symbols-outlined text-emerald-400 text-sm">check_circle</span>
                <span>Saved</span>
              </>
            ) : (
              <span>Save Contact</span>
            )}
          </button>
        </div>
      </div>

      {/* 4. SILENT AI SAFETY PROTECTION STATUS */}
      <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-400 text-lg">verified_user</span>
          <div>
            <p className="font-semibold text-white">AI Safety Guard Active</p>
            <p className="text-[10px] text-slate-400">All 6 safety systems protecting you in background</p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
          Active
        </span>
      </div>

      {/* 5. LOGOUT */}
      <button
        onClick={logout}
        className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-rose-400 rounded-2xl font-semibold text-xs border border-rose-500/20 transition-colors flex items-center justify-center gap-1.5"
      >
        <span className="material-symbols-outlined text-base">logout</span>
        <span>Sign Out</span>
      </button>
    </div>
  );
}
