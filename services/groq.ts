// Groq AI Service for XitChat
// Real-time chat responses with optional streaming.

import Groq from 'groq-sdk';

const getClientEnv = (key: string): string => {
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
  const processEnv = typeof process !== 'undefined' ? (process as any).env : undefined;
  return metaEnv?.[key] || processEnv?.[key] || '';
};

const groqApiKey = getClientEnv('GROQ_API_KEY') || getClientEnv('GROQ_API_KEY');
console.log(' Groq API Key loaded:', !!groqApiKey, 'length:', groqApiKey?.length || 0);
const groq = groqApiKey
  ? new Groq({
      apiKey: groqApiKey,
      dangerouslyAllowBrowser: true
    })
  : null;

console.log(' Groq client initialized:', !!groq);

const SYSTEM_PROMPT = `You are XitBot, the helpful and witty mascot for XitChat.
XitChat is a modern chat application inspired by the nostalgic Mxit and BitChat.
It features location-based discovery, mesh networking, and decentralized communication.

Be friendly, slightly retro (using '80s and '90s slang occasionally),
and very helpful. Keep answers concise as it's a mobile-focused chat app.`;

const chatCache = new Map<string, { response: string; timestamp: number }>();
const CHAT_CACHE_DURATION = 3 * 60 * 1000;
let lastChatApiCall = 0;
const CHAT_API_COOLDOWN = 750;
let lastGlobalApiCall = 0;
const GLOBAL_API_COOLDOWN = 500;
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
  if (!groq) return getFallbackChatResponse(userMessage);

  const cacheKey = `chat_${userMessage.toLowerCase().trim()}`;
  maybeResetDailyCounter(now);
  if (dailyApiCount >= DAILY_API_LIMIT) return getFallbackChatResponse(userMessage);

  const cached = chatCache.get(cacheKey);
  if (cached && now - cached.timestamp < CHAT_CACHE_DURATION) return cached.response;

  if (now - lastGlobalApiCall < GLOBAL_API_COOLDOWN || now - lastChatApiCall < CHAT_API_COOLDOWN) {
    console.debug('Groq soft cooldown active');
  }

  try {
    lastChatApiCall = now;
    lastGlobalApiCall = now;
    dailyApiCount++;

    const response = await groq.chat.completions.create({
      messages: buildMessages(userMessage),
      model: 'llama-3.3-70b-versatile',
      temperature: 0.8,
      max_tokens: 500,
      top_p: 0.9,
      stream: false
    });

    const result = response.choices[0]?.message?.content || getFallbackChatResponse(userMessage);
    chatCache.set(cacheKey, { response: result, timestamp: now });
    return result;
  } catch (error) {
    console.error('Groq Error:', error);
    return getFallbackChatResponse(userMessage);
  }
};

export const streamXitBotResponseGroq = async (
  userMessage: string,
  onToken: (token: string, fullText: string) => void
): Promise<string> => {
  const now = Date.now();
  const cacheKey = `chat_${userMessage.toLowerCase().trim()}`;

  if (!groq) return getXitBotResponseGroq(userMessage);

  const cached = chatCache.get(cacheKey);
  if (cached && now - cached.timestamp < CHAT_CACHE_DURATION) {
    onToken(cached.response, cached.response);
    return cached.response;
  }

  try {
    lastChatApiCall = now;
    lastGlobalApiCall = now;
    dailyApiCount++;

    const stream = await groq.chat.completions.create({
      messages: buildMessages(userMessage),
      model: 'llama-3.3-70b-versatile',
      temperature: 0.8,
      max_tokens: 500,
      top_p: 0.9,
      stream: true
    });

    let fullText = '';
    for await (const chunk of stream as any) {
      const token = chunk?.choices?.[0]?.delta?.content || '';
      if (!token) continue;
      fullText += token;
      onToken(token, fullText);
    }

    if (!fullText.trim()) {
      fullText = getFallbackChatResponse(userMessage);
      onToken(fullText, fullText);
    }

    chatCache.set(cacheKey, { response: fullText, timestamp: now });
    return fullText;
  } catch (error: any) {
    console.error('Groq Stream Error:', error);
    // fallback on any error
    return getXitBotResponseGroq(userMessage);
  }
};

export const getQuickRepliesGroq = async (lastMessage: string): Promise<string[]> => {
  if (!groq) return ['Rad!', 'On it.', '10-4'];

  try {
    const response = await groq.chat.completions.create({
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
    console.error('Groq Quick Replies Error:', error);
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
  if (!groq) return getFallbackBuzz();

  try {
    lastBuzzApiCall = now;
    const response = await groq.chat.completions.create({
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
    console.error('Groq Buzz Fetch Error:', error);
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
  if (!groq) return false;
  try {
    const response = await groq.chat.completions.create({
      messages: [{ role: 'user', content: 'Hi' }],
      model: 'llama-3.1-8b-instant',
      max_tokens: 5,
      temperature: 0
    });
    return !!response.choices[0]?.message?.content;
  } catch (error) {
    console.debug('Groq health check failed:', (error as any)?.message || error);
    return false;
  }
};