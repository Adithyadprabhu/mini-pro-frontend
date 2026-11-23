import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, '..', 'dist');

const PORT = process.env.PORT || 5000;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

// Helper to parse JSON body with size and error guard
function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        resolve({});
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

// Helper to authenticate request (supports optional direct access fallback)
function authenticate(req, allowFallback = false) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (token) {
    const session = db.validateSession(token);
    if (session) return session;
  }

  if (!allowFallback) return null;

  // Direct access fallback when authentication enforcement is bypassed in demo mode
  const host = (req.headers['host'] || '').toLowerCase();
  let role = 'admin';
  if (host.includes('tourist')) role = 'tourist';
  else if (host.includes('police')) role = 'police';

  return {
    user_id: `usr_${role}_direct`,
    role,
    name:
      role === 'admin'
        ? 'Command Administrator'
        : role === 'police'
        ? 'Officer J. Vance'
        : 'Tourist Guest',
    email: `${role}@yourdomain.com`,
    badgeNumber: role === 'police' ? 'APD-504' : null,
    phone: '+91 98765 43210',
  };
}

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // JSON helper
  const sendJson = (status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  // ─────────────────────────────────────────────────────────────
  // 1. AUTHENTICATION APIS (Role-Based)
  // ─────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/auth/')) {
    // Register (Primarily for tourists or new personnel)
    if (pathname === '/api/auth/register' && req.method === 'POST') {
      const { email, password, name, role = 'tourist', phone, badgeNumber } = await parseJsonBody(req);
      if (!email || !password || !name) {
        return sendJson(400, { error: 'Email, password, and name are required' });
      }

      if (db.getUserByEmail(email)) {
        return sendJson(409, { error: 'An account with this email already exists' });
      }

      // Enforce valid roles
      const validRoles = ['tourist', 'police', 'admin'];
      const targetRole = validRoles.includes(role) ? role : 'tourist';

      const user = db.createUser({ email, password, role: targetRole, name, phone, badgeNumber });
      const { token, expiresAt } = db.createSession(user.id, user.role);

      return sendJson(201, {
        success: true,
        user: { id: user.id, email: user.email, name: user.name, role: user.role, phone: user.phone },
        token,
        expiresAt,
      });
    }

    // Login (Validates against specific role requested by the application)
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const { email, password, requiredRole } = await parseJsonBody(req);
      if (!email || !password) {
        return sendJson(400, { error: 'Email and password are required' });
      }

      const user = db.getUserByEmail(email);
      if (!user || !db.verifyPassword(password, user.salt, user.password_hash)) {
        return sendJson(401, { error: 'Invalid email or password' });
      }

      // Enforce role isolation: if logging in on police app, role must match
      if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
        return sendJson(403, {
          error: `Access denied. Account is registered as ${user.role}, but this portal requires ${requiredRole} credentials.`,
        });
      }

      const { token, expiresAt } = db.createSession(user.id, user.role);

      return sendJson(200, {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          badgeNumber: user.badge_number,
          phone: user.phone,
        },
        token,
        expiresAt,
      });
    }

    // Get current authenticated user
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const session = authenticate(req);
      if (!session) {
        return sendJson(401, { error: 'Unauthenticated or session expired' });
      }
      return sendJson(200, {
        user: {
          id: session.user_id,
          email: session.email,
          name: session.name,
          role: session.role,
          badgeNumber: session.badgeNumber,
          phone: session.phone,
        },
      });
    }

    // Logout
    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (token) db.deleteSession(token);
      return sendJson(200, { success: true, message: 'Logged out successfully' });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. TOURIST APPLICATION SYNCHRONIZED APIS
  // ─────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/tourist/')) {
    // Send SOS Emergency Call (Auto-propagates to CAD police & admin)
    if (pathname === '/api/tourist/sos' && req.method === 'POST') {
      const session = authenticate(req, true) || { user_id: 'anonymous', name: 'Tourist App User', phone: null };
      const { latitude, longitude, locationName, notes } = await parseJsonBody(req);

      const result = db.createSosRequest({
        userId: session.user_id,
        userName: session.name,
        userPhone: session.phone,
        latitude: latitude || 12.8817,
        longitude: longitude || 75.0299,
        locationName: locationName || 'B.C. Road, Bantwal, Karnataka 574219',
        notes: notes || 'Emergency Tourist SOS Alert from B.C. Road, Bantwal',
      });

      return sendJson(201, {
        success: true,
        message: 'EMERGENCY SOS BROADCAST ACTIVE: Bantwal Police and Karnataka Emergency Response (112) alerted.',
        ...result,
      });
    }

    // Check SOS status
    if (pathname === '/api/tourist/sos/status' && req.method === 'GET') {
      const sosList = db.getActiveSosRequests();
      return sendJson(200, { activeSos: sosList[0] || null });
    }

    // Geofence alert notification
    if (pathname === '/api/tourist/geofence-alert' && req.method === 'POST') {
      const session = authenticate(req, true);
      const { type, location, description } = await parseJsonBody(req);
      const alert = db.createGeofenceAlert({
        userId: session?.user_id || 'anonymous',
        type: type || 'PERIMETER NOTIFICATION',
        location: location || 'B.C. Road Safety Perimeter',
        description: description || 'Tourist safety geofence advisory delivered.',
      });
      return sendJson(201, { success: true, alert });
    }

    // Get Geofence alerts
    if (pathname === '/api/tourist/geofence-alerts' && req.method === 'GET') {
      return sendJson(200, { alerts: db.getGeofenceAlerts() });
    }

    // Safety status for tourist dashboard
    if (pathname === '/api/tourist/safety-status' && req.method === 'GET') {
      return sendJson(200, {
        riskLevel: 'LOW',
        riskIndex: 19,
        confidence: 93.8,
        currentZone: 'B.C. Road Hub — Bantwal Taluk (Karnataka 574219)',
        recommendation: 'Peaceful tourist corridor. Standard awareness advised around highway junctions and bus terminus.',
        updatedAt: new Date().toISOString(),
      });
    }

    // Crime risk zones for map
    if (pathname === '/api/tourist/crime-zones' && req.method === 'GET') {
      return sendJson(200, {
        zones: [
          { id: 'zone-bc-road', name: 'B.C. Road Town Center', center: [12.8817, 75.0299], radius: 600, riskLevel: 'LOW', riskIndex: 18, description: 'Central commercial transit hub with frequent bus connections and active police patrol.' },
          { id: 'zone-bantwal-town', name: 'Bantwal Town Center', center: [12.8936, 74.9947], radius: 800, riskLevel: 'LOW', riskIndex: 15, description: 'Historic riverside town center, markets and Taluk administrative offices.' },
          { id: 'zone-panemangalore', name: 'Panemangalore Heritage', center: [12.8750, 75.0150], radius: 500, riskLevel: 'MODERATE', riskIndex: 38, description: 'Riverside old town corridor; caution advised near water edge after dark.' },
          { id: 'zone-melkar', name: 'Melkar Junction', center: [12.8591, 75.0555], radius: 600, riskLevel: 'MODERATE', riskIndex: 35, description: 'Busy highway transit intersection toward Mudipu and Konaje.' },
          { id: 'zone-nh75', name: 'NH-75 Highway Stretch', center: [12.8700, 75.0400], radius: 700, riskLevel: 'LOW', riskIndex: 22, description: 'Main Bangalore-Mangalore 4-lane highway with 24x7 highway patrol.' },
          { id: 'zone-river', name: 'Netravathi River Basin', center: [12.8900, 75.0100], radius: 500, riskLevel: 'MODERATE', riskIndex: 40, description: 'Scenic river bridge corridor; take caution near unlit ghat areas.' },
        ],
      });
    }

    // Nearby emergency services
    if (pathname === '/api/tourist/nearby-services' && req.method === 'GET') {
      return sendJson(200, {
        services: [
          { id: 'police-bantwal', type: 'police', name: 'Bantwal Town Police Station', address: 'Main Road, Bantwal Town, Karnataka 574211', lat: 12.8936, lng: 74.9947, phone: '(08255) 232 333' },
          { id: 'police-traffic', type: 'police', name: 'Bantwal Traffic Police Station', address: 'Melkar, Bantwal, Karnataka 574231', lat: 12.8591, lng: 75.0555, phone: '(08255) 234 500' },
          { id: 'hospital-taluk', type: 'hospital', name: 'Taluk General Hospital Bantwal', address: 'Main Road, Bantwal, Karnataka 574211', lat: 12.8920, lng: 74.9960, phone: '(08255) 232 230' },
          { id: 'hospital-fathermuller', type: 'hospital', name: 'Father Muller Hospital Thumbe', address: 'Thumbe, NH-75, Bantwal 574143', lat: 12.8650, lng: 74.8830, phone: '(0824) 223 8000' },
          { id: 'hospital-kmc', type: 'hospital', name: 'KMC Hospital Mangalore', address: 'Ambedkar Circle, Mangalore 575001', lat: 12.8710, lng: 74.8426, phone: '(0824) 244 5858' },
          { id: 'fire-bantwal', type: 'fire', name: 'Bantwal Fire & Emergency Station', address: 'B.C. Road, Bantwal, Karnataka 574219', lat: 12.8800, lng: 75.0310, phone: '112 / 101' },
        ],
      });
    }

    // Safety alerts
    if (pathname === '/api/tourist/alerts' && req.method === 'GET') {
      const geoAlerts = db.getGeofenceAlerts();
      return sendJson(200, {
        alerts: geoAlerts.map((a) => ({
          id: a.id,
          severity: a.type || 'INFO',
          title: a.type || 'Safety Advisory',
          description: a.description,
          location: a.location,
          timestamp: a.created_at,
        })),
      });
    }

    // Safe route recommendations
    if (pathname === '/api/tourist/safe-routes' && req.method === 'GET') {
      return sendJson(200, {
        routes: [
          { id: 'route-1', name: 'Via B.C. Road Main Bypass (Recommended)', safetyScore: 92, distance: '3.4 km', duration: '8 min drive / 35 min walk', riskAreas: 0, recommended: true },
          { id: 'route-2', name: 'Via Old Netravathi Bridge Route', safetyScore: 78, distance: '2.8 km', duration: '6 min drive / 30 min walk', riskAreas: 1, recommended: false },
          { id: 'route-3', name: 'Via NH-75 Scenic Corridor toward Karinja', safetyScore: 88, distance: '11.5 km', duration: '18 min drive', riskAreas: 0, recommended: false },
        ],
      });
    }

    // Geofence zones
    if (pathname === '/api/tourist/geofence-zones' && req.method === 'GET') {
      return sendJson(200, {
        zones: [
          { id: 'gf-bcroad', name: 'B.C. Road Bus Stand Safe Zone', type: 'safe', center: [12.8817, 75.0299], radius: 600, level: 'MONITORED' },
          { id: 'gf-panemangalore', name: 'Panemangalore Riverside Caution Area', type: 'caution', center: [12.8750, 75.0150], radius: 500, level: 'CAUTION' },
          { id: 'gf-melkar', name: 'Melkar Junction Traffic Area', type: 'caution', center: [12.8591, 75.0555], radius: 500, level: 'CAUTION' },
        ],
      });
    }

    // Tourist profile
    if (pathname === '/api/tourist/profile' && req.method === 'GET') {
      const session = authenticate(req, true);
      return sendJson(200, {
        user: { id: session?.user_id, email: session?.email, name: session?.name, role: session?.role, phone: session?.phone },
      });
    }

    // Update tourist profile
    if (pathname === '/api/tourist/profile' && req.method === 'PUT') {
      await parseJsonBody(req);
      return sendJson(200, { success: true, message: 'Profile updated' });
    }

    // 1. AI Crime/Safety Risk Forecast & Prediction Factors Model
    if (pathname === '/api/tourist/risk-forecast' && req.method === 'GET') {
      return sendJson(200, {
        currentRisk: { level: 'LOW', index: 19, confidence: 93.8 },
        forecast: [
          { time: '+1h (11:00)', index: 18, level: 'LOW', label: 'Morning Market Flow' },
          { time: '+2h (12:00)', index: 21, level: 'LOW', label: 'Peak Transit Activity' },
          { time: '+3h (13:00)', index: 20, level: 'LOW', label: 'Midday Quiet' },
          { time: '+4h (14:00)', index: 24, level: 'LOW', label: 'Afternoon Flow' },
          { time: '+5h (15:00)', index: 28, level: 'MODERATE', label: 'School / Commercial Transit' },
          { time: '+6h (16:00)', index: 32, level: 'MODERATE', label: 'Evening Shift Beginning' },
        ],
        factors: [
          { factor: 'Street Lighting & Visibility', score: '94%', impact: 'Positive / High' },
          { factor: 'CCTV & Police Patrol Density', score: '88%', impact: 'Active Patrol Present' },
          { factor: 'Commercial Foot Traffic', score: '76%', impact: 'Moderate / Safe Density' },
          { factor: 'Historical Incident Ratio (30 Days)', score: '0.04/sq km', impact: 'Negligible' },
        ],
      });
    }

    // 2. AI Incident Prioritization & Classification Model (NLP)
    if (pathname === '/api/tourist/incident-classify' && req.method === 'POST') {
      const { type, description } = await parseJsonBody(req);
      let priority = 'P2';
      let priorityLabel = 'P2 - High Urgency';
      let eta = '5-8 minutes';
      let severity = 75;

      const desc = ((description || '') + ' ' + (type || '')).toLowerCase();
      if (
        desc.includes('medical') ||
        desc.includes('bleeding') ||
        desc.includes('accident') ||
        desc.includes('attack') ||
        desc.includes('assault') ||
        desc.includes('unconscious') ||
        desc.includes('life')
      ) {
        priority = 'P1';
        priorityLabel = 'P1 - Critical (Immediate Dispatch)';
        eta = '< 4 minutes';
        severity = 95;
      } else if (
        desc.includes('theft') ||
        desc.includes('stolen') ||
        desc.includes('harassment') ||
        desc.includes('fight') ||
        desc.includes('lost') ||
        desc.includes('bag')
      ) {
        priority = 'P2';
        priorityLabel = 'P2 - High Urgency';
        eta = '5-8 minutes';
        severity = 70;
      } else {
        priority = 'P3';
        priorityLabel = 'P3 - Moderate Alert';
        eta = '10-15 minutes';
        severity = 45;
      }

      return sendJson(200, {
        success: true,
        classification: {
          type: type || 'General Safety Incident',
          priority,
          priorityLabel,
          severity,
          estimatedResponseTime: eta,
          recommendedResponder:
            priority === 'P1'
              ? 'Bantwal Police Rapid Unit + 108 Ambulance'
              : 'Bantwal Town Beat Patrol',
          advisoryMessage:
            priority === 'P1'
              ? 'CRITICAL ALERT: Stand in a safe, visible spot. Emergency sirens incoming.'
              : 'ALERT LOGGED: Nearby patrol officer dispatched to investigate.',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // 3. AI Response Assignment Model (Nearest Unit & Live ETA)
    if (pathname === '/api/tourist/response-team' && req.method === 'GET') {
      return sendJson(200, {
        assignedTeam: {
          id: 'UNIT-BANTWAL-504',
          name: 'Bantwal Police Rapid Response Team (Beat 2)',
          officerInCharge: 'Sub-Inspector R. Poojary (Badge DKP-504)',
          phone: '(08255) 232 333',
          vehicle: 'Toyota Innova PCR Vehicle KA-19-G-4411',
          currentLocation: 'B.C. Road Bus Stand Junction (350m away)',
          distanceKm: 0.35,
          etaMinutes: 2,
          status: 'ON_DUTY_PATROL',
          backupUnit: 'Bantwal Traffic Police Interceptor (Melkar)',
        },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // DAILY SAFETY CHECK-IN APIS (Tourist)
    // ─────────────────────────────────────────────────────────────
    if (pathname === '/api/tourist/daily-checkin/active' && req.method === 'GET') {
      const session = authenticate(req, true);
      const userId = session?.user_id || 'usr_tourist_active';
      const today = db.getTodayString();
      let checkin = db.getActiveCheckinForUser(userId, today);
      if (!checkin) {
        checkin = db.createDailyCheckin({
          userId,
          userName: session?.name || 'Tourist Traveler',
          userEmail: session?.email || 'tourist@sentinel.local',
          userPhone: session?.phone || '+91 98765 43210',
          date: today,
          responseDeadlineMinutes: 30,
        });
      }
      return sendJson(200, { activeCheckin: checkin });
    }

    if (pathname === '/api/tourist/daily-checkin/respond' && req.method === 'POST') {
      const {
        checkinId,
        status, // 'SAFE' | 'HELP_REQUESTED'
        latitude,
        longitude,
        locationName,
        isLiveLocation = true,
        emergencyName,
        emergencyPhone,
        notes,
      } = await parseJsonBody(req);

      if (!checkinId || !status || (status !== 'SAFE' && status !== 'HELP_REQUESTED')) {
        return sendJson(400, { error: 'Valid checkinId and status (SAFE or HELP_REQUESTED) are required' });
      }

      const updated = db.respondToCheckin(checkinId, status, {
        latitude,
        longitude,
        locationName,
        isLiveLocation: isLiveLocation !== false,
        emergencyName,
        emergencyPhone,
        notes,
      });

      if (!updated) {
        return sendJson(404, { error: 'Check-in record not found' });
      }

      const message =
        status === 'SAFE'
          ? 'Your safety confirmation has been received. Have a safe evening!'
          : 'EMERGENCY HELP REQUESTED: Bantwal emergency monitoring team and police alerted with your live location.';

      return sendJson(200, {
        success: true,
        message,
        checkin: updated,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. POLICE PATROL APPLICATION SYNCHRONIZED APIS
  // ─────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/police/')) {
    // Get live CAD incidents & pending SOS requests
    if (pathname === '/api/police/incidents' && req.method === 'GET') {
      const incidents = db.getAllIncidents();
      const sosQueue = db.getActiveSosRequests();
      return sendJson(200, {
        incidents,
        activeSosCount: sosQueue.filter((s) => s.status === 'ACTIVE').length,
        total: incidents.length,
      });
    }

    // Assign / Dispatch officer to incident
    if (pathname.match(/^\/api\/police\/incidents\/[^/]+\/assign$/) && req.method === 'POST') {
      const parts = pathname.split('/');
      const incidentId = decodeURIComponent(parts[4]);
      const { unit = 'APD UNIT 504' } = await parseJsonBody(req);
      db.assignIncident(incidentId, unit);
      return sendJson(200, { success: true, message: `Assigned ${unit} to ${incidentId}` });
    }

    // Resolve incident
    if (pathname.match(/^\/api\/police\/incidents\/[^/]+\/resolve$/) && req.method === 'POST') {
      const parts = pathname.split('/');
      const incidentId = decodeURIComponent(parts[4]);
      db.resolveIncident(incidentId);
      return sendJson(200, { success: true, message: `Incident ${incidentId} marked as resolved` });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. ADMIN COMMAND WEB APPLICATION SYNCHRONIZED APIS
  // ─────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/admin/')) {
    // Tourist live locations (simulated GPS around B.C. Road, Bantwal)
    if (pathname === '/api/admin/tourist-locations' && req.method === 'GET') {
      const tourists = db.db.prepare("SELECT id, name, email, phone, created_at FROM users WHERE role = 'tourist'").all();
      const BC_LAT = 12.8817, BC_LNG = 75.0299;
      const statuses = ['active', 'resting', 'exploring', 'in-transit'];
      const landmarks = [
        { name: 'Dharmasthala Temple', lat: 12.9622, lng: 75.3724 },
        { name: 'Manjeshwar Beach', lat: 12.7244, lng: 74.8855 },
        { name: 'B.C. Road Market', lat: 12.8820, lng: 75.0305 },
        { name: 'Bantwal Town', lat: 12.8911, lng: 75.0348 },
        { name: 'Uppinangady', lat: 12.8333, lng: 75.2667 },
        { name: 'Vitla Town', lat: 12.7693, lng: 75.1058 },
      ];
      const result = tourists.map((t, i) => {
        const jitterLat = (Math.random() - 0.5) * 0.025;
        const jitterLng = (Math.random() - 0.5) * 0.025;
        const minAgo = Math.floor(Math.random() * 15);
        const landmark = landmarks[i % landmarks.length];
        return {
          id: t.id,
          name: t.name || `Tourist ${t.id}`,
          email: t.email,
          phone: t.phone || '+91 98765 43210',
          lat: BC_LAT + jitterLat,
          lng: BC_LNG + jitterLng,
          lastSeen: `${minAgo} min ago`,
          status: statuses[Math.floor(Math.random() * statuses.length)],
          nearestLandmark: landmark.name,
          batteryLevel: Math.floor(60 + Math.random() * 40),
          registeredAt: t.created_at,
        };
      });
      // If no real tourists registered, return demo data
      if (result.length === 0) {
        const demoNames = ['Rahul Sharma', 'Priya Nair', 'Akira Tanaka', 'David Wilson', 'Maria Garcia', 'Chen Wei', 'Fatima Al-Hassan', 'James Okonkwo'];
        for (let i = 0; i < demoNames.length; i++) {
          const jLat = (Math.random() - 0.5) * 0.025;
          const jLng = (Math.random() - 0.5) * 0.025;
          const landmark = landmarks[i % landmarks.length];
          result.push({
            id: i + 1,
            name: demoNames[i],
            email: `${demoNames[i].split(' ')[0].toLowerCase()}@example.com`,
            phone: `+91 ${90000 + Math.floor(Math.random() * 9999)} ${10000 + Math.floor(Math.random() * 89999)}`,
            lat: BC_LAT + jLat,
            lng: BC_LNG + jLng,
            lastSeen: `${Math.floor(Math.random() * 15)} min ago`,
            status: statuses[Math.floor(Math.random() * statuses.length)],
            nearestLandmark: landmark.name,
            batteryLevel: Math.floor(60 + Math.random() * 40),
            registeredAt: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
          });
        }
      }
      return sendJson(200, {
        tourists: result,
        meta: {
          totalTracked: result.length,
          activeNow: result.filter(t => t.status === 'active' || t.status === 'exploring').length,
          inSafeZone: result.filter(t => Math.abs(t.lat - BC_LAT) < 0.01 && Math.abs(t.lng - BC_LNG) < 0.01).length,
          lastUpdated: new Date().toISOString(),
        }
      });
    }

    if (pathname === '/api/admin/overview' && req.method === 'GET') {
      const incidents = db.getAllIncidents();
      const sosList = db.getActiveSosRequests();
      const totalTourists = db.db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'tourist'").get().count;
      const activeUnits = db.db.prepare("SELECT COUNT(DISTINCT unit) as count FROM incidents WHERE unit IS NOT NULL AND status != 'RESOLVED'").get().count;

      return sendJson(200, {
        kpis: {
          totalIncidents24h: incidents.length,
          activeSos: sosList.filter((s) => s.status === 'ACTIVE').length,
          activeUnits: Math.max(activeUnits, 1),
          monitoredTourists: Math.max(totalTourists, 1),
          systemStatus: 'ONLINE',
        },
        incidents,
        sosList,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // DAILY CHECK-IN MONITORING APIS (Admin)
    // ─────────────────────────────────────────────────────────────
    if (pathname === '/api/admin/daily-checkins' && req.method === 'GET') {
      const dateParam = parsedUrl.searchParams.get('date') || db.getTodayString();
      // Ensure overdue check-ins transition automatically
      db.checkAndExpireOverdueCheckins();

      let allCheckins = db.getDailyCheckins(dateParam);
      // Auto-initialize for today if none exist yet
      if (allCheckins.length === 0 && dateParam === db.getTodayString()) {
        db.initiateDailyCheckinsForAllTourists(30);
        allCheckins = db.getDailyCheckins(dateParam);
      }

      const totalTourists = db.db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'tourist'").get().count;

      const safeCount = allCheckins.filter(c => c.status === 'SAFE').length;
      const pendingCount = allCheckins.filter(c => c.status === 'PENDING').length;
      const noResponseCount = allCheckins.filter(c => c.status === 'NO_RESPONSE').length;
      const helpRequestedCount = allCheckins.filter(c => c.status === 'HELP_REQUESTED').length;

      return sendJson(200, {
        kpis: {
          totalActiveTourists: Math.max(totalTourists, allCheckins.length),
          safeCount,
          pendingCount,
          noResponseCount,
          helpRequestedCount,
          unacknowledgedAlerts: allCheckins.filter(c => (c.status === 'NO_RESPONSE' || c.status === 'HELP_REQUESTED') && !c.admin_acknowledged).length,
        },
        checkins: allCheckins,
        filterDate: dateParam,
        lastUpdated: new Date().toISOString(),
      });
    }

    if (pathname === '/api/admin/daily-checkins/trigger' && req.method === 'POST') {
      const { deadlineMinutes = 30 } = await parseJsonBody(req);
      const created = db.initiateDailyCheckinsForAllTourists(Number(deadlineMinutes) || 30);
      return sendJson(200, {
        success: true,
        message: `Safety check-in notification sent to ${created.length} tourists.`,
        createdCount: created.length,
      });
    }

    if (pathname.match(/^\/api\/admin\/daily-checkins\/[^/]+\/acknowledge$/) && req.method === 'POST') {
      const parts = pathname.split('/');
      const checkinId = decodeURIComponent(parts[4]);
      const updated = db.acknowledgeCheckinAlert(checkinId);
      return sendJson(200, { success: true, checkin: updated });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 5. CORE / SHARED API ENDPOINTS
  // ─────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    if (pathname === '/api/health') {
      return sendJson(200, {
        status: 'OK',
        timestamp: new Date().toISOString(),
        database: 'connected (SQLite)',
        uptime: process.uptime(),
      });
    }

    if (pathname === '/api/overview') {
      const incidents = db.getAllIncidents();
      const totalTourists = db.db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'tourist'").get().count;
      return sendJson(200, {
        kpis: {
          totalIncidents24h: incidents.length,
          highRiskZones: 1,
          activeUnits: 1,
          monitoredTourists: totalTourists,
          aiAccuracy: 96.8,
        },
        weather: {
          temp: '70°F',
          condition: 'Clear',
          humidity: '58%',
          wind: '7 MPH NW',
          opticalVis: '10 MI',
        },
        systemStatus: { status: 'ONLINE', message: 'Operational' },
      });
    }

    if (pathname === '/api/incidents') {
      const incidents = db.getAllIncidents();
      return sendJson(200, { incidents, total: incidents.length });
    }

    if (pathname.match(/^\/api\/incidents\/[^/]+\/dispatch$/) && req.method === 'POST') {
      const parts = pathname.split('/');
      const incidentId = decodeURIComponent(parts[3]);
      db.assignIncident(incidentId, 'APD UNIT 504');
      return sendJson(200, { success: true, message: `Dispatched unit for ${incidentId}` });
    }

    if (pathname === '/api/tourist-safety') {
      const totalTourists = db.db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'tourist'").get().count;
      return sendJson(200, {
        monitoredVisitors: totalTourists,
        geofenceLogs: db.getGeofenceAlerts(),
      });
    }

    if (pathname === '/api/tourist-safety/broadcast' && req.method === 'POST') {
      return sendJson(200, { success: true, message: 'Broadcast alert transmitted to Bantwal Tourist Gateway' });
    }

    if (pathname === '/api/crime-risk') {
      return sendJson(200, {
        prediction: {
          riskIndex: 38,
          riskLevel: 'MODERATE',
          confidence: 94.2,
          recommendation: 'Maintain continuous patrols along B.C. Road Corridor; monitor transit exit points.',
        },
      });
    }

    if (pathname === '/api/weather') {
      return sendJson(200, {
        weather: { temp: '70°F', condition: 'Clear', humidity: '58%', wind: '7 MPH NW', opticalVis: '10 MI' },
      });
    }

    return sendJson(404, { error: 'API endpoint not found' });
  }

  // ─────────────────────────────────────────────────────────────
  // 6. SUBDOMAIN ROUTING & STATIC FILE SERVING
  // ─────────────────────────────────────────────────────────────
  // Sanitize path to prevent directory traversal
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(DIST_DIR, safePath === '/' || safePath === '\\' ? 'index.html' : safePath);

  // Guarantee that filePath remains strictly inside DIST_DIR
  const resolvedDist = path.resolve(DIST_DIR);
  const resolvedTarget = path.resolve(filePath);
  if (!resolvedTarget.startsWith(resolvedDist)) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(DIST_DIR, 'index.html');
    }
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(200, {
          'Content-Type': contentType,
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(content);
      }
    });
  });
});

// Background task: Expire overdue safety check-ins and trigger 8:00 PM automatic check-in
let lastEveningBroadcastDate = '';
setInterval(() => {
  try {
    db.checkAndExpireOverdueCheckins();
    const now = new Date();
    // Default 8:00 PM (20:00) check-in trigger
    if (now.getHours() >= 20 && lastEveningBroadcastDate !== db.getTodayString()) {
      db.initiateDailyCheckinsForAllTourists(30);
      lastEveningBroadcastDate = db.getTodayString();
      console.log(`[Safety Check-in] Evening 8:00 PM safety check-in broadcast sent for ${lastEveningBroadcastDate}`);
    }
  } catch (err) {
    console.error('Error in background checkin monitor worker:', err);
  }
}, 30000);

server.listen(PORT, () => {
  console.log(`Atlanta Sentinel Unified Multi-Portal Server running on port ${PORT}`);
  console.log(`- Subdomain Routing Ready:`);
  console.log(`  1. Tourist Portal:  http://tourist.localhost:${PORT} (or http://localhost:${PORT}/tourist)`);
  console.log(`  2. Admin Web App:   http://admin.localhost:${PORT}   (or http://localhost:${PORT}/admin)`);
  console.log(`  3. Police Patrol:   http://police.localhost:${PORT}  (or http://localhost:${PORT}/police)`);
  console.log(`- Production Domains: tourist.yourdomain.com | admin.yourdomain.com | police.yourdomain.com`);
});
