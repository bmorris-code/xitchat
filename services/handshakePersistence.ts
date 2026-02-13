interface HandshakeNode {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  firstConnected: number;
  lastSeen: number;
  connectionType: 'bluetooth' | 'wifi' | 'global';
  distance?: string;
  integrity: number; // 0-100
}

class HandshakePersistenceService {
  stopBackgroundMaintenance() {
    throw new Error('Method not implemented.');
  }
  private readonly STORAGE_KEY = 'xitchat_handshake_nodes';
  private nodes: Map<string, HandshakeNode> = new Map();
  private listeners: { [key: string]: ((data: any) => void)[] } = {};

  constructor() {
    this.loadHandshakes();
  }

  private loadHandshakes() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const nodes: HandshakeNode[] = JSON.parse(stored);
        nodes.forEach(node => {
          this.nodes.set(node.id, node);
        });
        this.cleanupOldNodes();
      }
    } catch (error) {
      console.error('Failed to load handshake nodes:', error);
    }
  }

  private saveHandshakes() {
    try {
      const nodesArray = Array.from(this.nodes.values());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(nodesArray));
    } catch (error) {
      console.error('Failed to save handshake nodes:', error);
    }
  }

  private cleanupOldNodes() {
    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    
    for (const [id, node] of this.nodes.entries()) {
      if (now - node.lastSeen > THIRTY_DAYS) {
        this.nodes.delete(id);
      }
    }
    
    this.saveHandshakes();
  }

  // PUBLIC API
  recordHandshake(nodeData: Omit<HandshakeNode, 'firstConnected' | 'lastSeen' | 'integrity'>): HandshakeNode {
    const now = Date.now();
    const existingNode = this.nodes.get(nodeData.id);
    
    const handshakeNode: HandshakeNode = {
      ...nodeData,
      firstConnected: existingNode?.firstConnected || now,
      lastSeen: now,
      integrity: existingNode ? Math.min(100, existingNode.integrity + 5) : 50
    };

    this.nodes.set(nodeData.id, handshakeNode);
    this.saveHandshakes();
    this.notifyListeners('handshakeRecorded', handshakeNode);
    
    return handshakeNode;
  }

  updateLastSeen(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.lastSeen = Date.now();
      node.integrity = Math.min(100, node.integrity + 2);
      this.saveHandshakes();
      this.notifyListeners('nodeUpdated', node);
    }
  }

  degradeIntegrity(): void {
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;
    
    for (const [id, node] of this.nodes.entries()) {
      if (now - node.lastSeen > ONE_HOUR) {
        node.integrity = Math.max(0, node.integrity - 10);
        if (node.integrity === 0) {
          this.nodes.delete(id);
        }
      }
    }
    
    this.saveHandshakes();
    this.notifyListeners('integrityUpdated', Array.from(this.nodes.values()));
  }

  getHandshakeNodes(): HandshakeNode[] {
    return Array.from(this.nodes.values())
      .sort((a, b) => b.lastSeen - a.lastSeen);
  }

  getActiveNodes(): HandshakeNode[] {
    const now = Date.now();
    const FIVE_MINUTES = 5 * 60 * 1000;
    
    return this.getHandshakeNodes().filter(node => 
      now - node.lastSeen < FIVE_MINUTES
    );
  }

  getNodesByType(connectionType: HandshakeNode['connectionType']): HandshakeNode[] {
    return this.getHandshakeNodes().filter(node => 
      node.connectionType === connectionType
    );
  }

  removeNode(nodeId: string): boolean {
    const removed = this.nodes.delete(nodeId);
    if (removed) {
      this.saveHandshakes();
      this.notifyListeners('nodeRemoved', nodeId);
    }
    return removed;
  }

  clearAllNodes(): void {
    this.nodes.clear();
    this.saveHandshakes();
    this.notifyListeners('allNodesCleared', null);
  }

  // Analytics
  getHandshakeStats() {
    const nodes = this.getHandshakeNodes();
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    
    return {
      totalNodes: nodes.length,
      activeNodes: nodes.filter(n => now - n.lastSeen < ONE_DAY).length,
      averageIntegrity: nodes.length > 0 
        ? Math.round(nodes.reduce((sum, n) => sum + n.integrity, 0) / nodes.length)
        : 0,
      connectionTypes: {
        bluetooth: nodes.filter(n => n.connectionType === 'bluetooth').length,
        wifi: nodes.filter(n => n.connectionType === 'wifi').length,
        global: nodes.filter(n => n.connectionType === 'global').length
      }
    };
  }

  // Event Listeners
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

  // Start background integrity degradation
  startBackgroundMaintenance() {
    // Degrade integrity every hour
    setInterval(() => {
      this.degradeIntegrity();
    }, 60 * 60 * 1000);

    // Cleanup old nodes daily
    setInterval(() => {
      this.cleanupOldNodes();
    }, 24 * 60 * 60 * 1000);
  }
}

export const handshakePersistence = new HandshakePersistenceService();
export type { HandshakeNode };
