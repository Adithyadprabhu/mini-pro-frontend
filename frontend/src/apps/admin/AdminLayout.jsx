import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';

export default function AdminLayout({ basePath = '' }) {
  const { user, logout } = useAuth();

  const navItems = [
    { path: `${basePath}/`, icon: 'dashboard', label: 'Dashboard', exact: true },
    { path: `${basePath}/crime-risk-map`, icon: 'map', label: 'Crime Risk Map' },
    { path: `${basePath}/incidents`, icon: 'warning', label: 'Incidents' },
    { path: `${basePath}/police`, icon: 'local_police', label: 'Police Portal' },
    { path: `${basePath}/tourist-tracking`, icon: 'location_on', label: 'Tourist Tracking' },
    { path: `${basePath}/daily-checkins`, icon: 'fact_check', label: 'Safety Check-in' },
  ];

  return (
    <div className="min-h-screen bg-[#060b18] flex font-sans antialiased">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-[260px] bg-gradient-to-b from-[#0a1128] via-[#0a0f1e] to-[#070d1a] border-r border-white/[0.06] flex flex-col z-50">
        {/* Logo */}
        <div className="px-5 pt-6 pb-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <span className="material-symbols-outlined text-white text-xl">shield</span>
          </div>
          <div>
            <div className="text-white font-bold text-[15px] leading-tight tracking-tight">Tourist Guardian</div>
            <div className="text-emerald-400/60 text-[11px] font-medium">Admin Dashboard</div>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 mb-5">
          <div className="flex items-center gap-2 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl px-3 py-2.5 transition-colors cursor-pointer group">
            <span className="material-symbols-outlined text-slate-500 group-hover:text-slate-400 text-lg transition-colors">search</span>
            <span className="text-slate-500 text-xs">Search...</span>
            <div className="ml-auto flex items-center gap-0.5">
              <span className="text-slate-600 text-[10px] bg-white/[0.06] px-1.5 py-0.5 rounded-md font-medium">⌘</span>
              <span className="text-slate-600 text-[10px] bg-white/[0.06] px-1.5 py-0.5 rounded-md font-medium">K</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 overflow-y-auto">
          <div className="text-[10px] text-slate-600 uppercase tracking-[0.15em] font-semibold px-3 mb-2">
            Main Menu
          </div>
          <div className="space-y-0.5">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.exact}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 text-emerald-400 shadow-sm shadow-emerald-500/5'
                      : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                      isActive ? 'bg-emerald-500/20' : 'bg-white/[0.03]'
                    }`}>
                      <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                    </div>
                    <span>{item.label}</span>
                    {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />}
                  </>
                )}
              </NavLink>
            ))}
          </div>

        </nav>

        {/* User Card */}
        <div className="p-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-emerald-500/15">
              {user?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] text-white font-semibold truncate">{user?.name || 'Administrator'}</div>
              <div className="text-[11px] text-slate-500 truncate">{user?.email || 'admin@sentinel.local'}</div>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-lg hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-all"
              title="Log out"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="pl-[260px] flex-1 flex flex-col min-h-screen">
        {/* Header Bar */}
        <header className="h-16 bg-[#060b18]/80 backdrop-blur-xl border-b border-white/[0.06] flex items-center justify-between px-6 sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <h2 className="text-white/90 font-semibold text-[15px]">
              Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">{user?.name?.split(' ')[0] || 'Admin'}</span> 👋
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button className="relative p-2.5 rounded-xl hover:bg-white/[0.04] text-slate-500 hover:text-white transition-all">
              <span className="material-symbols-outlined text-xl">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-400 rounded-full ring-2 ring-[#060b18]" />
            </button>
            <button className="relative p-2.5 rounded-xl hover:bg-white/[0.04] text-slate-500 hover:text-white transition-all">
              <span className="material-symbols-outlined text-xl">mail</span>
            </button>
            <div className="w-px h-6 bg-white/[0.06] mx-1" />
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold cursor-pointer hover:shadow-lg hover:shadow-emerald-500/20 transition-all">
              {user?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-[#060b18]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
