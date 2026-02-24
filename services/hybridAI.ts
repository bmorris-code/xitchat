// Hybrid AI Service for XitChat
// Automatically switches between Groq (primary) and Gemini (fallback)

import {
  getXitBotResponse as getXitBotResponseGemini,
  streamXitBotResponseGemini,
  getQuickReplies as getQuickRepliesGemini,
  getLatestBuzz as getLatestBuzzGemini
} from './gemini';

import {
  getXitBotResponseGroq,
  streamXitBotResponseGroq,
  getQuickRepliesGroq,
  getLatestBuzzGroq,
  checkGroqHealth
} from './groq';

import { hybridMesh, HybridMeshPeer } from './hybridMesh';

export type AIProvider = 'groq' | 'gemini' | 'fallback';

export interface BuzzItem {
  title: string;
  time: string;
  snippet: string;
  category: string;
}

class HybridAIService {
  private primaryProvider: AIProvider = 'groq';
  private isGroqHealthy = true;
  private lastHealthCheck = 0;
  private readonly HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private failureCount = 0;
  private readonly MAX_FAILURES = 3;
  private isOnline = false;
  private aiPeers: string[] = [];
  private pendingRequests: Map<string, (response: string) => void> = new Map();
  private listeners: { [key: string]: ((data: any) => void)[] } = {};

  constructor() {
    this.initializeHealthCheck();
    this.initializeMeshIntegration();
  }

  private initializeMeshIntegration() {
    window.addEventListener('meshAIResponse', (event: any) => {
      const { requestId, response } = event.detail;
      const callback = this.pendingRequests.get(requestId);
      if (callback) {
        callback(response);
        this.pendingRequests.delete(requestId);
      }
    });

    window.addEventListener('meshAIRequest', async (event: any) => {
      if (this.isOnline && this.isGroqHealthy) {
        const { requestId, userMessage, fromNode } = event.detail;
        console.log(`🤖 Mesh AI Proxy: Processing request from ${fromNode}`);
        try {
          const response = await this.getXitBotResponse(userMessage, true);
          await hybridMesh.sendMessage(JSON.stringify({
            type: 'ai_response',
            data: { requestId, response }
          }), fromNode);
        } catch (error) {
          console.error('Failed to proxy AI request:', error);
        }
      }
    });

    hybridMesh.subscribe('peersUpdated', (peers: HybridMeshPeer[]) => {
      this.aiPeers = peers
        .filter(p => p.connectionType === 'nostr' || p.id.includes('proxy'))
        .map(p => p.id);
    });
  }

  private async initializeHealthCheck() {
    await this.checkProviderHealth();
    setInterval(() => this.checkProviderHealth(), this.HEALTH_CHECK_INTERVAL);
  }

  private async checkProviderHealth(): Promise<void> {
    const now = Date.now();
    if (now - this.lastHealthCheck < this.HEALTH_CHECK_INTERVAL) return;
    this.lastHealthCheck = now;

    try {
      const groqHealthy = await checkGroqHealth();
      this.isOnline = groqHealthy;

      if (groqHealthy) {
        this.isGroqHealthy = true;
        this.primaryProvider = 'groq';
        this.failureCount = 0;
        console.log('✅ Groq is healthy - using as primary provider');
      } else {
        this.failureCount++;
        if (this.failureCount >= this.MAX_FAILURES) {
          this.isGroqHealthy = false;
          this.primaryProvider = 'gemini';
          console.log('🔄 Switching to Gemini as primary provider');
        }
      }
      this.notifyListeners('statusChanged', this.getProviderStatus());
    } catch (error) {
      console.error('Health check failed:', error);
      this.isOnline = false;
      this.failureCount++;
      if (this.failureCount >= this.MAX_FAILURES) {
        this.isGroqHealthy = false;
        this.primaryProvider = 'gemini';
      }
      this.notifyListeners('statusChanged', this.getProviderStatus());
    }
  }

  private async executeWithFallback<T>(
    groqFn: () => Promise<T>,
    geminiFn: () => Promise<T>,
    fallbackFn: () => T,
    operation: string,
    skipMesh: boolean = false,
    userMessage?: string
  ): Promise<T> {
    if (this.primaryProvider === 'groq' && this.isGroqHealthy) {
      try {
        return await groqFn();
      } catch {
        this.failureCount++;
        if (this.failureCount >= this.MAX_FAILURES) {
          this.isGroqHealthy = false;
          this.primaryProvider = 'gemini';
        }
      }
    }

    try {
      return await geminiFn();
    } catch { }

    if (!this.isOnline && !skipMesh && this.aiPeers.length > 0 && operation === 'Chat Response' && userMessage) {
      try {
        const meshResult = await this.requestMeshAI(userMessage);
        if (meshResult) return meshResult as unknown as T;
      } catch { }
    }

    return fallbackFn();
  }

  private async requestMeshAI(userMessage: string): Promise<string | null> {
    if (this.aiPeers.length === 0) return null;

    const requestId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const targetPeer = this.aiPeers[0];

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        resolve(null);
      }, 15000);

      this.pendingRequests.set(requestId, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });

      hybridMesh.sendMessage(JSON.stringify({
        type: 'ai_request',
        data: { requestId, userMessage }
      }), targetPeer);
    });
  }

  async getXitBotResponse(userMessage: string, skipMesh: boolean = false): Promise<string> {
    return this.executeWithFallback(
      () => getXitBotResponseGroq(userMessage),
      () => getXitBotResponseGemini(userMessage),
      () => this.getFallbackResponse(userMessage),
      'Chat Response',
      skipMesh,
      userMessage
    );
  }

  async streamXitBotResponse(
    userMessage: string,
    onToken: (token: string, fullText: string) => void,
    skipMesh: boolean = false
  ): Promise<string> {
    if (this.primaryProvider === 'groq' && this.isGroqHealthy) {
      try {
        return await streamXitBotResponseGroq(userMessage, onToken);
      } catch {
        this.failureCount++;
        if (this.failureCount >= this.MAX_FAILURES) {
          this.isGroqHealthy = false;
          this.primaryProvider = 'gemini';
        }
      }
    }

    try {
      return await streamXitBotResponseGemini(userMessage, onToken);
    } catch { }

    if (!this.isOnline && !skipMesh && this.aiPeers.length > 0) {
      const meshResult = await this.requestMeshAI(userMessage);
      if (meshResult) {
        onToken(meshResult, meshResult);
        return meshResult;
      }
    }

    const fallback = this.getFallbackResponse(userMessage);
    onToken(fallback, fallback);
    return fallback;
  }

  async getQuickReplies(lastMessage: string): Promise<string[]> {
    return this.executeWithFallback(
      () => getQuickRepliesGroq(lastMessage),
      () => getQuickRepliesGemini(lastMessage),
      () => ["Rad!", "On it.", "10-4"],
      'Quick Replies'
    );
  }

  async getLatestBuzz(): Promise<BuzzItem[]> {
    return this.executeWithFallback(
      () => getLatestBuzzGroq(),
      () => getLatestBuzzGemini(),
      () => this.getFallbackBuzz(),
      'Latest Buzz'
    );
  }

  private getFallbackResponse(userMessage: string): string {
    const lowerMessage = userMessage.toLowerCase();
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) return "Hey there! Ready to surf the digital waves? 🌊";
    if (lowerMessage.includes('help')) return "Need assistance? I'm your mainframe buddy! What can I help you with?";
    if (lowerMessage.includes('bug') || lowerMessage.includes('error')) return "Uh oh, digital static detected! Try refreshing or clearing your cache.";
    if (lowerMessage.includes('xc') || lowerMessage.includes('token')) return "XC tokens are rad! Earn them by chatting and playing games in the mesh!";

    const fallbackResponses = [
      "Whoa, that's some heavy data! Let me process... *beep boop*",
      "Totally tubular question! My circuits are buzzing with ideas!",
      "Rad query! Let me boot up my knowledge banks...",
      "Far out! That's some next-level thinking right there!",
      "Excellent question! Let me dial into the mainframe for you..."
    ];

    return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
  }

  private getFallbackBuzz(): BuzzItem[] {
    return [
      { title: "Mesh Signal Strong", time: "Now", snippet: "All systems operating at peak efficiency.", category: "UPDATE" },
      { title: "Static on Channel 7", time: "5m ago", snippet: "Minor interference detected. Technicians routing around.", category: "NEWS" },
      { title: "New Nodes Online", time: "12m ago", snippet: "Fresh mesh nodes detected. Connection strength: optimal.", category: "NEWS" }
    ];
  }

  getProviderStatus() {
    return {
      primary: this.primaryProvider,
      groqHealthy: this.isGroqHealthy,
      failureCount: this.failureCount
    };
  }

  subscribe(event: string, callback: (data: any) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  private notifyListeners(event: string, data: any) {
    if (this.listeners[event]) this.listeners[event].forEach(cb => cb(data));
  }
}

export const hybridAI = new HybridAIService();

// Clean exports
export const getXitBotResponse = (userMessage: string, skipMesh?: boolean) => hybridAI.getXitBotResponse(userMessage, skipMesh);
export const streamXitBotResponse = (userMessage: string, onToken: (token: string, fullText: string) => void, skipMesh?: boolean) => hybridAI.streamXitBotResponse(userMessage, onToken, skipMesh);
export const getQuickReplies = (lastMessage: string) => hybridAI.getQuickReplies(lastMessage);
export const getLatestBuzz = () => hybridAI.getLatestBuzz();