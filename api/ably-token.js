// Vercel serverless function for Ably Token Authentication
// Keeps ABLY_API_KEY server-side — client receives a short-lived token, never the master key

import Ably from 'ably';

export default async function handler(req, res) {
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
