// Hybrid AI Service for XitChat
// Automatically switches between Groq (primary) and Gemini (fallback)

import { getXitBotResponse as getXitBotResponseGemini, getQuickReplies as getQuickRepliesGemini, getLatestBuzz as getLatestBuzzGemini } from './gemini';
import { getXitBotResponseGroq, getQuickRepliesGroq, getLatestBuzzGroq, checkGroqHealth } from './groq';

export type AIProvider = 'groq' | 'gemini' | 'fallback';

class HybridAIService {
  private primaryProvider: AIProvider = 'groq';
  private isGroqHealthy = true;
  private lastHealthCheck = 0;
  private readonly HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private failureCount = 0;
  private readonly MAX_FAILURES = 3;

  constructor() {
    this.initializeHealthCheck();
  }

  private async initializeHealthCheck() {
    // Initial health check
    await this.checkProviderHealth();
    
    // Periodic health checks
    setInterval(() => {
      this.checkProviderHealth();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  private async checkProviderHealth(): Promise<void> {
    const now = Date.now();
    if (now - this.lastHealthCheck < this.HEALTH_CHECK_INTERVAL) return;

    this.lastHealthCheck = now;

    try {
      // Check Groq health
      const groqHealthy = await checkGroqHealth();
      
      if (groqHealthy) {
        this.isGroqHealthy = true;
        this.primaryProvider = 'groq';
        this.failureCount = 0;
        console.log('✅ Groq is healthy - using as primary provider');
      } else {
        this.failureCount++;
        console.warn(`⚠️ Groq health check failed (${this.failureCount}/${this.MAX_FAILURES})`);
        
        if (this.failureCount >= this.MAX_FAILURES) {
          this.isGroqHealthy = false;
          this.primaryProvider = 'gemini';
          console.log('🔄 Switching to Gemini as primary provider');
        }
      }
    } catch (error) {
      console.error('Health check failed:', error);
      this.failureCount++;
      
      if (this.failureCount >= this.MAX_FAILURES) {
        this.isGroqHealthy = false;
        this.primaryProvider = 'gemini';
      }
    }
  }

  private async executeWithFallback<T>(
    groqFn: () => Promise<T>,
    geminiFn: () => Promise<T>,
    fallbackFn: () => T,
    operation: string
  ): Promise<T> {
    // Try primary provider first
    if (this.primaryProvider === 'groq' && this.isGroqHealthy) {
      try {
        const result = await groqFn();
        console.log(`✅ ${operation} completed with Groq`);
        return result;
      } catch (error) {
        console.warn(`⚠️ Groq failed for ${operation}, trying Gemini:`, error);
        this.failureCount++;
        
        if (this.failureCount >= this.MAX_FAILURES) {
          this.isGroqHealthy = false;
          this.primaryProvider = 'gemini';
        }
      }
    }

    // Try Gemini
    try {
      const result = await geminiFn();
      console.log(`✅ ${operation} completed with Gemini`);
      return result;
    } catch (error) {
      console.warn(`⚠️ Gemini failed for ${operation}, using fallback:`, error);
    }

    // Final fallback
    console.log(`🔄 Using fallback for ${operation}`);
    return fallbackFn();
  }

  async getXitBotResponse(userMessage: string): Promise<string> {
    return this.executeWithFallback(
      () => getXitBotResponseGroq(userMessage),
      () => getXitBotResponseGemini(userMessage),
      () => this.getFallbackResponse(userMessage),
      'Chat Response'
    );
  }

  async getQuickReplies(lastMessage: string): Promise<string[]> {
    return this.executeWithFallback(
      () => getQuickRepliesGroq(lastMessage),
      () => getQuickRepliesGemini(lastMessage),
      () => ["Rad!", "On it.", "10-4"],
      'Quick Replies'
    );
  }

  async getLatestBuzz(): Promise<any[]> {
    return this.executeWithFallback(
      () => getLatestBuzzGroq(),
      () => getLatestBuzzGemini(),
      () => this.getFallbackBuzz(),
      'Latest Buzz'
    );
  }

  private getFallbackResponse(userMessage: string): string {
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
  }

  private getFallbackBuzz() {
    return [
      { title: "Mesh Signal Strong", time: "Now", snippet: "All systems operating at peak efficiency.", category: "UPDATE" },
      { title: "Static on Channel 7", time: "5m ago", snippet: "Minor interference detected. Technicians routing around.", category: "NEWS" },
      { title: "New Nodes Online", time: "12m ago", snippet: "Fresh mesh nodes detected. Connection strength: optimal.", category: "NEWS" }
    ];
  }

  // Get current provider status
  getProviderStatus(): {
    primary: AIProvider;
    groqHealthy: boolean;
    failureCount: number;
  } {
    return {
      primary: this.primaryProvider,
      groqHealthy: this.isGroqHealthy,
      failureCount: this.failureCount
    };
  }

  // Force switch provider (for testing or manual override)
  forceSwitchProvider(provider: AIProvider): void {
    this.primaryProvider = provider;
    this.isGroqHealthy = (provider === 'groq');
    this.failureCount = 0;
    console.log(`🔄 Manually switched to ${provider} as primary provider`);
  }

  // Reset failure count (useful after manual intervention)
  resetFailures(): void {
    this.failureCount = 0;
    console.log('🔄 Reset failure count');
  }
}

export const hybridAI = new HybridAIService();

// Export the hybrid functions as drop-in replacements
export const getXitBotResponse = (userMessage: string) => hybridAI.getXitBotResponse(userMessage);
export const getQuickReplies = (lastMessage: string) => hybridAI.getQuickReplies(lastMessage);
export const getLatestBuzz = () => hybridAI.getLatestBuzz();
