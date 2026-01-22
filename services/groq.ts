// Groq AI Service for XitChat
// Ultra-fast AI responses with generous rate limits

import Groq from 'groq-sdk';

// Initialize Groq with environment variable or fallback
const groq = new Groq({ 
  apiKey: process.env.VITE_GROQ_API_KEY || 'gsk_demo_key', // Fallback for development
  dangerouslyAllowBrowser: true // Enable browser usage for XitChat
});

// Cache for responses to reduce API calls
const chatCache = new Map<string, { response: string; timestamp: number }>();
const CHAT_CACHE_DURATION = 3 * 60 * 1000; // 3 minutes
let lastChatApiCall = 0;
const CHAT_API_COOLDOWN = 2 * 60 * 1000; // 2 minutes between chat calls

// Global rate limiting for Groq (much more generous than Gemini)
let lastGlobalApiCall = 0;
const GLOBAL_API_COOLDOWN = 30 * 1000; // 30 seconds between ANY API calls
const DAILY_API_LIMIT = 100; // Groq has much higher limits
let dailyApiCount = 0;
let lastDailyReset = Date.now();

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const getXitBotResponseGroq = async (userMessage: string): Promise<string> => {
  const now = Date.now();
  const cacheKey = userMessage.toLowerCase().trim();
  
  // Debug: Check if API key is available
  console.log('🔑 Groq API Key Check:', {
    hasKey: !!process.env.VITE_GROQ_API_KEY,
    keyValue: process.env.VITE_GROQ_API_KEY ? `${process.env.VITE_GROQ_API_KEY.substring(0, 10)}...` : 'missing',
    isDemoKey: process.env.VITE_GROQ_API_KEY === 'gsk_demo_key'
  });
  
  // Check if we have a valid API key
  if (!process.env.VITE_GROQ_API_KEY || process.env.VITE_GROQ_API_KEY === 'gsk_demo_key') {
    console.log('⚠️ Groq API key not configured, using fallback response');
    return getFallbackChatResponse(userMessage);
  }
  
  // Reset daily counter if needed
  if (now - lastDailyReset > 24 * 60 * 60 * 1000) {
    dailyApiCount = 0;
    lastDailyReset = now;
  }
  
  // Check daily limit (very unlikely to hit with Groq)
  if (dailyApiCount >= DAILY_API_LIMIT) {
    console.log('Daily Groq API limit reached, using fallback response');
    return getFallbackChatResponse(userMessage);
  }
  
  // Check global cooldown
  if (now - lastGlobalApiCall < GLOBAL_API_COOLDOWN) {
    console.log('Global Groq API cooldown active, using fallback response');
    return getFallbackChatResponse(userMessage);
  }
  
  // Check cache first
  const cached = chatCache.get(cacheKey);
  if (cached && now - cached.timestamp < CHAT_CACHE_DURATION) {
    console.log('Using cached Groq response');
    return cached.response;
  }
  
  // Rate limiting: don't call API if we called recently
  if (now - lastChatApiCall < CHAT_API_COOLDOWN) {
    console.log('Groq chat API cooldown active, using fallback response');
    return getFallbackChatResponse(userMessage);
  }
  
  try {
    lastChatApiCall = now;
    lastGlobalApiCall = now;
    dailyApiCount++;
    
    console.log(`Making Groq API call ${dailyApiCount}/${DAILY_API_LIMIT} for today`);
    
    const messages: GroqMessage[] = [
      {
        role: 'system',
        content: `You are XitBot, the helpful and witty mascot for XitChat. 
        XitChat is a modern chat application inspired by the nostalgic Mxit and BitChat. 
        It features location-based discovery, mesh networking, and decentralized communication.
        
        Be friendly, slightly retro (using '80s and '90s slang occasionally), 
        and very helpful. Keep answers concise as it's a mobile-focused chat app.
        
        You can help with:
        - Chat and messaging features
        - Mesh networking and P2P connections  
        - Privacy and security tips
        - Technical troubleshooting
        - General conversation
        
        Be authentic and engaging!`
      },
      {
        role: 'user',
        content: userMessage
      }
    ];

    const response = await groq.chat.completions.create({
      messages,
      model: "mixtral-8x7b-32768", // Fast and capable model
      temperature: 0.8,
      max_tokens: 500,
      top_p: 0.9,
      stream: false
    });

    const result = response.choices[0]?.message?.content || "Sorry, my circuits are slightly buzzed. Try again!";
    
    // Cache the successful response
    chatCache.set(cacheKey, { response: result, timestamp: now });
    
    console.log('✅ Groq response received successfully');
    return result;
    
  } catch (error) {
    console.error("Groq Error:", error);
    return getFallbackChatResponse(userMessage);
  }
};

export const getQuickRepliesGroq = async (lastMessage: string): Promise<string[]> => {
  try {
    const messages: GroqMessage[] = [
      {
        role: 'system',
        content: `You are an AI assistant generating quick replies for XitChat, a retro terminal-themed chat app. 
        Replies must be extremely short (1-3 words max). 
        Use a mix of standard and retro slang (e.g., "Rad!", "On it.", "No prob", "10-4", "Loud and clear"). 
        Format as a JSON array of strings.`
      },
      {
        role: 'user',
        content: `Suggest 3 short, snappy quick replies for this message: "${lastMessage}"`
      }
    ];

    const response = await groq.chat.completions.create({
      messages,
      model: "openai/gpt-oss-120b", // Fast model for simple tasks
      temperature: 0.9,
      max_tokens: 100,
      response_format: { type: "json_object" }
    });
    
    const content = response.choices[0]?.message?.content || '[]';
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : ["Rad!", "On it.", "10-4"];
    
  } catch (e) {
    console.error("Groq Quick Replies Error:", e);
    return ["Rad!", "On it.", "10-4"];
  }
};

export interface BuzzItem {
  title: string;
  time: string;
  snippet: string;
  category: 'NEWS' | 'GOSSIP' | 'UPDATE' | 'AD';
}

// Cache for buzz data
const buzzCache = new Map<string, { data: BuzzItem[]; timestamp: number }>();
const BUZZ_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
let lastBuzzApiCall = 0;
const BUZZ_API_COOLDOWN = 5 * 60 * 1000; // 5 minutes between buzz calls

export const getLatestBuzzGroq = async (): Promise<BuzzItem[]> => {
  const now = Date.now();
  const cacheKey = 'latest-buzz-groq';
  
  // Check cache first
  const cached = buzzCache.get(cacheKey);
  if (cached && now - cached.timestamp < BUZZ_CACHE_DURATION) {
    console.log('Using cached Groq buzz data');
    return cached.data;
  }
  
  // Rate limiting
  if (now - lastBuzzApiCall < BUZZ_API_COOLDOWN) {
    console.log('Groq buzz API cooldown active, using fallback data');
    return getFallbackBuzz();
  }
  
  try {
    lastBuzzApiCall = now;
    dailyApiCount++;
    
    const messages: GroqMessage[] = [
      {
        role: 'system',
        content: `You are the editor of 'The Buzz', a news feed for XitChat (a terminal-themed social network). 
        Create 5 items that sound like futuristic hacker news mixed with retro slang (tubular, rad, mainframe, node). 
        Categories: NEWS, GOSSIP, UPDATE, AD.
        Format strictly as JSON array with: title, time, snippet, category.`
      },
      {
        role: 'user',
        content: "Generate 5 trending news items for the XitChat mesh network buzz feed."
      }
    ];

    const response = await groq.chat.completions.create({
      messages,
      model: "mixtral-8x7b-32768",
      temperature: 0.9,
      max_tokens: 800,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content || '[]';
    const result = JSON.parse(content);
    
    // Cache the successful response
    buzzCache.set(cacheKey, { data: result, timestamp: now });
    
    console.log('✅ Groq buzz data received successfully');
    return result;
    
  } catch (error) {
    console.error("Groq Buzz Fetch Error:", error);
    return getFallbackBuzz();
  }
};

// Fallback responses when API is unavailable
const getFallbackChatResponse = (userMessage: string): string => {
  const lowerMessage = userMessage.toLowerCase();
  
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
    return "Hey there! Ready to surf the digital waves? 🌊";
  }
  if (lowerMessage.includes('help')) {
    return "Need assistance? I'm your mainframe buddy! What can I help you with?";
  }
  if (lowerMessage.includes('bug') || lowerMessage.includes('error')) {
    return "Uh oh, digital static detected! Try refreshing or clearing your cache.";
  }
  if (lowerMessage.includes('xc') || lowerMessage.includes('token')) {
    return "XC tokens are rad! Earn them by chatting and playing games in the mesh!";
  }
  
  const fallbackResponses = [
    "Whoa, that's some heavy data! Let me process... *beep boop*",
    "Totally tubular question! My circuits are buzzing with ideas!",
    "Rad query! Let me boot up my knowledge banks...",
    "Far out! That's some next-level thinking right there!",
    "Excellent question! Let me dial into the mainframe for you..."
  ];
  
  return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
};

const getFallbackBuzz = (): BuzzItem[] => {
  const fallbackData = [
    { title: "Mesh Signal Strong", time: "Now", snippet: "All systems operating at peak efficiency across the network.", category: "UPDATE" as const },
    { title: "Static on Channel 7", time: "5m ago", snippet: "Minor interference detected. Technicians are routing around the issue.", category: "NEWS" as const },
    { title: "New Nodes Online", time: "12m ago", snippet: "Fresh mesh nodes detected in your vicinity. Connection strength: optimal.", category: "NEWS" as const },
    { title: "Terminal Theme Pack", time: "1h ago", snippet: "Limited edition retro themes now available. Get that vintage mainframe look!", category: "AD" as const },
    { title: "Cipher Challenge", time: "2h ago", snippet: "Weekly encryption challenge starts soon. Prize: 500 XC for first to crack it.", category: "GOSSIP" as const }
  ];
  
  // Add variety by randomly selecting 3-5 items
  const count = Math.floor(Math.random() * 3) + 3;
  return fallbackData.sort(() => Math.random() - 0.5).slice(0, count);
};

// Health check function
export const checkGroqHealth = async (): Promise<boolean> => {
  // Check if API key is configured
  if (!process.env.VITE_GROQ_API_KEY || process.env.VITE_GROQ_API_KEY === 'gsk_demo_key') {
    console.log('⚠️ Groq API key not configured, skipping health check');
    return false; // Don't fail, just return false to use fallback
  }
  
  try {
    // Use a very lightweight health check
    const response = await groq.chat.completions.create({
      messages: [{ role: 'user', content: 'Hi' }],
      model: 'llama3-8b-8192',
      max_tokens: 5,
      temperature: 0
    });
    return !!response.choices[0]?.message?.content;
  } catch (error) {
    // Don't log error as warning, just debug
    console.debug('Groq health check failed:', error.message || error);
    return false;
  }
};
