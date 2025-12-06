const fs = require('fs');
const https = require('https');
const path = require('path');

// Parse .env.local
const envPath = path.join(__dirname, '../apps/web/.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
});

const CLIENT_ID = envVars.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = envVars.SPOTIFY_CLIENT_SECRET;
const REFRESH_TOKEN = envVars.SPOTIFY_REFRESH_TOKEN;

console.log('\n🎵 Testing Spotify API...\n');
console.log('Client ID:', CLIENT_ID ? '✓ Set' : '✗ Missing');
console.log('Client Secret:', CLIENT_SECRET ? '✓ Set' : '✗ Missing');
console.log('Refresh Token:', REFRESH_TOKEN ? '✓ Set' : '✗ Missing');

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.log('\n❌ Missing credentials');
  process.exit(1);
}

// Get access token
const tokenData = new URLSearchParams({
  grant_type: 'refresh_token',
  refresh_token: REFRESH_TOKEN,
});

const auth = Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64');

const req = https.request({
  hostname: 'accounts.spotify.com',
  path: '/api/token',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': 'Basic ' + auth,
  },
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const result = JSON.parse(body);
    if (result.access_token) {
      console.log('\n✅ Token refresh successful!');

      // Now get current playback
      const playerReq = https.request({
        hostname: 'api.spotify.com',
        path: '/v1/me/player',
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + result.access_token,
        },
      }, (playerRes) => {
        if (playerRes.statusCode === 204) {
          console.log('\n⚠️  No active playback detected');
          console.log('   → Start playing something on Spotify (phone or desktop app)');
          console.log('   → Then refresh your dashboard\n');
        } else {
          let playerBody = '';
          playerRes.on('data', chunk => playerBody += chunk);
          playerRes.on('end', () => {
            try {
              const player = JSON.parse(playerBody);
              console.log('\n🎵 Now Playing:');
              console.log('   Track:', player.item?.name);
              console.log('   Artist:', player.item?.artists?.map(a => a.name).join(', '));
              console.log('   Album:', player.item?.album?.name);
              console.log('   Playing:', player.is_playing ? 'Yes ▶️' : 'Paused ⏸️');
              console.log('\n✅ Spotify API is working! The widget should show this track.\n');
            } catch(e) {
              console.log('Player response:', playerBody);
            }
          });
        }
      });
      playerReq.end();
    } else {
      console.log('\n❌ Token error:', result);
    }
  });
});
req.write(tokenData.toString());
req.end();
