const http = require('http');

const endpoints = [
  '/api/health',
  '/api/overview',
  '/api/incidents',
  '/api/admin/overview',
  '/api/admin/tourist-locations',
  '/api/police/incidents',
  '/api/tourist/safety-status',
  '/api/tourist/risk-forecast',
  '/api/tourist/geofence-zones',
  '/api/tourist/crime-zones',
  '/api/tourist/nearby-services',
  '/api/tourist/safe-routes?originLat=12.8817&originLng=75.0299&destLat=12.89&destLng=75.00',
  '/api/tourist/daily-checkin/active',
  '/api/admin/daily-checkins',
  '/',
  '/admin',
  '/tourist',
  '/police',
  '/../../package.json'
];

async function run() {
  console.log('--- AUDIT VERIFICATION RUNNER ---');
  let failures = 0;
  for (const ep of endpoints) {
    await new Promise((resolve) => {
      http.get('http://localhost:5000' + ep, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (ep === '/../../package.json') {
            const isSafe = !data.includes('cmini-projectatlanta-sentinel');
            if (isSafe) {
              console.log('[PASS - SECURE] Path traversal attack was safely prevented.');
            } else {
              console.log('[FAIL] Directory traversal vulnerability detected!');
              failures++;
            }
          } else {
            const ok = res.statusCode >= 200 && res.statusCode < 400;
            if (ok) {
              console.log(`[PASS] ${ep} -> HTTP ${res.statusCode} (${data.length} bytes)`);
            } else {
              console.log(`[FAIL] ${ep} -> HTTP ${res.statusCode}`);
              failures++;
            }
          }
          resolve();
        });
      }).on('error', (err) => {
        console.log(`[FAIL] ${ep} -> Error: ${err.message}`);
        failures++;
        resolve();
      });
    });
  }
  console.log(`--- FINISHED: ${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECKS FAILED'} ---`);
  process.exit(failures === 0 ? 0 : 1);
}

run();
