import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'sentinel.db');

export const db = new DatabaseSync(DB_PATH);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    badge_number TEXT,
    phone TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sos_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT,
    user_phone TEXT,
    latitude REAL,
    longitude REAL,
    location_name TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    assigned_unit TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    priority TEXT NOT NULL,
    severity INTEGER NOT NULL,
    location TEXT NOT NULL,
    zone TEXT NOT NULL,
    threat TEXT,
    unit TEXT,
    dispatched INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'OPEN',
    sos_id TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS geofence_alerts (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    type TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS daily_checkins (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT,
    user_email TEXT,
    user_phone TEXT,
    date TEXT NOT NULL,
    notification_sent_at TEXT NOT NULL,
    response_deadline TEXT NOT NULL,
    response_at TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    latitude REAL,
    longitude REAL,
    location_name TEXT,
    location_timestamp TEXT,
    is_live_location INTEGER NOT NULL DEFAULT 1,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    admin_alert_at TEXT,
    admin_acknowledged INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// Password utilities
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, expectedHash) {
  try {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
  } catch {
    return false;
  }
}

// Seed default administrative and tactical patrol accounts if not existing
function seedDefaultAccounts() {
  const checkUser = db.prepare('SELECT id FROM users WHERE email = ?');

  // Admin Account
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@yourdomain.com';
  const existingAdmin = checkUser.get(adminEmail);
  if (!existingAdmin) {
    const { salt, hash } = hashPassword(process.env.ADMIN_PASSWORD || 'Admin@Sentinel2026!');
    db.prepare(`
      INSERT INTO users (id, email, password_hash, salt, role, name, created_at)
      VALUES (?, ?, ?, ?, 'admin', 'Command Chief Administrator', ?)
    `).run('usr_admin_01', adminEmail, hash, salt, new Date().toISOString());
  }

  // Police Officer Account
  const policeEmail = process.env.POLICE_EMAIL || 'police@yourdomain.com';
  const existingPolice = checkUser.get(policeEmail);
  if (!existingPolice) {
    const { salt, hash } = hashPassword(process.env.POLICE_PASSWORD || 'Police@Sentinel2026!');
    db.prepare(`
      INSERT INTO users (id, email, password_hash, salt, role, name, badge_number, phone, created_at)
      VALUES (?, ?, ?, ?, 'police', 'Officer J. Vance', 'APD-504', '(404) 658-7054', ?)
    `).run('usr_police_01', policeEmail, hash, salt, new Date().toISOString());
  }
}

seedDefaultAccounts();

// User repository helpers
export function createUser({ email, password, role, name, badgeNumber = null, phone = null }) {
  const id = `usr_${crypto.randomUUID()}`;
  const { salt, hash } = hashPassword(password);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, email, password_hash, salt, role, name, badge_number, phone, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, email.toLowerCase().trim(), hash, salt, role, name.trim(), badgeNumber, phone, now);

  return { id, email: email.toLowerCase().trim(), role, name: name.trim(), badgeNumber, phone };
}

export function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
}

export function getUserById(id) {
  return db.prepare('SELECT id, email, role, name, badge_number as badgeNumber, phone, created_at as createdAt FROM users WHERE id = ?').get(id);
}

// Session helpers
export function createSession(userId, role) {
  const token = `tok_${crypto.randomBytes(32).toString('hex')}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  db.prepare(`
    INSERT INTO sessions (token, user_id, role, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(token, userId, role, expiresAt, now.toISOString());

  return { token, expiresAt };
}

export function validateSession(token) {
  if (!token) return null;
  const session = db.prepare(`
    SELECT s.*, u.email, u.name, u.badge_number as badgeNumber, u.phone
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')
  `).get(token);
  return session || null;
}

export function deleteSession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

// SOS requests
export function createSosRequest({ userId, userName, userPhone, latitude, longitude, locationName, notes }) {
  const sosId = `SOS-${Date.now().toString().slice(-6)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO sos_requests (id, user_id, user_name, user_phone, latitude, longitude, location_name, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
  `).run(sosId, userId, userName, userPhone, latitude || null, longitude || null, locationName || 'Atlanta Tourist Corridor', notes || 'Emergency Tourist SOS Request', now, now);

  // Automatically propagate as a Critical P-1 incident in CAD incident queue!
  const incidentId = `#INC-${new Date().getFullYear()}-${sosId.replace('SOS-', '')}`;
  db.prepare(`
    INSERT INTO incidents (id, title, priority, severity, location, zone, threat, dispatched, status, sos_id, created_at)
    VALUES (?, ?, 'critical', 98, ?, 'Zone 5 Tourist Hub', ?, 0, 'OPEN', ?, ?)
  `).run(
    incidentId,
    `TOURIST EMERGENCY SOS ACTIVATED: ${userName || 'Visitor'}`,
    locationName || 'Centennial Olympic Park Hub',
    `Direct SOS Signal from phone ${userPhone || 'Registered Device'}`,
    sosId,
    now
  );

  return { sosId, incidentId, status: 'ACTIVE', createdAt: now };
}

export function getActiveSosRequests() {
  return db.prepare('SELECT * FROM sos_requests ORDER BY datetime(created_at) DESC').all();
}

export function updateSosStatus(sosId, status, assignedUnit = null) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE sos_requests
    SET status = ?, assigned_unit = COALESCE(?, assigned_unit), updated_at = ?
    WHERE id = ?
  `).run(status, assignedUnit, now, sosId);

  // Synchronize with incidents
  if (status === 'DISPATCHED') {
    db.prepare('UPDATE incidents SET dispatched = 1, unit = COALESCE(?, unit) WHERE sos_id = ?').run(assignedUnit, sosId);
  } else if (status === 'RESOLVED') {
    db.prepare("UPDATE incidents SET status = 'RESOLVED' WHERE sos_id = ?").run(sosId);
  }
}

// Incidents
export function getAllIncidents() {
  return db.prepare('SELECT * FROM incidents ORDER BY datetime(created_at) DESC').all();
}

export function assignIncident(incidentId, unit) {
  db.prepare('UPDATE incidents SET dispatched = 1, unit = ? WHERE id = ?').run(unit, incidentId);
  // Synchronize with SOS if linked
  const inc = db.prepare('SELECT sos_id FROM incidents WHERE id = ?').get(incidentId);
  if (inc && inc.sos_id) {
    db.prepare("UPDATE sos_requests SET status = 'DISPATCHED', assigned_unit = ?, updated_at = ? WHERE id = ?")
      .run(unit, new Date().toISOString(), inc.sos_id);
  }
}

export function resolveIncident(incidentId) {
  db.prepare("UPDATE incidents SET status = 'RESOLVED' WHERE id = ?").run(incidentId);
  const inc = db.prepare('SELECT sos_id FROM incidents WHERE id = ?').get(incidentId);
  if (inc && inc.sos_id) {
    db.prepare("UPDATE sos_requests SET status = 'RESOLVED', updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), inc.sos_id);
  }
}

// Geofence alerts
export function createGeofenceAlert({ userId, type, location, description }) {
  const id = `GEO-${Date.now().toString().slice(-6)}`;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO geofence_alerts (id, user_id, type, location, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, type, location, description, now);
  return { id, type, location, description, createdAt: now };
}

export function getGeofenceAlerts() {
  return db.prepare('SELECT * FROM geofence_alerts ORDER BY datetime(created_at) DESC LIMIT 20').all();
}

// ─────────────────────────────────────────────────────────────
// DAILY SAFETY CHECK-IN & NON-RESPONSE MONITORING HELPERS
// ─────────────────────────────────────────────────────────────

export function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

export function createDailyCheckin({
  userId,
  userName = 'Registered Tourist',
  userEmail = '',
  userPhone = '',
  date = getTodayString(),
  responseDeadlineMinutes = 30,
  lastKnownLat = 12.8817,
  lastKnownLng = 75.0299,
  lastKnownLocationName = 'B.C. Road, Bantwal, Karnataka 574219',
  emergencyName = '',
  emergencyPhone = '',
}) {
  const id = `CHK-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
  const now = new Date();
  const sentAt = now.toISOString();
  const deadline = new Date(now.getTime() + responseDeadlineMinutes * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO daily_checkins (
      id, user_id, user_name, user_email, user_phone, date,
      notification_sent_at, response_deadline, status,
      latitude, longitude, location_name, location_timestamp, is_live_location,
      emergency_contact_name, emergency_contact_phone,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, 'PENDING',
      ?, ?, ?, ?, 0,
      ?, ?,
      ?, ?
    )
  `).run(
    id, userId, userName, userEmail, userPhone, date,
    sentAt, deadline,
    lastKnownLat, lastKnownLng, lastKnownLocationName, sentAt,
    emergencyName, emergencyPhone,
    sentAt, sentAt
  );

  return db.prepare('SELECT * FROM daily_checkins WHERE id = ?').get(id);
}

export function getActiveCheckinForUser(userId, date = getTodayString()) {
  return db.prepare(`
    SELECT * FROM daily_checkins
    WHERE user_id = ? AND date = ?
    ORDER BY datetime(created_at) DESC LIMIT 1
  `).get(userId, date);
}

export function initiateDailyCheckinsForAllTourists(responseDeadlineMinutes = 30) {
  const date = getTodayString();
  const tourists = db.prepare("SELECT * FROM users WHERE role = 'tourist'").all();
  const created = [];

  for (const tourist of tourists) {
    const existing = getActiveCheckinForUser(tourist.id, date);
    if (!existing) {
      const chk = createDailyCheckin({
        userId: tourist.id,
        userName: tourist.name || 'Adithya',
        userEmail: tourist.email,
        userPhone: tourist.phone || '+91 98765 43210',
        date,
        responseDeadlineMinutes,
        lastKnownLat: 12.8817 + (Math.random() - 0.5) * 0.015,
        lastKnownLng: 75.0299 + (Math.random() - 0.5) * 0.015,
        lastKnownLocationName: 'B.C. Road Area, Bantwal',
        emergencyName: 'Primary Emergency Contact',
        emergencyPhone: '+91 98765 43210',
      });
      created.push(chk);
    }
  }

  // Ensure demo tourists across different safety states for a full monitoring experience
  const sampleTourists = [
    {
      id: 'usr_demo_1',
      name: 'Adithya Prabhu',
      email: 'adithya@example.com',
      phone: '+91 98451 22334',
      status: 'SAFE',
      loc: 'B.C. Road Market Promenade',
      lat: 12.8820,
      lng: 75.0305,
      live: 1,
      emergencyName: 'Ramesh Prabhu (Father)',
      emergencyPhone: '+91 98450 11223',
    },
    {
      id: 'usr_demo_2',
      name: 'Rahul Sharma',
      email: 'rahul.sharma@example.com',
      phone: '+91 98450 12345',
      status: 'PENDING',
      loc: 'B.C. Road Bus Terminus',
      lat: 12.8825,
      lng: 75.0310,
      live: 1,
      emergencyName: 'Sunita Sharma (Spouse)',
      emergencyPhone: '+91 98450 67890',
    },
    {
      id: 'usr_demo_3',
      name: 'Priya Nair',
      email: 'priya.nair@example.com',
      phone: '+91 94480 33445',
      status: 'SAFE',
      loc: 'Dharmasthala Corridor Junction',
      lat: 12.8890,
      lng: 75.0250,
      live: 1,
      emergencyName: 'Anand Nair (Brother)',
      emergencyPhone: '+91 94480 99887',
    },
    {
      id: 'usr_demo_4',
      name: 'David Wilson',
      email: 'david.wilson@example.com',
      phone: '+91 99001 55667',
      status: 'NO_RESPONSE',
      loc: 'Panemangalore Heritage Stretch',
      lat: 12.8750,
      lng: 75.0150,
      live: 0,
      emergencyName: 'Sarah Wilson (Sister)',
      emergencyPhone: '+1 (404) 555-0144',
    },
    {
      id: 'usr_demo_5',
      name: 'Akira Tanaka',
      email: 'akira.tanaka@example.com',
      phone: '+91 98860 77889',
      status: 'HELP_REQUESTED',
      loc: 'Melkar Highway Intersection',
      lat: 12.8591,
      lng: 75.0555,
      live: 1,
      emergencyName: 'Kenji Tanaka (Father)',
      emergencyPhone: '+81 90-1234-5678',
    },
  ];

  const now = new Date();
  for (const s of sampleTourists) {
    const existing = db.prepare('SELECT id FROM daily_checkins WHERE user_id = ? AND date = ?').get(s.id, date);
    if (!existing) {
      const sentAt = new Date(now.getTime() - 25 * 60 * 1000).toISOString();
      const deadline = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
      const respAt = s.status === 'SAFE' || s.status === 'HELP_REQUESTED' ? new Date(now.getTime() - 10 * 60 * 1000).toISOString() : null;

      db.prepare(`
        INSERT INTO daily_checkins (
          id, user_id, user_name, user_email, user_phone, date,
          notification_sent_at, response_deadline, response_at, status,
          latitude, longitude, location_name, location_timestamp, is_live_location,
          emergency_contact_name, emergency_contact_phone,
          admin_alert_at, admin_acknowledged,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?,
          ?, 0,
          ?, ?
        )
      `).run(
        `CHK-${Date.now().toString().slice(-5)}-${Math.floor(Math.random() * 900 + 100)}`,
        s.id, s.name, s.email, s.phone, date,
        sentAt, deadline, respAt, s.status,
        s.lat, s.lng, s.loc, sentAt, s.live,
        s.emergencyName, s.emergencyPhone,
        s.status === 'NO_RESPONSE' || s.status === 'HELP_REQUESTED' ? sentAt : null,
        sentAt, sentAt
      );
    }
  }

  return getDailyCheckins(date);
}

export function respondToCheckin(checkinId, status, {
  latitude = null,
  longitude = null,
  locationName = null,
  isLiveLocation = 1,
  emergencyName = null,
  emergencyPhone = null,
  notes = null,
} = {}) {
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT * FROM daily_checkins WHERE id = ?').get(checkinId);
  if (!existing) return null;

  const finalLat = latitude !== null ? latitude : existing.latitude;
  const finalLng = longitude !== null ? longitude : existing.longitude;
  const finalLocName = locationName || existing.location_name;
  const finalEmergencyName = emergencyName || existing.emergency_contact_name;
  const finalEmergencyPhone = emergencyPhone || existing.emergency_contact_phone;

  let adminAlertAt = existing.admin_alert_at;
  if (status === 'HELP_REQUESTED' || status === 'NO_RESPONSE') {
    adminAlertAt = now;
  }

  db.prepare(`
    UPDATE daily_checkins
    SET status = ?,
        response_at = ?,
        latitude = ?,
        longitude = ?,
        location_name = ?,
        location_timestamp = ?,
        is_live_location = ?,
        emergency_contact_name = ?,
        emergency_contact_phone = ?,
        admin_alert_at = ?,
        notes = COALESCE(?, notes),
        updated_at = ?
    WHERE id = ?
  `).run(
    status,
    now,
    finalLat,
    finalLng,
    finalLocName,
    now,
    isLiveLocation ? 1 : 0,
    finalEmergencyName,
    finalEmergencyPhone,
    adminAlertAt,
    notes,
    now,
    checkinId
  );

  // If Help Requested or No Response, create or escalate to CAD incident queue
  if (status === 'HELP_REQUESTED') {
    const incId = `#INC-${new Date().getFullYear()}-HLP-${checkinId.slice(-4)}`;
    db.prepare(`
      INSERT INTO incidents (id, title, priority, severity, location, zone, threat, dispatched, status, sos_id, created_at)
      VALUES (?, ?, 'critical', 96, ?, 'B.C. Road Safety Hub', ?, 0, 'OPEN', ?, ?)
    `).run(
      incId,
      `DAILY SAFETY CHECK-IN HELP REQUESTED: ${existing.user_name}`,
      finalLocName || 'B.C. Road Corridor',
      `Tourist urgently pressed 'Request Help' during daily check-in. Contact: ${finalEmergencyPhone || existing.user_phone}`,
      checkinId,
      now
    );
  }

  return db.prepare('SELECT * FROM daily_checkins WHERE id = ?').get(checkinId);
}

export function checkAndExpireOverdueCheckins() {
  const overdueList = db.prepare(`
    SELECT * FROM daily_checkins
    WHERE status = 'PENDING' AND datetime(response_deadline) < datetime('now')
  `).all();

  const now = new Date().toISOString();
  const transitioned = [];

  for (const chk of overdueList) {
    db.prepare(`
      UPDATE daily_checkins
      SET status = 'NO_RESPONSE', admin_alert_at = ?, updated_at = ?
      WHERE id = ?
    `).run(now, now, chk.id);

    // Propagate urgent incident into incidents table
    const incId = `#INC-${new Date().getFullYear()}-NR-${chk.id.slice(-4)}`;
    db.prepare(`
      INSERT INTO incidents (id, title, priority, severity, location, zone, threat, dispatched, status, sos_id, created_at)
      VALUES (?, ?, 'critical', 88, ?, 'B.C. Road Safety Hub', ?, 0, 'OPEN', ?, ?)
    `).run(
      incId,
      `UNRESPONSIVE TOURIST SAFETY ALERT: ${chk.user_name}`,
      chk.location_name || 'Last known: B.C. Road',
      `Tourist failed to respond to evening safety check-in within designated window. Last GPS recorded at ${chk.location_timestamp || 'earlier today'}. Emergency contact: ${chk.emergency_contact_name || 'N/A'} (${chk.emergency_contact_phone || chk.user_phone})`,
      chk.id,
      now
    );

    transitioned.push(chk.id);
  }

  return transitioned;
}

export function getDailyCheckins(filterDate = null) {
  if (filterDate) {
    return db.prepare('SELECT * FROM daily_checkins WHERE date = ? ORDER BY datetime(created_at) DESC').all(filterDate);
  }
  return db.prepare('SELECT * FROM daily_checkins ORDER BY datetime(created_at) DESC').all();
}

export function acknowledgeCheckinAlert(checkinId) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE daily_checkins
    SET admin_acknowledged = 1, updated_at = ?
    WHERE id = ?
  `).run(now, checkinId);
  return db.prepare('SELECT * FROM daily_checkins WHERE id = ?').get(checkinId);
}

