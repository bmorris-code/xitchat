// Vercel serverless function for Ably Token Authentication
// Keeps ABLY_API_KEY server-side — client receives a short-lived token, never the master key

import Ably from 'ably';

const ALLOWED_ORIGINS = [
  'https://xitchat.vercel.app',
  'https://localhost',
  'capacitor://localhost',
  'http://localhost:5173',
  'http://localhost:4173',
];

function setCors(req, res) {
  const origin = req.headers.origin || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Realtime service not configured' });
  }

  try {
    const client = new Ably.Rest(apiKey);
    const tokenRequest = await client.auth.createTokenRequest({
      capability: { '*': ['publish', 'subscribe', 'presence', 'history'] },
      ttl: 3600 * 1000 // 1 hour
    });
    return res.status(200).json(tokenRequest);
  } catch (error) {
    return res.status(500).json({ error: 'Could not generate token' });
  }
}
