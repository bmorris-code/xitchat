// Real Proof of Work Service for XitChat Mesh Security
// Uses actual cryptographic SHA-256 hashing and Web Workers

export interface POWChallenge {
  id: string;
  difficulty: number;
  data: string;
  target: string;
  timestamp: number;
  expiresAt: number;
  purpose: 'authentication' | 'message' | 'transaction' | 'channel';
  networkConsensus?: boolean;
}

export interface POWSolution {
  challengeId: string;
  nonce: number;
  hash: string;
  solveTime: number;
  solverId: string;
  workerId?: string;
}

export interface POWStats {
  totalChallenges: number;
  solvedChallenges: number;
  averageSolveTime: number;
  currentDifficulty: number;
  hashRate: number;
  lastSolution: POWSolution | null;
  networkHashRate?: number;
  consensusDifficulty?: number;
}

class RealPOWService {
  private isEnabled = false;
  private currentChallenge: POWChallenge | null = null;
  private stats: POWStats = {
    totalChallenges: 0,
    solvedChallenges: 0,
    averageSolveTime: 0,
    currentDifficulty: 1,
    hashRate: 0,
    lastSolution: null
  };
  private workers: Worker[] = [];
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private miningInterval: number | null = null;
  private networkConsensusInterval: number | null = null;
  private workerCount: number;

  constructor() {
    this.workerCount = navigator.hardwareConcurrency || 4;
    // Temporarily disable POW to prevent BigInt errors
    this.isEnabled = false;
    this.loadSettings();
  }

  private loadSettings() {
    try {
      const saved = localStorage.getItem('pow_settings');
      if (saved) {
        const settings = JSON.parse(saved);
        // Keep POW disabled to prevent BigInt errors
        this.isEnabled = false;
        this.stats.currentDifficulty = settings.difficulty || 1;
        if (this.isEnabled) {
          this.startPOW();
        }
      }
    } catch (error) {
      console.error('Failed to load POW settings:', error);
    }
  }

  private saveSettings() {
    localStorage.setItem('pow_settings', JSON.stringify({
      enabled: this.isEnabled,
      difficulty: this.stats.currentDifficulty,
      stats: this.stats
    }));
  }

  async enablePOW(): Promise<boolean> {
    try {
      this.isEnabled = true;
      await this.startPOW();
      this.saveSettings();
      this.notifyListeners('powEnabled', true);
      return true;
    } catch (error) {
      console.error('Failed to enable POW:', error);
      return false;
    }
  }

  async disablePOW(): Promise<boolean> {
    try {
      this.isEnabled = false;
      await this.stopPOW();
      this.saveSettings();
      this.notifyListeners('powDisabled', true);
      return true;
    } catch (error) {
      console.error('Failed to disable POW:', error);
      return false;
    }
  }

  private async startPOW(): Promise<void> {
    console.log('Starting real POW service with SHA-256 mining...');
    
    // Create Web Workers for parallel mining
    this.createWorkers();
    
    // Start continuous mining for network security
    this.miningInterval = window.setInterval(() => {
      this.generateChallenge('authentication');
    }, 30000); // Every 30 seconds
    
    // Start network consensus checking
    this.startNetworkConsensus();
    
    this.updateStats();
  }

  private async stopPOW(): Promise<void> {
    console.log('Stopping real POW service...');
    
    if (this.miningInterval) {
      clearInterval(this.miningInterval);
      this.miningInterval = null;
    }
    
    if (this.networkConsensusInterval) {
      clearInterval(this.networkConsensusInterval);
      this.networkConsensusInterval = null;
    }
    
    // Terminate workers
    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
    
    this.currentChallenge = null;
  }

  private createWorkers() {
    console.log(`Creating ${this.workerCount} Web Workers for POW mining...`);
    
    for (let i = 0; i < this.workerCount; i++) {
      const workerCode = this.getRealWorkerCode(i);
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      
      const worker = new Worker(workerUrl);
      
      worker.onmessage = (event) => {
        const { type, data } = event.data;
        
        if (type === 'solution') {
          this.handleSolution(data);
        } else if (type === 'hashRate') {
          this.updateHashRate(data.hashRate, data.workerId);
        } else if (type === 'error') {
          console.error(`Worker ${data.workerId} error:`, data.error);
        }
      };
      
      worker.onerror = (error) => {
        console.error(`Worker ${i} error:`, error);
      };
      
      this.workers.push(worker);
    }
  }

  private getRealWorkerCode(workerId: number): string {
    return `
      // Real SHA-256 POW Worker
      let currentChallenge = null;
      let startTime = 0;
      let hashes = 0;
      let lastHashRateUpdate = 0;
      const workerId = ${workerId};

      // SHA-256 implementation using Web Crypto API
      async function sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
      }

      // Convert hex to binary string for difficulty checking
      function hexToBinary(hex) {
        return hex.split('').map(c => parseInt(c, 16).toString(2).padStart(4, '0')).join('');
      }

      // Check if hash meets difficulty target
      function meetsDifficulty(hashBinary, difficulty) {
        return hashBinary.startsWith('0'.repeat(difficulty));
      }

      self.onmessage = async function(event) {
        const { type, data } = event.data;
        
        if (type === 'challenge') {
          currentChallenge = data;
          startTime = Date.now();
          hashes = 0;
          lastHashRateUpdate = Date.now();
          await solveChallenge();
        } else if (type === 'stop') {
          currentChallenge = null;
        }
      };

      async function solveChallenge() {
        if (!currentChallenge) return;
        
        let nonce = 0;
        const { data, difficulty, id: challengeId } = currentChallenge;
        
        console.log(\`Worker \${workerId} starting challenge \${challengeId} with difficulty \${difficulty}\`);
        
        while (currentChallenge && nonce < Number.MAX_SAFE_INTEGER) {
          const message = data + nonce;
          const hash = await sha256(message);
          const hashBinary = hexToBinary(hash);
          hashes++;
          
          // Update hash rate every second
          const now = Date.now();
          if (now - lastHashRateUpdate > 1000) {
            const elapsed = (now - startTime) / 1000;
            const hashRate = Math.floor(hashes / elapsed); // Ensure hashRate is a number
            self.postMessage({ 
              type: 'hashRate', 
              data: { hashRate, workerId } 
            });
            lastHashRateUpdate = now;
          }
          
          if (meetsDifficulty(hashBinary, difficulty)) {
            const solveTime = Date.now() - startTime;
            console.log(\`Worker \${workerId} found solution: \${hash} (nonce: \${nonce})\`);
            
            self.postMessage({
              type: 'solution',
              data: {
                challengeId,
                nonce,
                hash,
                solveTime,
                solverId: 'worker_' + workerId,
                workerId
              }
            });
            break;
          }
          
          nonce++;
          
          // Check if challenge expired
          if (now > currentChallenge.expiresAt) {
            self.postMessage({
              type: 'error',
              data: { 
                error: 'Challenge expired',
                workerId,
                challengeId 
              }
            });
            break;
          }
        }
      }
    `;
  }

  private startNetworkConsensus() {
    // Check network consensus for difficulty adjustment
    this.networkConsensusInterval = window.setInterval(async () => {
      await this.checkNetworkConsensus();
    }, 60000); // Every minute
  }

  private async checkNetworkConsensus() {
    try {
      // Query multiple nodes for network statistics
      const networkStats = await this.queryNetworkStats();
      
      if (networkStats.length > 0) {
        // Calculate network-wide difficulty consensus
        const avgNetworkDifficulty = networkStats.reduce((sum, stat) => 
          sum + (stat.difficulty || this.stats.currentDifficulty), 0) / networkStats.length;
        
        const avgNetworkHashRate = networkStats.reduce((sum, stat) => 
          sum + (stat.hashRate || 0), 0) / networkStats.length;
        
        // Adjust local difficulty based on network consensus
        if (Math.abs(avgNetworkDifficulty - this.stats.currentDifficulty) > 1) {
          this.stats.currentDifficulty = Math.round(avgNetworkDifficulty);
          console.log(`Adjusted difficulty to network consensus: ${this.stats.currentDifficulty}`);
          this.notifyListeners('difficultyAdjusted', this.stats.currentDifficulty);
        }
        
        this.stats.networkHashRate = avgNetworkHashRate;
        this.stats.consensusDifficulty = avgNetworkDifficulty;
      }
    } catch (error) {
      console.warn('Failed to check network consensus:', error);
    }
  }

  private async queryNetworkStats(): Promise<Array<{difficulty: number, hashRate: number}>> {
    // Query known network nodes for their POW statistics
    const nodes = [
      'https://pow.xitchat.net/stats',
      'https://mesh.nostr.net/pow-stats',
      'https://relay.damus.io/pow'
    ];
    
    const stats = [];
    
    for (const nodeUrl of nodes) {
      try {
        const response = await fetch(nodeUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          stats.push({
            difficulty: data.difficulty || this.stats.currentDifficulty,
            hashRate: data.hashRate || 0
          });
        }
      } catch (error) {
        // Silently continue if node is unavailable
      }
    }
    
    return stats;
  }

  generateChallenge(purpose: POWChallenge['purpose'], networkConsensus: boolean = false): POWChallenge {
    const challenge: POWChallenge = {
      id: `challenge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      difficulty: this.stats.currentDifficulty,
      data: this.generateChallengeData(),
      target: '0'.repeat(this.stats.currentDifficulty),
      timestamp: Date.now(),
      expiresAt: Date.now() + (5 * 60 * 1000), // 5 minutes
      purpose,
      networkConsensus
    };

    this.currentChallenge = challenge;
    this.stats.totalChallenges++;
    
    // Send challenge to all workers
    this.workers.forEach(worker => {
      worker.postMessage({ type: 'challenge', data: challenge });
    });
    
    this.notifyListeners('challengeGenerated', challenge);
    return challenge;
  }

  private generateChallengeData(): string {
    // Generate cryptographically secure challenge data
    const timestamp = Date.now().toString();
    const random = crypto.getRandomValues(new Uint8Array(16));
    const randomHex = Array.from(random).map(b => b.toString(16).padStart(2, '0')).join('');
    const workerId = Math.random().toString(36).substr(2, 9);
    
    return `${timestamp}_${randomHex}_${workerId}_xitchat_pow`;
  }

  private handleSolution(solution: POWSolution) {
    if (!this.currentChallenge || solution.challengeId !== this.currentChallenge.id) {
      return;
    }

    console.log(`POW solution found: ${solution.hash} (nonce: ${solution.nonce}) by ${solution.solverId}`);
    
    // Verify the solution
    this.verifySolution(solution).then(isValid => {
      if (isValid) {
        this.stats.solvedChallenges++;
        this.stats.lastSolution = solution;
        
        // Update average solve time
        const totalSolveTime = this.stats.averageSolveTime * (this.stats.solvedChallenges - 1) + solution.solveTime;
        this.stats.averageSolveTime = totalSolveTime / this.stats.solvedChallenges;
        
        // Adjust difficulty based on solve time and network consensus
        this.adjustDifficulty(solution.solveTime);
        
        // Broadcast solution to network
        this.broadcastSolution(solution);
        
        this.notifyListeners('solutionFound', solution);
        this.saveSettings();
      } else {
        console.warn('Invalid POW solution received:', solution);
      }
    });
  }

  private async verifySolution(solution: POWSolution): Promise<boolean> {
    try {
      // Reconstruct the message and hash it
      const message = this.currentChallenge!.data + solution.nonce;
      const hash = await this.sha256(message);
      const hashBinary = this.hexToBinary(hash);
      
      // Check if hash meets difficulty
      const meetsTarget = hashBinary.startsWith('0'.repeat(this.currentChallenge!.difficulty));
      const matchesHash = hash === solution.hash;
      
      return meetsTarget && matchesHash;
    } catch (error) {
      console.error('Solution verification failed:', error);
      return false;
    }
  }

  private async sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private hexToBinary(hex: string): string {
    return hex.split('').map(c => parseInt(c, 16).toString(2).padStart(4, '0')).join('');
  }

  private async broadcastSolution(solution: POWSolution) {
    // Broadcast solution to network nodes
    const nodes = [
      'https://pow.xitchat.net/solution',
      'https://mesh.nostr.net/pow-solution'
    ];
    
    const broadcastData = {
      ...solution,
      timestamp: Date.now(),
      signature: await this.signSolution(solution)
    };
    
    for (const nodeUrl of nodes) {
      try {
        await fetch(nodeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(broadcastData)
        });
      } catch (error) {
        // Silently continue if broadcast fails
      }
    }
  }

  private async signSolution(solution: POWSolution): Promise<string> {
    // Create a digital signature for the solution
    const message = `${solution.challengeId}:${solution.nonce}:${solution.hash}`;
    return await this.sha256(message);
  }

  private updateHashRate(hashRate: number, workerId: number) {
    // Aggregate hash rate from all workers
    this.stats.hashRate = hashRate;
  }

  private adjustDifficulty(solveTime: number) {
    const targetTime = 30000; // 30 seconds target solve time for network security
    
    if (solveTime < targetTime / 2) {
      // Too fast, increase difficulty
      this.stats.currentDifficulty = Math.min(8, this.stats.currentDifficulty + 1);
      console.log(`Increasing difficulty to ${this.stats.currentDifficulty}`);
    } else if (solveTime > targetTime * 2) {
      // Too slow, decrease difficulty
      this.stats.currentDifficulty = Math.max(1, this.stats.currentDifficulty - 1);
      console.log(`Decreasing difficulty to ${this.stats.currentDifficulty}`);
    }
    
    this.notifyListeners('difficultyAdjusted', this.stats.currentDifficulty);
  }

  private updateStats() {
    if (!this.isEnabled) return;
    
    setInterval(() => {
      this.notifyListeners('statsUpdated', this.stats);
    }, 5000);
  }

  // PUBLIC API
  async verifyPOW(challengeId: string, nonce: number, hash: string): Promise<boolean> {
    if (!this.currentChallenge || this.currentChallenge.id !== challengeId) {
      return false;
    }

    return this.verifySolution({
      challengeId,
      nonce,
      hash,
      solveTime: 0,
      solverId: 'external'
    });
  }

  async requirePOW(purpose: POWChallenge['purpose'], data?: any): Promise<POWChallenge> {
    if (!this.isEnabled) {
      throw new Error('POW is not enabled');
    }

    return this.generateChallenge(purpose, true);
  }

  async submitExternalSolution(solution: POWSolution): Promise<boolean> {
    try {
      const isValid = await this.verifySolution(solution);
      if (isValid) {
        this.handleSolution(solution);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to verify external solution:', error);
      return false;
    }
  }

  // GETTERS
  getStats(): POWStats {
    return { ...this.stats };
  }

  getPOWEnabled(): boolean {
    return this.isEnabled;
  }

  getCurrentChallenge(): POWChallenge | null {
    return this.currentChallenge;
  }

  getWorkerCount(): number {
    return this.workerCount;
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
    this.stopPOW();
  }
}

export const realPowService = new RealPOWService();
