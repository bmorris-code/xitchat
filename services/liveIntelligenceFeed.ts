import { getXitBotResponse } from './hybridAI';

export interface IntelligenceItem {
  id: string;
  title: string;
  content: string;
  source: string;
  timestamp: number;
  category: 'security' | 'technology' | 'mesh' | 'cybersecurity';
  relevanceScore: number;
}

class LiveIntelligenceFeedService {
  private static instance: LiveIntelligenceFeedService | null = null;
  private intelligenceItems: IntelligenceItem[] = [];
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private isRefreshing = false;
  private lastRefresh = 0;
  private readonly REFRESH_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours

  private constructor() {
    this.loadStoredIntelligence();
    this.startAutoRefresh();
  }

  static getInstance(): LiveIntelligenceFeedService {
    if (!LiveIntelligenceFeedService.instance) {
      LiveIntelligenceFeedService.instance = new LiveIntelligenceFeedService();
    }
    return LiveIntelligenceFeedService.instance;
  }

  private loadStoredIntelligence() {
    try {
      const stored = localStorage.getItem('xitchat_intelligence_feed');
      if (stored) {
        this.intelligenceItems = JSON.parse(stored);
        this.notifyListeners('intelligenceUpdated', this.intelligenceItems);
      }
    } catch (error) {
      console.error('Failed to load intelligence feed:', error);
    }
  }

  private saveIntelligence() {
    try {
      localStorage.setItem('xitchat_intelligence_feed', JSON.stringify(this.intelligenceItems));
    } catch (error) {
      console.error('Failed to save intelligence feed:', error);
    }
  }

  private startAutoRefresh() {
    // Refresh immediately on start
    this.refreshIntelligence();
    
    // Then refresh every 5 minutes
    setInterval(() => {
      this.refreshIntelligence();
    }, this.REFRESH_INTERVAL);
  }

  private async refreshIntelligence() {
    if (this.isRefreshing) return;
    
    const now = Date.now();
    if (now - this.lastRefresh < this.REFRESH_INTERVAL) return;

    this.isRefreshing = true;
    this.lastRefresh = now;

    try {
      const prompt = `You are XitChat Intelligence Feed, a cybersecurity and mesh network monitoring system.
      
Search for and analyze the latest REAL news about:
1. Cybersecurity threats and vulnerabilities
2. Mesh networking and decentralized communication
3. Privacy and encryption technologies
4. Mobile security and PWA developments
5. Real-world hacking incidents and data breaches

For each topic, provide:
- A brief, factual summary (under 100 words)
- Source attribution (major tech news outlets)
- Relevance score (1-10) for mesh network users
- Category classification

Format as JSON array with: id, title, content, source, timestamp, category, relevanceScore

Focus on REAL, VERIFIABLE news from the last 24-48 hours. Be factual and brief.`;

      const response = await getXitBotResponse(prompt);
      
      // Try to parse JSON response
      try {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const newIntelligence = JSON.parse(jsonMatch[0]);
          
          // Add metadata and filter
          this.intelligenceItems = newIntelligence
            .map((item: any) => ({
              ...item,
              id: item.id || `intel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              timestamp: item.timestamp || Date.now(),
              content: this.formatAsTerminal(item.content)
            }))
            .filter((item: IntelligenceItem) => item.relevanceScore >= 6)
            .slice(0, 10); // Keep only top 10

          this.saveIntelligence();
          this.notifyListeners('intelligenceUpdated', this.intelligenceItems);
          this.notifyListeners('newIntelligence', this.intelligenceItems[0]); // Latest item
        }
      } catch (parseError) {
        // Fallback: create intelligence item from text response
        this.intelligenceItems = [{
          id: `intel-${Date.now()}`,
          title: 'INTELLIGENCE_UPDATE',
          content: this.formatAsTerminal(response.substring(0, 200)),
          source: 'XitChat Intelligence',
          timestamp: Date.now(),
          category: 'mesh',
          relevanceScore: 8
        }, ...this.intelligenceItems.slice(0, 9)];
        
        this.saveIntelligence();
        this.notifyListeners('intelligenceUpdated', this.intelligenceItems);
      }
    } catch (error) {
      console.error('Failed to refresh intelligence feed:', error);
      
      // Create fallback intelligence item
      const fallbackItem: IntelligenceItem = {
        id: `intel-fallback-${Date.now()}`,
        title: 'MESH_STATUS_UPDATE',
        content: `[SYSTEM] Intelligence feed temporarily unavailable. Mesh network operating normally.`,
        source: 'XitChat Core',
        timestamp: Date.now(),
        category: 'mesh',
        relevanceScore: 7
      };
      
      this.intelligenceItems = [fallbackItem, ...this.intelligenceItems.slice(0, 9)];
      this.saveIntelligence();
      this.notifyListeners('intelligenceUpdated', this.intelligenceItems);
    } finally {
      this.isRefreshing = false;
    }
  }

  private formatAsTerminal(content: string): string {
    return content
      .replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]')
      .replace(/\b(\d{1,3}\.){3}\d{1,3}\b/g, '[IP_REDACTED]')
      .replace(/[A-Z]{2,}-\d{4,}/g, '[CVE_REDACTED]')
      .substring(0, 150) + '...';
  }

  // PUBLIC API
  getIntelligenceItems(): IntelligenceItem[] {
    return this.intelligenceItems;
  }

  getItemsByCategory(category: IntelligenceItem['category']): IntelligenceItem[] {
    return this.intelligenceItems.filter(item => item.category === category);
  }

  getHighRelevanceItems(): IntelligenceItem[] {
    return this.intelligenceItems.filter(item => item.relevanceScore >= 8);
  }

  async forceRefresh() {
    this.lastRefresh = 0; // Override refresh interval
    await this.refreshIntelligence();
  }

  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  private notifyListeners(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }
}

export const liveIntelligenceFeed = LiveIntelligenceFeedService.getInstance();
