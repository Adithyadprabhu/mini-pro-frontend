const API_BASE = '/api';

/**
 * Async helper to fetch with a timeout using AbortController.
 */
async function fetchWithTimeout(url, options = {}, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  // Attach stored token if present
  const token = localStorage.getItem('sentinel_auth_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

// ─────────────────────────────────────────────────────────────
// 1. AUTHENTICATION SERVICES
// ─────────────────────────────────────────────────────────────
export async function login({ email, password, requiredRole }) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password, requiredRole }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }
    if (data.token) {
      localStorage.setItem('sentinel_auth_token', data.token);
      localStorage.setItem('sentinel_auth_user', JSON.stringify(data.user));
    }
    return data;
  } catch (err) {
    console.error('Error in login:', err);
    throw err;
  }
}

export async function register({ email, password, name, phone, badgeNumber, role = 'tourist' }) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/auth/register`, {
      method: 'POST',
      body: JSON.stringify({ email, password, name, phone, badgeNumber, role }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }
    if (data.token) {
      localStorage.setItem('sentinel_auth_token', data.token);
      localStorage.setItem('sentinel_auth_user', JSON.stringify(data.user));
    }
    return data;
  } catch (err) {
    console.error('Error in register:', err);
    throw err;
  }
}

export async function fetchCurrentUser() {
  try {
    const token = localStorage.getItem('sentinel_auth_token');
    if (!token) return null;

    const res = await fetchWithTimeout(`${API_BASE}/auth/me`);
    if (!res.ok) {
      localStorage.removeItem('sentinel_auth_token');
      localStorage.removeItem('sentinel_auth_user');
      return null;
    }
    const data = await res.json();
    return data.user;
  } catch (err) {
    console.error('Error in fetchCurrentUser:', err);
    return null;
  }
}

export async function logout() {
  try {
    await fetchWithTimeout(`${API_BASE}/auth/logout`, { method: 'POST' });
  } catch (err) {
    console.error('Error in logout:', err);
  } finally {
    localStorage.removeItem('sentinel_auth_token');
    localStorage.removeItem('sentinel_auth_user');
  }
}

// ─────────────────────────────────────────────────────────────
// 2. TOURIST SERVICES
// ─────────────────────────────────────────────────────────────
export async function triggerTouristSos(payload = {}) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/tourist/sos`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    console.error('Error in triggerTouristSos:', err);
    throw err;
  }
}

export async function fetchTouristSosStatus() {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/tourist/sos/status`);
    return await res.json();
  } catch (err) {
    console.error('Error in fetchTouristSosStatus:', err);
    return null;
  }
}

export async function sendGeofenceAlert(payload) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/tourist/geofence-alert`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    console.error('Error in sendGeofenceAlert:', err);
    return null;
  }
}

export async function fetchGeofenceAlerts() {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/tourist/geofence-alerts`);
    return await res.json();
  } catch (err) {
    console.error('Error in fetchGeofenceAlerts:', err);
    return { alerts: [] };
  }
}

// ─────────────────────────────────────────────────────────────
// 3. POLICE PATROL SERVICES
// ─────────────────────────────────────────────────────────────
export async function fetchPoliceIncidents() {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/police/incidents`);
    return await res.json();
  } catch (err) {
    console.error('Error in fetchPoliceIncidents:', err);
    return { incidents: [], activeSosCount: 0 };
  }
}

export async function assignPoliceIncident(incidentId, unit = 'APD UNIT 504') {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/police/incidents/${encodeURIComponent(incidentId)}/assign`, {
      method: 'POST',
      body: JSON.stringify({ unit }),
    });
    return await res.json();
  } catch (err) {
    console.error('Error in assignPoliceIncident:', err);
    throw err;
  }
}

export async function resolvePoliceIncident(incidentId) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/police/incidents/${encodeURIComponent(incidentId)}/resolve`, {
      method: 'POST',
    });
    return await res.json();
  } catch (err) {
    console.error('Error in resolvePoliceIncident:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// 4. ADMIN & CORE SERVICES
// ─────────────────────────────────────────────────────────────
export async function fetchAdminOverview() {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/admin/overview`);
    return await res.json();
  } catch (err) {
    console.error('Error in fetchAdminOverview:', err);
    return null;
  }
}

export async function fetchOverview() {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/overview`);
    return await res.json();
  } catch (err) {
    console.error('Error in fetchOverview:', err);
    return null;
  }
}

export async function fetchIncidents() {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/incidents`);
    return await res.json();
  } catch (err) {
    console.error('Error in fetchIncidents:', err);
    return null;
  }
}

export async function dispatchIncident(incidentId) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/incidents/${encodeURIComponent(incidentId)}/dispatch`, {
      method: 'POST',
    });
    return await res.json();
  } catch (err) {
    console.error(`Error in dispatchIncident for ${incidentId}:`, err);
    return null;
  }
}

export async function fetchTouristSafety() {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/tourist-safety`);
    return await res.json();
  } catch (err) {
    console.error('Error in fetchTouristSafety:', err);
    return null;
  }
}

export async function broadcastAlert(payload = {}) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/tourist-safety/broadcast`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    console.error('Error in broadcastAlert:', err);
    return null;
  }
}

export async function fetchCrimeRiskPrediction(_params) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/crime-risk`);
    return await res.json();
  } catch (err) {
    console.error('Error in fetchCrimeRiskPrediction:', err);
    return null;
  }
}

export async function fetchHealthCheck() {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/health`);
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchTouristLocations() {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/admin/tourist-locations`);
    if (!res.ok) return { tourists: [], meta: {} };
    return await res.json();
  } catch (err) {
    console.error('Error in fetchTouristLocations:', err);
    return { tourists: [], meta: {} };
  }
}

// ─────────────────────────────────────────────────────────────
// DAILY SAFETY CHECK-IN SERVICES
// ─────────────────────────────────────────────────────────────
export async function fetchActiveDailyCheckin() {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/tourist/daily-checkin/active`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('Error in fetchActiveDailyCheckin:', err);
    return null;
  }
}

export async function respondDailyCheckin(payload) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/tourist/daily-checkin/respond`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    console.error('Error in respondDailyCheckin:', err);
    throw err;
  }
}

export async function fetchAdminDailyCheckins(date = null) {
  try {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    const res = await fetchWithTimeout(`${API_BASE}/admin/daily-checkins${query}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('Error in fetchAdminDailyCheckins:', err);
    return null;
  }
}

export async function triggerDailyCheckins(deadlineMinutes = 30) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/admin/daily-checkins/trigger`, {
      method: 'POST',
      body: JSON.stringify({ deadlineMinutes }),
    });
    return await res.json();
  } catch (err) {
    console.error('Error in triggerDailyCheckins:', err);
    throw err;
  }
}

export async function acknowledgeDailyCheckinAlert(checkinId) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/admin/daily-checkins/${encodeURIComponent(checkinId)}/acknowledge`, {
      method: 'POST',
    });
    return await res.json();
  } catch (err) {
    console.error('Error in acknowledgeDailyCheckinAlert:', err);
    throw err;
  }
}

export default {
  API_BASE,
  login,
  register,
  fetchCurrentUser,
  logout,
  triggerTouristSos,
  fetchTouristSosStatus,
  sendGeofenceAlert,
  fetchGeofenceAlerts,
  fetchPoliceIncidents,
  assignPoliceIncident,
  resolvePoliceIncident,
  fetchAdminOverview,
  fetchOverview,
  fetchIncidents,
  dispatchIncident,
  fetchTouristSafety,
  broadcastAlert,
  fetchCrimeRiskPrediction,
  fetchHealthCheck,
  fetchTouristLocations,
  fetchActiveDailyCheckin,
  respondDailyCheckin,
  fetchAdminDailyCheckins,
  triggerDailyCheckins,
  acknowledgeDailyCheckinAlert,
};
