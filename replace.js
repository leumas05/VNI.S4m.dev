const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.jsx', 'utf8');

code = code.replace(/'http:\/\/127\.0\.0\.1:3001\/api\/my-location'/g, '`${API_BASE}/api/my-location`');
code = code.replace(/'http:\/\/127\.0\.0\.1:3001\/api\/ping'/g, '`${API_BASE}/api/ping`');
code = code.replace(/http:\/\/localhost:3001/g, '${API_BASE}');
fs.writeFileSync('frontend/src/App.jsx', code);
