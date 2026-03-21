import { enhancedDiscovery, type DiscoveredPeer } from './enhancedDiscovery';
import { identityService } from './identityService';
import { releaseInfo } from './releaseInfo';
import { trustStore } from './trustStore';

export interface ContactInvitePayload {
  v: 1;
  type: 'xitchat-contact';
  id: string;
  name: string;
  handle: string;
  createdAt: number;
}

export interface ContactInviteUrls {
  encoded: string;
  deepLinkUrl: string;
  landingUrl: string;
  downloadUrl: string;
}

const INVITE_TYPE = 'xitchat-contact';
const CONNECT_PATH = '/connect.html';

const normalizeHandle = (handle: string) => {
  const trimmed = String(handle || '').trim();
  if (!trimmed) return '@user';
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
};

const encodeBase64Url = (input: string) => {
  const utf8 = new TextEncoder().encode(input);
  let binary = '';
  utf8.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const decodeBase64Url = (input: string) => {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const buildConnectPageUrl = (encoded: string, origin = window.location.origin) =>
  new URL(`${CONNECT_PATH}?c=${encodeURIComponent(encoded)}`, origin).toString();

export const parseInviteParamFromUrl = (inputUrl: string): string | null => {
  try {
    const url = new URL(inputUrl);
    return url.searchParams.get('c');
  } catch {
    return null;
  }
};

export const decodeContactInvite = (encoded: string): ContactInvitePayload => {
  const parsed = JSON.parse(decodeBase64Url(encoded)) as ContactInvitePayload;
  if (parsed?.type !== INVITE_TYPE || parsed?.v !== 1 || !parsed?.id) {
    throw new Error('Invalid XitChat contact invite');
  }

  return {
    ...parsed,
    handle: normalizeHandle(parsed.handle),
    name: parsed.name || 'XitChat User'
  };
};

export const encodeContactInvite = (payload: ContactInvitePayload) => encodeBase64Url(JSON.stringify(payload));

export const buildInviteUrls = (payload: ContactInvitePayload, origin = window.location.origin): ContactInviteUrls => {
  const encoded = encodeContactInvite(payload);
  const downloadUrl = new URL(releaseInfo.downloadPageUrl);
  downloadUrl.searchParams.set('c', encoded);

  return {
    encoded,
    deepLinkUrl: `xitchat://connect?c=${encodeURIComponent(encoded)}`,
    landingUrl: buildConnectPageUrl(encoded, origin),
    downloadUrl: downloadUrl.toString()
  };
};

export const buildMyContactInvite = async (): Promise<{ payload: ContactInvitePayload; urls: ContactInviteUrls; }> => {
  const pubKey = await identityService.getPublicKeyHex();
  const storedHandle = localStorage.getItem('xitchat_handle') || 'user';
  const name = localStorage.getItem('xitchat_name') || storedHandle || 'XitChat User';
  const payload: ContactInvitePayload = {
    v: 1,
    type: INVITE_TYPE,
    id: pubKey,
    name,
    handle: normalizeHandle(storedHandle),
    createdAt: Date.now()
  };

  return {
    payload,
    urls: buildInviteUrls(payload)
  };
};

export const createInviteQrImageUrl = (targetUrl: string, size = 280) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(targetUrl)}`;

const parseLegacyInviteJson = (input: string): ContactInvitePayload | null => {
  try {
    const parsed = JSON.parse(input);
    if ((parsed?.type === 'xitchat-identity' || parsed?.id) && parsed?.id) {
      return {
        v: 1,
        type: INVITE_TYPE,
        id: parsed.id,
        name: parsed.name || 'XitChat User',
        handle: normalizeHandle(parsed.handle || parsed.name || 'user'),
        createdAt: Number(parsed.timestamp) || Date.now()
      };
    }
  } catch {
    return null;
  }

  return null;
};

export const parseContactInviteInput = (input: string): ContactInvitePayload => {
  const trimmed = String(input || '').trim();
  if (!trimmed) {
    throw new Error('Missing contact invite data');
  }

  const inviteParam = parseInviteParamFromUrl(trimmed);
  if (inviteParam) {
    return decodeContactInvite(inviteParam);
  }

  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    try {
      return decodeContactInvite(trimmed);
    } catch {
      // Continue into legacy parsing below.
    }
  }

  const legacy = parseLegacyInviteJson(trimmed);
  if (legacy) {
    return legacy;
  }

  throw new Error('Invalid XitChat contact invite');
};

export const importContactInvite = async (input: string): Promise<DiscoveredPeer> => {
  const payload = parseContactInviteInput(input);
  await trustStore.verify(payload.id, payload.handle || payload.name);
  await enhancedDiscovery.addPeerManually({
    id: payload.id,
    name: payload.name,
    handle: payload.handle
  });
  await enhancedDiscovery.connectToPeer(payload.id);

  return {
    id: payload.id,
    name: payload.name,
    handle: payload.handle,
    discoveryMethod: 'qr-code',
    isConnected: true,
    lastSeen: Date.now()
  };
};
