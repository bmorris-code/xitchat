
import express from "express";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

const PRESENCE_TTL = 30_000; // 30 seconds
const peers = new Map();

/**
 * Cleanup expired peers every 5s
 */
setInterval(() => {
  const now = Date.now();
  for (const [pubkey, data] of peers) {
    if (now - data.lastSeen > PRESENCE_TTL) {
      peers.delete(pubkey);
    }
  }
}, 5000);

/**
 * Presence ping
 */
app.post("/presence", (req, res) => {
  const { pubkey, caps, rooms, device } = req.body;
  if (!pubkey) return res.sendStatus(400);

  peers.set(pubkey, {
    pubkey,
    caps,
    rooms,
    device,
    lastSeen: Date.now()
  });

  // Return visible peers
  res.json({
    peers: [...peers.values()].filter(p => p.pubkey !== pubkey)
  });
});

app.listen(3001, () =>
  console.log("🟢 Presence beacon running on :3001")
);
