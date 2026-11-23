import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/useAuth';
import * as api from '../../services/api';

export default function PoliceDashboard() {
  const { user, logout } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [activeSosCount, setActiveSosCount] = useState(0);
  const [dutyStatus, setDutyStatus] = useState('AVAILABLE'); // 'AVAILABLE' | 'EN ROUTE' | 'ON SCENE'
  const [unitCallsign] = useState(user?.badgeNumber ? `UNIT-${user.badgeNumber}` : 'UNIT-504');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const loadIncidents = useCallback(async () => {
    try {
      const data = await api.fetchPoliceIncidents();
      if (data?.incidents) {
        setIncidents(data.incidents);
        setActiveSosCount(data.activeSosCount || 0);
      }
    } catch {
      // Standby
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const sync = async () => {
      try {
        const data = await api.fetchPoliceIncidents();
        if (isMounted && data?.incidents) {
          setIncidents(data.incidents);
          setActiveSosCount(data.activeSosCount || 0);
        }
      } catch {
        // Standby
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    sync();
    const interval = setInterval(sync, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleRespond = async (incidentId) => {
    try {
      await api.assignPoliceIncident(incidentId, unitCallsign);
      setDutyStatus('EN ROUTE');
      setToast({ title: 'DISPATCH ACCEPTED', body: `Unit ${unitCallsign} assigned to ${incidentId}. Route transmitted.` });
      await loadIncidents();
    } catch (err) {
      setToast({ title: 'ERROR', body: err.message || 'Failed to assign incident' });
    }
  };

  const handleResolve = async (incidentId) => {
    try {
      await api.resolvePoliceIncident(incidentId);
      setDutyStatus('AVAILABLE');
      setToast({ title: 'INCIDENT RESOLVED', body: `${incidentId} marked as cleared. Status synchronized with CAD stream.` });
      await loadIncidents();
    } catch (err) {
      setToast({ title: 'ERROR', body: err.message || 'Failed to resolve incident' });
    }
  };

  const filteredIncidents = incidents.filter((inc) => {
    if (filter === 'sos') return inc.sos_id || inc.title?.includes('SOS');
    if (filter === 'critical') return inc.priority === 'critical';
    if (filter === 'active') return inc.status !== 'RESOLVED';
    return true;
  });

  return (
    <div className="min-h-screen bg-surface flex flex-col font-mono text-on-surface select-none pb-12">
      {/* Tactical Police Header Bar */}
      <header className="bg-surface-container-low border-b-2 border-secondary/40 px-4 py-3 flex flex-wrap items-center justify-between gap-y-2 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-secondary/15 text-secondary flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-xl">local_police</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-grotesk text-base font-bold uppercase tracking-wider text-on-surface">
                BANTWAL POLICE CAD DISPATCH TERMINAL
              </span>
              <span className="px-1.5 py-0.5 bg-secondary text-on-secondary text-[9px] font-bold">
                B.C. ROAD SECTOR
              </span>
            </div>
            <div className="text-[10px] text-outline">
              OFFICER: {user?.name || 'Patrol Unit'} // CALLSIGN: {unitCallsign}
            </div>
          </div>
        </div>

        {/* Duty Status Selector & Sign Out */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-surface-container-lowest p-1 rounded">
            {['AVAILABLE', 'EN ROUTE', 'ON SCENE'].map((status) => (
              <button
                key={status}
                onClick={() => setDutyStatus(status)}
                className={`px-2 py-1 text-[9px] font-bold uppercase transition-colors ${
                  dutyStatus === status
                    ? status === 'AVAILABLE'
                      ? 'bg-secondary text-on-secondary'
                      : 'bg-primary text-on-primary'
                    : 'text-outline hover:text-on-surface'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <button
            onClick={logout}
            title="Log Out of Patrol"
            className="p-1.5 bg-surface-container hover:bg-surface-container-high text-outline hover:text-error transition-colors"
          >
            <span className="material-symbols-outlined text-base">logout</span>
          </button>
        </div>
      </header>

      {/* Toast Alert */}
      {toast && (
        <div className="m-4 p-3 bg-surface-container-high border-l-4 border-secondary text-xs flex items-center justify-between shadow-xl animate-fadeIn">
          <div>
            <span className="font-bold text-secondary uppercase mr-2">{toast.title}:</span>
            <span className="text-on-surface">{toast.body}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-outline text-xs">✕</button>
        </div>
      )}

      {/* Urgent Tourist SOS Banner */}
      {activeSosCount > 0 && (
        <div className="mx-4 mt-3 p-3 bg-tertiary-container/30 border-2 border-tertiary-container flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2 text-tertiary font-bold text-xs">
            <span className="material-symbols-outlined text-lg">emergency</span>
            <span>URGENT: {activeSosCount} ACTIVE TOURIST SOS REQUEST IN B.C. ROAD SECTOR</span>
          </div>
          <button
            onClick={() => setFilter('sos')}
            className="px-3 py-1 bg-tertiary-container text-on-tertiary-container text-[10px] font-bold uppercase"
          >
            View SOS Queue
          </button>
        </div>
      )}

      {/* Main Tactical Grid */}
      <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (7 cols): Live CAD Incident Stream */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="bg-surface-container-low p-3 border border-outline-variant/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-lg">broadcast_on_personal</span>
              <span className="font-grotesk text-sm font-bold uppercase text-on-surface">
                ACTIVE CAD INCIDENT STREAM
              </span>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-1 text-[9px]">
              {[
                { id: 'all', label: `ALL (${incidents.length})` },
                { id: 'sos', label: `SOS (${incidents.filter((i) => i.sos_id).length})` },
                { id: 'critical', label: 'CRITICAL' },
                { id: 'active', label: 'ACTIVE' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-2 py-0.5 uppercase font-bold transition-colors ${
                    filter === f.id
                      ? 'bg-secondary text-on-secondary'
                      : 'bg-surface-container-high text-outline hover:text-on-surface'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-secondary text-xs flex items-center justify-center gap-2">
              <span className="w-3 h-3 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
              <span>SYNCING WITH CAD 911 STREAM...</span>
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="p-12 bg-surface-container-low border border-outline-variant/30 text-center text-outline text-xs space-y-1">
              <span className="material-symbols-outlined text-3xl">done_all</span>
              <div className="font-bold uppercase">No Active CAD Incidents in Queue</div>
              <p className="text-[10px]">Zone 5 patrol sector is nominal. Standby on channel.</p>
            </div>
          ) : (
            filteredIncidents.map((inc) => (
              <div
                key={inc.id}
                className={`bg-surface-container-low p-4 border-l-4 space-y-2 ${
                  inc.priority === 'critical' ? 'border-tertiary-container' : 'border-secondary'
                }`}
              >
                <div className="flex items-center justify-between text-xs border-b border-outline-variant/20 pb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        inc.priority === 'critical' ? 'bg-tertiary-container animate-ping' : 'bg-secondary'
                      }`}
                    />
                    <span className="font-bold text-on-surface">{inc.id} // {inc.title}</span>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                      inc.priority === 'critical'
                        ? 'bg-tertiary-container text-on-tertiary-container'
                        : 'bg-secondary/20 text-secondary'
                    }`}
                  >
                    {inc.priority.toUpperCase()} P-1
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
                  <div>
                    <span className="text-outline uppercase">LOCATION:</span>
                    <div className="text-on-surface font-semibold">{inc.location}</div>
                  </div>
                  <div>
                    <span className="text-outline uppercase">ASSIGNED UNIT:</span>
                    <div className="text-primary font-bold">{inc.unit || 'UNASSIGNED'}</div>
                  </div>
                  <div>
                    <span className="text-outline uppercase">STATUS:</span>
                    <div className="text-secondary font-bold">{inc.status}</div>
                  </div>
                </div>

                {inc.threat && (
                  <div className="text-[10px] text-outline bg-surface-container p-2 rounded">
                    <span className="text-tertiary font-bold">THREAT: </span>
                    {inc.threat}
                  </div>
                )}

                {/* Actions */}
                <div className="pt-2 flex items-center justify-end gap-2 border-t border-outline-variant/20">
                  {inc.status !== 'RESOLVED' && (
                    <>
                      <button
                        onClick={() => handleRespond(inc.id)}
                        className="px-3 py-1.5 bg-secondary hover:bg-secondary-fixed text-on-secondary text-[10px] font-bold uppercase transition-colors"
                      >
                        Respond with {unitCallsign}
                      </button>
                      <button
                        onClick={() => handleResolve(inc.id)}
                        className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-variant text-on-surface text-[10px] font-bold uppercase transition-colors"
                      >
                        Clear / Resolved
                      </button>
                    </>
                  )}
                  {inc.status === 'RESOLVED' && (
                    <span className="text-[10px] text-outline font-bold">CLEARED ✓</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Column (5 cols): Tactical GIS Map & Patrol Status */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Tactical Sector Map */}
          <div className="bg-surface-container-low border border-outline-variant/30 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-grotesk font-bold uppercase text-on-surface">
                B.C. ROAD TACTICAL CAD GRID
              </span>
              <span className="text-[9px] text-outline">LIVE GPS MESH</span>
            </div>

            <div className="relative w-full h-64 bg-surface-container-lowest overflow-hidden flex items-center justify-center">
              <svg className="w-full h-full opacity-60" viewBox="0 0 500 250" fill="none">
                <rect fill="#090e1a" width="500" height="250" />
                <line x1="250" y1="0" x2="250" y2="250" stroke="#2f3445" strokeWidth="4" />
                <line x1="0" y1="125" x2="500" y2="125" stroke="#2f3445" strokeWidth="4" />
                <line x1="100" y1="30" x2="400" y2="220" stroke="#33394a" strokeWidth="2" />
                <text fill="#8c909f" fontFamily="JetBrains Mono" fontSize="9" x="260" y="25">NH-75 HIGHWAY</text>
                <text fill="#4cd7f6" fontFamily="JetBrains Mono" fontSize="9" x="10" y="115">B.C. ROAD CORRIDOR</text>
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center pointer-events-none">
                <span className="material-symbols-outlined text-secondary text-2xl mb-1">radar</span>
                <span className="text-xs font-bold text-on-surface uppercase">B.C. Road Active Patrol</span>
                <span className="text-[9px] text-outline">Bus Stand • Bantwal Town • Melkar Junction</span>
              </div>
            </div>
          </div>

          {/* Quick Dispatch Protocols */}
          <div className="bg-surface-container-low border border-outline-variant/30 p-4 space-y-2 text-xs">
            <div className="font-bold text-secondary uppercase">Officer Fast Protocol</div>
            <ul className="space-y-1.5 text-[11px] text-outline list-disc list-inside">
              <li>Tourist SOS signals take top priority over standard calls.</li>
              <li>Coordinate on-scene with Bantwal Traffic & Taluk Units on channel 4.</li>
              <li>Direct non-emergency tourists to the B.C. Road well-lit commercial corridor.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
