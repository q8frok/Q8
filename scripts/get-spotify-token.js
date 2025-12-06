/**
 * Spotify Refresh Token Generator
 *
 * Run this script to get your SPOTIFY_REFRESH_TOKEN:
 *
 * 1. First, set your env variables or edit the values below
 * 2. Run: node scripts/get-spotify-token.js
 * 3. Open the URL in your browser
 * 4. After authorizing, you'll be redirected to localhost with a code
 * 5. Copy the code and paste it when prompted
 */

const http = require('http');
const https = require('https');
const readline = require('readline');

// Your Spotify credentials (from .env.local or edit here)
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || 'YOUR_CLIENT_ID';
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';
// Try 127.0.0.1 if localhost doesn't work
const REDIRECT_URI = 'http://127.0.0.1:8888/callback';

// Scopes needed for playback control
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-read-recently-played',
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('\n🎵 Spotify Refresh Token Generator\n');
  console.log('================================\n');

  // Check if credentials are set
  if (CLIENT_ID === 'YOUR_CLIENT_ID' || CLIENT_SECRET === 'YOUR_CLIENT_SECRET') {
    console.log('⚠️  Please set your Spotify credentials first!\n');
    console.log('Either:');
    console.log('  1. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables');
    console.log('  2. Or edit this script and replace YOUR_CLIENT_ID and YOUR_CLIENT_SECRET\n');
    console.log('Get your credentials at: https://developer.spotify.com/dashboard\n');
    rl.close();
    return;
  }

  // Build authorization URL
  const authUrl = 'https://accounts.spotify.com/authorize?' +
    new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
    }).toString();

  console.log('📋 Step 1: Add this redirect URI to your Spotify app:\n');
  console.log(`   ${REDIRECT_URI}\n`);
  console.log('   (In Spotify Dashboard → Your App → Settings → Redirect URIs)\n');

  await question('Press Enter when done...');

  console.log('\n📋 Step 2: Open this URL in your browser:\n');
  console.log(`   ${authUrl}\n`);
  console.log('   Authorize the app, then copy the "code" from the redirect URL.\n');
  console.log('   The URL will look like: http://localhost:8888/callback?code=XXXXXX\n');

  const code = await question('Paste the code here: ');

  if (!code.trim()) {
    console.log('❌ No code provided. Exiting.');
    rl.close();
    return;
  }

  console.log('\n🔄 Exchanging code for tokens...\n');

  // Exchange code for tokens
  const tokenData = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code.trim(),
    redirect_uri: REDIRECT_URI,
  });

  const authHeader = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  const options = {
    hostname: 'accounts.spotify.com',
    path: '/api/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authHeader}`,
    },
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try {
        const result = JSON.parse(data);

        if (result.error) {
          console.log('❌ Error:', result.error_description || result.error);
          rl.close();
          return;
        }

        console.log('✅ Success! Here are your tokens:\n');
        console.log('================================\n');
        console.log('Add this to your .env.local file:\n');
        console.log(`SPOTIFY_REFRESH_TOKEN=${result.refresh_token}\n`);
        console.log('================================\n');
        console.log('Note: The refresh token is long-lived and won\'t expire');
        console.log('unless you revoke access or change your password.\n');

        rl.close();
      } catch (e) {
        console.log('❌ Failed to parse response:', data);
        rl.close();
      }
    });
  });

  req.on('error', (e) => {
    console.log('❌ Request error:', e.message);
    rl.close();
  });

  req.write(tokenData.toString());
  req.end();
}

main();
