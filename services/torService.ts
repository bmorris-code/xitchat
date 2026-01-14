// TOR (The Onion Router) Service for XitChat
export interface TorNode {
  id: string;
  ip: string;
  port: number;
  country: string;
  nickname: string;
  flags: string[];
  bandwidth: number;
  uptime: number;
}

export interface TorCircuit {
  id: string;
  nodes: TorNode[];
  purpose: 'general' | 'mesh' | 'geohash' | 'banking';
  created: number;
  status: 'building' | 'established' | 'failed';
}

export interface TorStatus {
  connected: boolean;
  bootstrapProgress: number;
  circuitCount: number;
  activeCircuits: TorCircuit[];
  bandwidth: number;
  country: string;
  exitNode: TorNode | null;
}

class TorService {
  private status: TorStatus = {
    connected: false,
    bootstrapProgress: 0,
    circuitCount: 0,
    activeCircuits: [],
    bandwidth: 0,
    country: 'Unknown',
    exitNode: null
  };
  
  private isEnabled = false;
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private bootstrapInterval: number | null = null;
  private circuitRotationInterval: number | null = null;

  constructor() {
    this.loadSettings();
  }

  private loadSettings() {
    try {
      const saved = localStorage.getItem('tor_settings');
      if (saved) {
        const settings = JSON.parse(saved);
        this.isEnabled = settings.enabled || false;
        if (this.isEnabled) {
          this.startTor();
        }
      }
    } catch (error) {
      console.error('Failed to load TOR settings:', error);
    }
  }

  private saveSettings() {
    localStorage.setItem('tor_settings', JSON.stringify({
      enabled: this.isEnabled,
      status: this.status
    }));
  }

  async enableTor(): Promise<boolean> {
    try {
      this.isEnabled = true;
      await this.startTor();
      this.saveSettings();
      this.notifyListeners('torEnabled', true);
      return true;
    } catch (error) {
      console.error('Failed to enable TOR:', error);
      return false;
    }
  }

  async disableTor(): Promise<boolean> {
    try {
      this.isEnabled = false;
      await this.stopTor();
      this.saveSettings();
      this.notifyListeners('torDisabled', true);
      return true;
    } catch (error) {
      console.error('Failed to disable TOR:', error);
      return false;
    }
  }

  private async startTor(): Promise<void> {
    console.log('Starting TOR service...');
    
    // Simulate TOR bootstrap process
    this.status.connected = false;
    this.status.bootstrapProgress = 0;
    
    this.bootstrapInterval = window.setInterval(() => {
      this.status.bootstrapProgress = Math.min(100, this.status.bootstrapProgress + Math.random() * 15);
      
      if (this.status.bootstrapProgress >= 100) {
        this.status.connected = true;
        this.status.bootstrapProgress = 100;
        
        if (this.bootstrapInterval) {
          clearInterval(this.bootstrapInterval);
          this.bootstrapInterval = null;
        }
        
        this.onTorConnected();
      }
      
      this.notifyListeners('bootstrapProgress', this.status.bootstrapProgress);
    }, 1000);
  }

  private async stopTor(): Promise<void> {
    console.log('Stopping TOR service...');
    
    if (this.bootstrapInterval) {
      clearInterval(this.bootstrapInterval);
      this.bootstrapInterval = null;
    }
    
    if (this.circuitRotationInterval) {
      clearInterval(this.circuitRotationInterval);
      this.circuitRotationInterval = null;
    }
    
    this.status.connected = false;
    this.status.bootstrapProgress = 0;
    this.status.activeCircuits = [];
    this.status.exitNode = null;
    
    this.notifyListeners('torDisconnected', true);
  }

  private onTorConnected() {
    console.log('TOR connected successfully!');
    
    // Create initial circuits
    this.createCircuit('general');
    this.createCircuit('mesh');
    this.createCircuit('geohash');
    
    // Start circuit rotation (every 10 minutes)
    this.circuitRotationInterval = window.setInterval(() => {
      this.rotateCircuits();
    }, 10 * 60 * 1000);
    
    // Update status
    this.updateTorStatus();
  }

  private async createCircuit(purpose: TorCircuit['purpose']): Promise<TorCircuit> {
    const circuit: TorCircuit = {
      id: `circuit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      nodes: this.generateMockNodes(3),
      purpose,
      created: Date.now(),
      status: 'building'
    };

    // Simulate circuit building
    setTimeout(() => {
      circuit.status = 'established';
      this.status.activeCircuits.push(circuit);
      this.status.circuitCount = this.status.activeCircuits.length;
      
      if (purpose === 'general' && !this.status.exitNode) {
        this.status.exitNode = circuit.nodes[circuit.nodes.length - 1];
      }
      
      this.notifyListeners('circuitEstablished', circuit);
    }, 2000 + Math.random() * 3000);

    return circuit;
  }

  private generateMockNodes(count: number): TorNode[] {
    const mockNodes: TorNode[] = [
      {
        id: 'node1',
        ip: '192.168.1.1',
        port: 9001,
        country: 'US',
        nickname: 'LibertyNode',
        flags: ['Guard', 'Fast', 'Stable'],
        bandwidth: 1048576, // 1 MB/s
        uptime: 95
      },
      {
        id: 'node2',
        ip: '192.168.1.2',
        port: 9001,
        country: 'DE',
        nickname: 'FreedomRelay',
        flags: ['Fast', 'Stable'],
        bandwidth: 2097152, // 2 MB/s
        uptime: 98
      },
      {
        id: 'node3',
        ip: '192.168.1.3',
        port: 9001,
        country: 'CH',
        nickname: 'PrivacyExit',
        flags: ['Exit', 'Fast'],
        bandwidth: 524288, // 512 KB/s
        uptime: 92
      }
    ];

    return mockNodes.slice(0, count);
  }

  private rotateCircuits() {
    console.log('Rotating TOR circuits...');
    
    // Remove old circuits
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes
    
    this.status.activeCircuits = this.status.activeCircuits.filter(circuit => {
      if (now - circuit.created > maxAge) {
        this.notifyListeners('circuitClosed', circuit);
        return false;
      }
      return true;
    });
    
    // Create new circuits if needed
    const purposes: TorCircuit['purpose'][] = ['general', 'mesh', 'geohash', 'banking'];
    purposes.forEach(purpose => {
      const existingCircuit = this.status.activeCircuits.find(c => c.purpose === purpose);
      if (!existingCircuit) {
        this.createCircuit(purpose);
      }
    });
  }

  private updateTorStatus() {
    // Update bandwidth (simulated)
    this.status.bandwidth = Math.floor(Math.random() * 5242880) + 1048576; // 1-5 MB/s
    
    // Update country based on exit node
    if (this.status.exitNode) {
      this.status.country = this.status.exitNode.country;
    }
    
    this.notifyListeners('statusUpdated', this.status);
  }

  // PUBLIC API
  async routeThroughTor(data: any, purpose: 'general' | 'mesh' | 'geohash' | 'banking' = 'general'): Promise<any> {
    if (!this.isEnabled || !this.status.connected) {
      throw new Error('TOR is not enabled or connected');
    }

    const circuit = this.status.activeCircuits.find(c => c.purpose === purpose);
    if (!circuit || circuit.status !== 'established') {
      throw new Error(`No established circuit for purpose: ${purpose}`);
    }

    // Simulate routing through TOR
    console.log(`Routing data through TOR circuit ${circuit.id} for purpose: ${purpose}`);
    
    // Add delay to simulate TOR latency
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    return {
      ...data,
      torRouted: true,
      circuitId: circuit.id,
      exitNode: circuit.nodes[circuit.nodes.length - 1].nickname
    };
  }

  getStatus(): TorStatus {
    return { ...this.status };
  }

  getTorEnabled(): boolean {
    return this.isEnabled;
  }

  // EVENT LISTENERS
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

  // CLEANUP
  destroy() {
    this.stopTor();
  }
}

export const torService = new TorService();
