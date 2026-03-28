import { Type } from '@google/genai';

// Calls our server-side proxy — API key never reaches the client/APK.
const API_BASE = (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_API_BASE_URL : '') || '';

async function geminiFetch(body: object): Promise<any> {
  const res = await fetch(`${API_BASE}/api/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Proxy error ${res.status}`);
  const data = await res.json();
  // Normalise to a .text property matching the SDK response shape
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  return { text };
}

const chatCache = new Map<string, { response: string; timestamp: number }>();
const CHAT_CACHE_DURATION = 2 * 60 * 1000;
const DAILY_API_LIMIT = 500;
let dailyApiCount = 0;
let lastDailyReset = Date.now();

const SYSTEM_PROMPT = `You are XitBot, the helpful and witty mascot for XitChat.
XitChat is a modern chat application inspired by Mxit and BitChat.
Be friendly, slightly retro, concise, and practical for mobile chat.`;

const maybeResetDailyCounter = (now: number) => {
  if (now - lastDailyReset > 24 * 60 * 60 * 1000) {
    dailyApiCount = 0;
    lastDailyReset = now;
  }
};

export const getXitBotResponse = async (userMessage: string): Promise<string> => {
  const now = Date.now();
  const cacheKey = userMessage.toLowerCase().trim();

  maybeResetDailyCounter(now);
  if (dailyApiCount >= DAILY_API_LIMIT) return getFallbackChatResponse(userMessage);

  const cached = chatCache.get(cacheKey);
  if (cached && now - cached.timestamp < CHAT_CACHE_DURATION) return cached.response;

  try {
    dailyApiCount++;
    const response = await geminiFetch({
      model: 'gemini-1.5-flash-001',
      contents: userMessage,
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.8,
      topP: 0.9
    });

    const result = response.text || getFallbackChatResponse(userMessage);
    chatCache.set(cacheKey, { response: result, timestamp: now });
    return result;
  } catch (error) {
    return getFallbackChatResponse(userMessage);
  }
};

export const streamXitBotResponseGemini = async (
  userMessage: string,
  onToken: (token: string, fullText: string) => void
): Promise<string> => {
  const cacheKey = userMessage.toLowerCase().trim();
  const now = Date.now();

  const cached = chatCache.get(cacheKey);
  if (cached && now - cached.timestamp < CHAT_CACHE_DURATION) {
    onToken(cached.response, cached.response);
    return cached.response;
  }

  // Proxy doesn't support streaming — fetch full response then deliver as one token
  const result = await getXitBotResponse(userMessage);
  onToken(result, result);
  return result;
};

const getFallbackChatResponse = (userMessage: string): string => {
  const lowerMessage = userMessage.toLowerCase();
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) return 'Hey there! Ready to surf the digital waves?';
  if (lowerMessage.includes('help')) return "Need assistance? I'm your mainframe buddy! What can I help you with?";
  if (lowerMessage.includes('bug') || lowerMessage.includes('error')) return 'Uh oh, digital static detected! Try refreshing or clearing your cache.';
  if (lowerMessage.includes('xc') || lowerMessage.includes('token')) return 'XC tokens are rad! Earn them by chatting and playing games in the mesh!';

  const fallbackResponses = [
    "Whoa, that's some heavy data! Let me process...",
    'Totally tubular question! My circuits are buzzing with ideas!',
    'Rad query! Let me boot up my knowledge banks...',
    "Far out! That's some next-level thinking right there!",
    'Excellent question! Let me dial into the mainframe for you...'
  ];

  return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
};

export const getQuickReplies = async (lastMessage: string): Promise<string[]> => {
  try {
    const response = await geminiFetch({
      model: 'gemini-1.5-flash-001',
      contents: `Suggest 3 short, snappy quick replies for this message: "${lastMessage}"`,
      systemInstruction: `You generate quick replies for XitChat.
Replies must be extremely short (1-3 words max).
Format as a JSON array of strings.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    });
    return JSON.parse(response.text || '[]');
  } catch (error) {
    return ['Rad!', 'On it.', '10-4'];
  }
};

export interface BuzzItem {
  title: string;
  time: string;
  snippet: string;
  category: 'NEWS' | 'GOSSIP' | 'UPDATE' | 'AD';
}

const buzzCache = new Map<string, { data: BuzzItem[]; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000;
let lastApiCall = 0;
const API_COOLDOWN = 10 * 60 * 1000;

export const getLatestBuzz = async (): Promise<BuzzItem[]> => {
  const now = Date.now();
  const cacheKey = 'latest-buzz';
  const cached = buzzCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_DURATION) return cached.data;
  if (now - lastApiCall < API_COOLDOWN) return getFallbackBuzz();

  try {
    lastApiCall = now;
    const response = await geminiFetch({
      model: 'gemini-1.5-flash-001',
      contents: 'Generate 5 trending news items for the XitChat mesh network buzz feed.',
      systemInstruction: `Create 5 buzz items for XitChat.
Return JSON with fields title, time, snippet, category.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            time: { type: Type.STRING },
            snippet: { type: Type.STRING },
            category: { type: Type.STRING, enum: ['NEWS', 'GOSSIP', 'UPDATE', 'AD'] }
          },
          required: ['title', 'time', 'snippet', 'category']
        }
      }
    });

    const parsed = JSON.parse(response.text || '[]');
    const result = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.items)
        ? parsed.items
        : getFallbackBuzz();
    buzzCache.set(cacheKey, { data: result, timestamp: now });
    return result;
  } catch (error) {
    return getFallbackBuzz();
  }
};

const getFallbackBuzz = (): BuzzItem[] => {
  const fallbackData = [
    { title: 'Mesh Signal Stable', time: 'Now', snippet: 'System reports all nodes operating at peak efficiency.', category: 'UPDATE' as const },
    { title: 'Static on the Wire', time: '5m ago', snippet: 'Minor interference detected in Sector 7.', category: 'NEWS' as const },
    { title: 'Node Discovery Active', time: '12m ago', snippet: 'New mesh nodes detected nearby.', category: 'NEWS' as const },
    { title: 'Retro Terminal Pack', time: '1h ago', snippet: 'Limited edition terminal themes now available.', category: 'AD' as const },
    { title: 'Cipher Challenge', time: '2h ago', snippet: 'Weekly encryption challenge starts soon.', category: 'GOSSIP' as const }
  ];
  return fallbackData.sort(() => Math.random() - 0.5).slice(0, 4);
};
