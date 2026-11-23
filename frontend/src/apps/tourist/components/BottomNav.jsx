import { useLanguage } from '../useLanguage';

export default function BottomNav({ activeTab, onTabChange, alertCount = 0 }) {
  const { t } = useLanguage();

  const tabs = [
    { id: 'home', icon: 'home', label: t.home },
    { id: 'map', icon: 'map', label: t.map },
    { id: 'routes', icon: 'alt_route', label: t.routes },
    { id: 'alerts', icon: 'notifications', label: t.alerts },
    { id: 'profile', icon: 'person', label: t.profile },
  ];

  return (
    <nav className="relative z-[9999] bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 w-full shrink-0 shadow-[0_-4px_24px_rgba(0,0,0,0.7)] select-none">
      <div className="flex items-stretch justify-around px-2 py-1.5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 min-h-[50px] transition-all relative cursor-pointer active:scale-95 ${
                isActive ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              )}
              <span className="relative">
                <span
                  className={`material-symbols-outlined text-2xl transition-transform ${isActive ? 'scale-110' : ''}`}
                >
                  {tab.icon}
                </span>
                {tab.id === 'alerts' && alertCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                )}
              </span>
              <span className={`text-[11px] mt-0.5 tracking-tight ${isActive ? 'text-cyan-400' : ''}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
