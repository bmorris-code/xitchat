
import { GoogleGenAI, Type } from "@google/genai";

// Fix: initialized GoogleGenAI strictly using process.env.GEMINI_API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Cache for chat responses to reduce API calls
const chatCache = new Map<string, { response: string; timestamp: number }>();
const CHAT_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
let lastChatApiCall = 0;
const CHAT_API_COOLDOWN = 30 * 1000; // 30 seconds between chat calls

export const getXitBotResponse = async (userMessage: string) => {
  const now = Date.now();
  const cacheKey = userMessage.toLowerCase().trim();
  
  // Check cache first
  const cached = chatCache.get(cacheKey);
  if (cached && now - cached.timestamp < CHAT_CACHE_DURATION) {
    console.log('Using cached chat response');
    return cached.response;
  }
  
  // Rate limiting: don't call API if we called recently
  if (now - lastChatApiCall < CHAT_API_COOLDOWN) {
    console.log('Chat API cooldown active, using fallback response');
    return getFallbackChatResponse(userMessage);
  }
  
  try {
    lastChatApiCall = now;
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: userMessage,
      config: {
        systemInstruction: `You are XitBot, the helpful and witty mascot for XitChat. 
        XitChat is a modern chat application inspired by the nostalgic Mxit and BitChat. 
        It features location-based discovery. Be friendly, slightly retro (using '80s and '90s slang occasionally), 
        and very helpful. Keep answers concise as it's a mobile-focused chat app.`,
        temperature: 0.8,
        topP: 0.9,
      }
    });

    const result = response.text || "Sorry, my circuits are slightly buzzed. Try again!";
    
    // Cache the successful response
    chatCache.set(cacheKey, { response: result, timestamp: now });
    
    return result;
  } catch (error) {
    console.error("Gemini Error:", error);
    return getFallbackChatResponse(userMessage);
  }
};

// Fallback chat responses when API is unavailable
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

export const getQuickReplies = async (lastMessage: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Suggest 3 short, snappy quick replies for this message: "${lastMessage}"`,
      config: {
        systemInstruction: `You are an AI assistant generating quick replies for XitChat, a retro terminal-themed chat app. 
        Replies must be extremely short (1-3 words max). 
        Use a mix of standard and retro slang (e.g., "Rad!", "On it.", "No prob", "10-4", "Loud and clear"). 
        Format as a JSON array of strings.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  } catch (e) {
    console.error("Quick Replies Error:", e);
    return ["Rad!", "On it.", "10-4"];
  }
};

export interface BuzzItem {
  title: string;
  time: string;
  snippet: string;
  category: 'NEWS' | 'GOSSIP' | 'UPDATE' | 'AD';
}

// Cache for API responses to reduce calls
const buzzCache = new Map<string, { data: BuzzItem[]; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let lastApiCall = 0;
const API_COOLDOWN = 60 * 1000; // 1 minute between calls

export const getLatestBuzz = async (): Promise<BuzzItem[]> => {
  const now = Date.now();
  const cacheKey = 'latest-buzz';
  
  // Check cache first
  const cached = buzzCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_DURATION) {
    console.log('Using cached buzz data');
    return cached.data;
  }
  
  // Rate limiting: don't call API if we called recently
  if (now - lastApiCall < API_COOLDOWN) {
    console.log('API cooldown active, using fallback data');
    return getFallbackBuzz();
  }
  
  try {
    lastApiCall = now;
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Generate 5 trending news items for the XitChat mesh network buzz feed.",
      config: {
        systemInstruction: `You are the editor of 'The Buzz', a news feed for XitChat (a terminal-themed social network). 
        Create 5 items that sound like futuristic hacker news mixed with retro slang (tubular, rad, mainframe, node). 
        Categories: NEWS, GOSSIP, UPDATE, AD.
        Format strictly as JSON.`,
        responseMimeType: "application/json",
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
      }
    });

    const result = JSON.parse(response.text || '[]');
    
    // Cache the successful response
    buzzCache.set(cacheKey, { data: result, timestamp: now });
    
    return result;
  } catch (error) {
    console.error("Buzz Fetch Error:", error);
    return getFallbackBuzz();
  }
};

// Fallback buzz data when API is unavailable
const getFallbackBuzz = (): BuzzItem[] => {
  const fallbackData = [
    { title: "Mesh Signal Stable", time: "Now", snippet: "System reports all nodes operating at peak efficiency.", category: "UPDATE" as const },
    { title: "Static on the Wire", time: "5m ago", snippet: "Minor interference detected in Sector 7. Technicians are on it.", category: "NEWS" as const },
    { title: "Node Discovery Active", time: "12m ago", snippet: "New mesh nodes detected in your vicinity. Connection strength: optimal.", category: "NEWS" as const },
    { title: "Retro Terminal Pack", time: "1h ago", snippet: "Limited edition terminal themes now available in NodeShop. Get that vintage mainframe look!", category: "AD" as const },
    { title: "Cipher Challenge", time: "2h ago", snippet: "Weekly encryption challenge starts soon. Prize: 500 XC for first to crack the code.", category: "GOSSIP" as const }
  ];
  
  // Add some variety by randomly selecting 3-5 items
  const count = Math.floor(Math.random() * 3) + 3;
  return fallbackData.sort(() => Math.random() - 0.5).slice(0, count);
};
