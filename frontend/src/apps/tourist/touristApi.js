const API_BASE = '/api';

async function fetchWithAuth(url, options = {}, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const token = localStorage.getItem('sentinel_auth_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(url, { ...options, headers, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

export async function fetchSafetyStatus() {
  try {
    const res = await fetchWithAuth(`${API_BASE}/tourist/safety-status`);
    return await res.json();
  } catch { return null; }
}

export async function fetchCrimeZones() {
  try {
    const res = await fetchWithAuth(`${API_BASE}/tourist/crime-zones`);
    return await res.json();
  } catch { return null; }
}

export async function fetchNearbyServices(lat, lng) {
  try {
    const params = lat != null ? `?lat=${lat}&lng=${lng}` : '';
    const res = await fetchWithAuth(`${API_BASE}/tourist/nearby-services${params}`);
    return await res.json();
  } catch { return null; }
}

export async function fetchSafetyAlerts() {
  try {
    const res = await fetchWithAuth(`${API_BASE}/tourist/alerts`);
    return await res.json();
  } catch { return { alerts: [] }; }
}

export async function triggerSOS(payload) {
  try {
    const res = await fetchWithAuth(`${API_BASE}/tourist/sos`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    console.error('SOS error:', err);
    throw err;
  }
}

export async function fetchSOSStatus() {
  try {
    const res = await fetchWithAuth(`${API_BASE}/tourist/sos/status`);
    return await res.json();
  } catch { return null; }
}

export async function fetchSafeRoutes(originLat, originLng, destLat, destLng) {
  try {
    const res = await fetchWithAuth(
      `${API_BASE}/tourist/safe-routes?originLat=${originLat}&originLng=${originLng}&destLat=${destLat}&destLng=${destLng}`
    );
    return await res.json();
  } catch { return null; }
}

export async function fetchGeofenceZones() {
  try {
    const res = await fetchWithAuth(`${API_BASE}/tourist/geofence-zones`);
    return await res.json();
  } catch { return null; }
}

export async function fetchProfile() {
  try {
    const res = await fetchWithAuth(`${API_BASE}/tourist/profile`);
    return await res.json();
  } catch { return null; }
}

export async function updateProfile(data) {
  try {
    const res = await fetchWithAuth(`${API_BASE}/tourist/profile`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch { return null; }
}

export async function classifyIncident(payload) {
  try {
    const res = await fetchWithAuth(`${API_BASE}/tourist/incident-classify`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch { return null; }
}

export async function fetchAssignedResponseUnit(lat, lng) {
  try {
    const params = lat != null ? `?lat=${lat}&lng=${lng}` : '';
    const res = await fetchWithAuth(`${API_BASE}/tourist/response-team${params}`);
    return await res.json();
  } catch { return null; }
}

export async function fetchRiskForecast() {
  try {
    const res = await fetchWithAuth(`${API_BASE}/tourist/risk-forecast`);
    return await res.json();
  } catch { return null; }
}

export async function fetchActiveDailyCheckin() {
  try {
    const res = await fetchWithAuth(`${API_BASE}/tourist/daily-checkin/active`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function respondDailyCheckin(payload) {
  try {
    const res = await fetchWithAuth(`${API_BASE}/tourist/daily-checkin/respond`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    console.error('Error in respondDailyCheckin:', err);
    throw err;
  }
}
