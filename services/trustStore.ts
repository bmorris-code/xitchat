import { localStorageService } from './localStorageService';

export interface VerifiedPeer {
  pubkey: string; // identity pubkey hex (x||y)
  verifiedAt: number;
  label?: string;
}

const STORAGE_KEY = 'trusted_peers_v1';

function normalizePubkey(pubkey: string): string {
  return pubkey.replace(/^0x/i, '').toLowerCase();
}

async function loadMap(): Promise<Map<string, VerifiedPeer>> {
  const raw = await localStorageService.retrieveData(STORAGE_KEY);
  const list = Array.isArray(raw) ? (raw as VerifiedPeer[]) : [];
  const map = new Map<string, VerifiedPeer>();
  for (const item of list) {
    if (!item?.pubkey) continue;
    map.set(normalizePubkey(item.pubkey), { ...item, pubkey: normalizePubkey(item.pubkey) });
  }
  return map;
}

async function saveMap(map: Map<string, VerifiedPeer>): Promise<void> {
  await localStorageService.storeData(STORAGE_KEY, Array.from(map.values()));
}

export const trustStore = {
  async isVerified(pubkey: string): Promise<boolean> {
    const map = await loadMap();
    return map.has(normalizePubkey(pubkey));
  },

  async verify(pubkey: string, label?: string): Promise<void> {
    const map = await loadMap();
    const key = normalizePubkey(pubkey);
    map.set(key, { pubkey: key, verifiedAt: Date.now(), label });
    await saveMap(map);
  },

  async unverify(pubkey: string): Promise<void> {
    const map = await loadMap();
    map.delete(normalizePubkey(pubkey));
    await saveMap(map);
  },

  async list(): Promise<VerifiedPeer[]> {
    const map = await loadMap();
    return Array.from(map.values()).sort((a, b) => b.verifiedAt - a.verifiedAt);
  }
};

