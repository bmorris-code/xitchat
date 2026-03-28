// Groq AI Service for XitChat
// Calls our server-side proxy — API key never reaches the client/APK.

// For mobile builds VITE_API_BASE_URL points to the Vercel deployment URL.
// For web builds it is empty and the fetch uses a relative path.
const API_BASE = (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_API_BASE_URL : '') || '';

async function groqFetch(body: object): Promise<any> {
  const res = await fetch(`${API_BASE}/api/groq`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Proxy error ${res.status}`);
  return res.json();
}

const SYSTEM_PROMPT = `You are XitBot, the helpful and witty mascot for XitChat.
XitChat is a modern chat application inspired by the nostalgic Mxit and BitChat.
It features location-based discovery, mesh networking, and decentralized communication.

Be friendly, slightly retro (using '80s and '90s slang occasionally),
and very helpful. Keep answers concise as it's a mobile-focused chat app.`;

const chatCache = new Map<string, { response: string; timestamp: number }>();
const CHAT_CACHE_DURATION = 3 * 60 * 1000;
const DAILY_API_LIMIT = 2000;
let dailyApiCount = 0;
let lastDailyReset = Date.now();

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const maybeResetDailyCounter = (now: number) => {
  if (now - lastDailyReset > 24 * 60 * 60 * 1000) {
    dailyApiCount = 0;
    lastDailyReset = now;
  }
};

const buildMessages = (userMessage: string): GroqMessage[] => [
  { role: 'system', content: SYSTEM_PROMPT },
  { role: 'user', content: userMessage }
];

export const getXitBotResponseGroq = async (userMessage: string): Promise<string> => {
  const now = Date.now();
  const cacheKey = `chat_${userMessage.toLowerCase().trim()}`;
  maybeResetDailyCounter(now);
  if (dailyApiCount >= DAILY_API_LIMIT) return getFallbackChatResponse(userMessage);

  const cached = chatCache.get(cacheKey);
  if (cached && now - cached.timestamp < CHAT_CACHE_DURATION) return cached.response;

  try {
    dailyApiCount++;

    const response = await groqFetch({
      messages: buildMessages(userMessage),
      model: 'llama-3.3-70b-versatile',
      temperature: 0.8,
      max_tokens: 500,
      top_p: 0.9
    });

    const result = response.choices[0]?.message?.content || getFallbackChatResponse(userMessage);
    chatCache.set(cacheKey, { response: result, timestamp: now });
    return result;
  } catch (error) {
    return getFallbackChatResponse(userMessage);
  }
};

export const streamXitBotResponseGroq = async (
  userMessage: string,
  onToken: (token: string, fullText: string) => void
): Promise<string> => {
  const cacheKey = `chat_${userMessage.toLowerCase().trim()}`;
  const now = Date.now();

  const cached = chatCache.get(cacheKey);
  if (cached && now - cached.timestamp < CHAT_CACHE_DURATION) {
    onToken(cached.response, cached.response);
    return cached.response;
  }

  // Proxy doesn't support streaming — fetch full response then deliver as one token
  const result = await getXitBotResponseGroq(userMessage);
  onToken(result, result);
  return result;
};

export const getQuickRepliesGroq = async (lastMessage: string): Promise<string[]> => {
  try {
    const response = await groqFetch({
      messages: [
        {
          role: 'system',
          content: `You generate quick replies for XitChat. Replies must be 1-3 words. Return JSON array of strings.`
        },
        { role: 'user', content: `Suggest 3 short quick replies for: "${lastMessage}"` }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.9,
      max_tokens: 100,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content || '[]';
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : ['Rad!', 'On it.', '10-4'];
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
const BUZZ_CACHE_DURATION = 10 * 60 * 1000;
let lastBuzzApiCall = 0;
const BUZZ_API_COOLDOWN = 5 * 60 * 1000;

export const getLatestBuzzGroq = async (): Promise<BuzzItem[]> => {
  const now = Date.now();
  const cacheKey = 'latest-buzz-groq';

  const cached = buzzCache.get(cacheKey);
  if (cached && now - cached.timestamp < BUZZ_CACHE_DURATION) return cached.data;
  if (now - lastBuzzApiCall < BUZZ_API_COOLDOWN) return getFallbackBuzz();

  try {
    lastBuzzApiCall = now;
    const response = await groqFetch({
      messages: [
        { role: 'system', content: `Create 5 buzz items for XitChat as JSON array with title, time, snippet, category.` },
        { role: 'user', content: 'Generate 5 trending news items for the XitChat mesh network buzz feed.' }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.9,
      max_tokens: 800,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content || '[]';
    const parsed = JSON.parse(content);
    const result = Array.isArray(parsed) ? parsed : getFallbackBuzz();

    buzzCache.set(cacheKey, { data: result, timestamp: now });
    return result;
  } catch (error) {
    return getFallbackBuzz();
  }
};

const getFallbackChatResponse = (userMessage: string): string => {
  const lower = userMessage.toLowerCase();
  if (lower.includes('hello') || lower.includes('hi')) return 'Hey there! Ready to surf the digital waves?';
  if (lower.includes('help')) return "Need assistance? I'm your mainframe buddy! What can I help you with?";
  if (lower.includes('bug') || lower.includes('error')) return 'Uh oh, digital static detected! Try refreshing.';
  if (lower.includes('xc') || lower.includes('token')) return 'XC tokens are rad! Earn them by chatting and playing games in the mesh!';

  const responses = [
    "Whoa, that's some heavy data! Let me process...",
    'Totally tubular question! My circuits are buzzing with ideas!',
    'Rad query! Let me boot up my knowledge banks...',
    "Far out! That's some next-level thinking right there!",
    'Excellent question! Let me dial into the mainframe for you...'
  ];
  return responses[Math.floor(Math.random() * responses.length)];
};

const getFallbackBuzz = (): BuzzItem[] => {
  const fallbackData = [
    { title: 'Mesh Signal Strong', time: 'Now', snippet: 'All systems operating at peak efficiency.', category: 'UPDATE' as const },
    { title: 'Static on Channel 7', time: '5m ago', snippet: 'Minor interference detected. Routing around issue.', category: 'NEWS' as const },
    { title: 'New Nodes Online', time: '12m ago', snippet: 'Fresh mesh nodes detected nearby.', category: 'NEWS' as const },
    { title: 'Terminal Theme Pack', time: '1h ago', snippet: 'Limited edition retro themes now available.', category: 'AD' as const },
    { title: 'Cipher Challenge', time: '2h ago', snippet: 'Weekly challenge starts soon.', category: 'GOSSIP' as const }
  ];
  return fallbackData.sort(() => Math.random() - 0.5).slice(0, 4);
};

export const checkGroqHealth = async (): Promise<boolean> => {
  try {
    const response = await groqFetch({
      messages: [{ role: 'user', content: 'Hi' }],
      model: 'llama-3.1-8b-instant',
      max_tokens: 5,
      temperature: 0
    });
    return !!response.choices[0]?.message?.content;
  } catch (error) {
    return false;
  }
};