const http = require('http');

const PORT = process.env.PORT || 3000;

// Store last 50 events in memory
const events = [];

const server = http.createServer((req, res) => {

  // ── CORS headers ──────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // ── POST /  — receive GPS data from SIM800L ───────────────────────────────
  if (req.method === 'POST' && req.url === '/') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        data._received = new Date().toISOString();
        events.unshift(data);
        if (events.length > 50) events.pop();
        console.log('[POST] Received:', JSON.stringify(data));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      } catch (e) {
        console.log('[POST] Invalid JSON:', body);
        res.writeHead(400);
        res.end('Bad JSON');
      }
    });
    return;
  }

  // ── GET /data  — return events as JSON (for dashboard) ───────────────────
  if (req.method === 'GET' && req.url === '/data') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(events));
    return;
  }

  // ── GET /  — live dashboard ───────────────────────────────────────────────
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sentinel+ Live Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #0d1117; color: #e6edf3; min-height: 100vh; }
    header { background: #161b22; border-bottom: 1px solid #30363d; padding: 16px 24px; display: flex; align-items: center; gap: 12px; }
    header h1 { font-size: 20px; color: #58a6ff; }
    .badge { background: #238636; color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: 600; }
    .container { padding: 24px; max-width: 900px; margin: 0 auto; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; }
    .card .label { font-size: 11px; color: #8b949e; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
    .card .value { font-size: 22px; font-weight: 700; color: #58a6ff; }
    .card .value.green { color: #3fb950; }
    .card .value.red { color: #f85149; }
    .card .value.yellow { color: #d29922; }
    table { width: 100%; border-collapse: collapse; background: #161b22; border: 1px solid #30363d; border-radius: 8px; overflow: hidden; }
    th { background: #21262d; padding: 10px 14px; text-align: left; font-size: 12px; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 10px 14px; border-top: 1px solid #21262d; font-size: 13px; }
    tr:hover td { background: #1c2128; }
    .fix-yes { color: #3fb950; font-weight: 600; }
    .fix-no { color: #f85149; }
    .maps-link { color: #58a6ff; text-decoration: none; font-size: 12px; }
    .maps-link:hover { text-decoration: underline; }
    .refresh { font-size: 12px; color: #8b949e; margin-bottom: 12px; }
    .empty { text-align: center; padding: 40px; color: #8b949e; }
  </style>
</head>
<body>
  <header>
    <h1>⬡ Sentinel+</h1>
    <span class="badge">LIVE</span>
    <span style="margin-left:auto;font-size:13px;color:#8b949e;" id="lastUpdate">Waiting for data...</span>
  </header>

  <div class="container">
    <div class="cards">
      <div class="card">
        <div class="label">Device</div>
        <div class="value" id="deviceId">—</div>
      </div>
      <div class="card">
        <div class="label">GPS Fix</div>
        <div class="value" id="gpsFix">—</div>
      </div>
      <div class="card">
        <div class="label">Satellites</div>
        <div class="value" id="sats">—</div>
      </div>
      <div class="card">
        <div class="label">Speed</div>
        <div class="value" id="speed">—</div>
      </div>
      <div class="card">
        <div class="label">Total Events</div>
        <div class="value green" id="total">0</div>
      </div>
    </div>

    <p class="refresh">Auto-refreshing every 10 seconds</p>

    <table>
      <thead>
        <tr>
          <th>Time (IST)</th>
          <th>Fix</th>
          <th>Latitude</th>
          <th>Longitude</th>
          <th>Speed</th>
          <th>Sats</th>
          <th>Map</th>
        </tr>
      </thead>
      <tbody id="tbody">
        <tr><td colspan="7" class="empty">No data yet — waiting for device...</td></tr>
      </tbody>
    </table>
  </div>

  <script>
    function load() {
      fetch('/data')
        .then(r => r.json())
        .then(events => {
          document.getElementById('total').textContent = events.length;
          if (events.length === 0) return;

          const latest = events[0];
          document.getElementById('deviceId').textContent = latest.device_id || '—';
          document.getElementById('gpsFix').textContent = latest.gps_fix ? 'YES' : 'NO';
          document.getElementById('gpsFix').className = 'value ' + (latest.gps_fix ? 'green' : 'red');
          document.getElementById('sats').textContent = latest.satellites ?? '—';
          document.getElementById('speed').textContent = (latest.speed_kmph ?? '—') + ' km/h';
          document.getElementById('lastUpdate').textContent = 'Last update: ' + new Date(latest._received).toLocaleTimeString();

          const rows = events.map(e => {
            const t = new Date(e._received).toLocaleTimeString();
            const fix = e.gps_fix ? '<span class="fix-yes">✓ YES</span>' : '<span class="fix-no">✗ NO</span>';
            const lat = e.lat ? e.lat.toFixed(6) : '—';
            const lng = e.lng ? e.lng.toFixed(6) : '—';
            const spd = (e.speed_kmph ?? '—') + ' km/h';
            const sats = e.satellites ?? '—';
            const map = e.gps_fix
              ? '<a class="maps-link" href="https://maps.google.com/?q=' + e.lat + ',' + e.lng + '" target="_blank">📍 View</a>'
              : '—';
            return '<tr><td>' + t + '</td><td>' + fix + '</td><td>' + lat + '</td><td>' + lng + '</td><td>' + spd + '</td><td>' + sats + '</td><td>' + map + '</td></tr>';
          }).join('');

          document.getElementById('tbody').innerHTML = rows;
        })
        .catch(e => console.error(e));
    }

    load();
    setInterval(load, 10000);
  </script>
</body>
</html>`);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log('Sentinel+ server running on port ' + PORT);
});
