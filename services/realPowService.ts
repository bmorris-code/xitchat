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
    this.isEnabled = true;
    this.loadSettings();
  }

  private loadSettings() {
    try {
      const saved = localStorage.getItem('pow_settings');
      if (saved) {
        const settings = JSON.parse(saved);
        // Enable POW
        this.isEnabled = true;
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

      // SHA-256 implementation using Web Crypto API or Polyfill
      async function sha256(message) {
        if (self.crypto && self.crypto.subtle) {
             const msgBuffer = new TextEncoder().encode(message);
             const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
             const hashArray = Array.from(new Uint8Array(hashBuffer));
             const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
             return hashHex;
        } else {
             return sha256Polyfill(message);
        }
      }

      // Minimal SHA-256 Polyfill for non-secure contexts
      function sha256Polyfill(ascii) {
            function rightRotate(value, amount) {
                return (value >>> amount) | (value << (32 - amount));
            }
            
            var mathPow = Math.pow;
            var maxWord = mathPow(2, 32);
            var lengthProperty = 'length';
            var i, j; // Used as a counter across the whole file
            var result = '';
            var words = [];
            var asciiBitLength = ascii[lengthProperty] * 8;
            
            //* caching results is optional - remove/add slash from front of this line to toggle
            // Initial hash value: first 32 bits of the fractional parts of the square roots of the first 8 primes
            // (we actually calculate the first 64, but extra values are just ignored)
            var hash = sha256Polyfill.h = sha256Polyfill.h || [];
            // Round constants: first 32 bits of the fractional parts of the cube roots of the first 64 primes
            var k = sha256Polyfill.k = sha256Polyfill.k || [];
            var primeCounter = k[lengthProperty];
            /*/
            var hash = [], k = [];
            var primeCounter = 0;
            //*/

            var isComposite = {};
            for (var candidate = 2; primeCounter < 64; candidate++) {
                if (!isComposite[candidate]) {
                    for (i = 0; i < 313; i += candidate) {
                        isComposite[i] = candidate;
                    }
                    hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
                    k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
                }
            }
            
            ascii += '\x80'; // Append '1' bit (plus zero padding)
            while (ascii[lengthProperty] % 64 - 56) ascii += '\x00'; // More zero padding
            for (i = 0; i < ascii[lengthProperty]; i++) {
                j = ascii.charCodeAt(i);
                if (j >> 8) return; // ASCII check: only support characters > 255
                words[i >> 2] |= j << ((3 - i) % 4) * 8;
            }
            words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0);
            words[words[lengthProperty]] = (asciiBitLength)
            
            for (j = 0; j < words[lengthProperty];) {
                var w = words.slice(j, j += 16);
                var oldHash = hash;
                // This is now the "working hash", often labelled as variables a...h
                // (we have to copy the list so that we don't affect the original)
                hash = hash.slice(0, 8);
                
                for (i = 0; i < 64; i++) {
                    var i2 = i + j;
                    // Expand the message into 64 words
                    // Used below if 
                    var w15 = w[i - 15], w2 = w[i - 2];
        
                    // Iterate
                    var a = hash[0], e = hash[4];
                    var temp1 = hash[7]
                        + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) // S1
                        + ((e & hash[5]) ^ ((~e) & hash[6])) // ch
                        + k[i]
                        // Expand the message schedule if needed
                        + (w[i] = (i < 16) ? w[i] : (
                                w[i - 16]
                                + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) // s0
                                + w[i - 7]
                                + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10)) // s1
                            ) | 0
                        );
                    // This is only used once, so *could* be moved below, but it only saves 4 bytes and makes things unreadble
                    var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) // S0
                        + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2])); // maj
                    
                    hash = [(temp1 + temp2) | 0].concat(hash);
                    hash[4] = (hash[4] + temp1) | 0;
                }
                
                for (i = 0; i < 8; i++) {
                    hash[i] = (hash[i] + oldHash[i]) | 0;
                }
            }
            
            for (i = 0; i < 8; i++) {
                for (j = 3; j + 1; j--) {
                    var b = (hash[i] >> (j * 8)) & 255;
                    result += ((b < 16) ? 0 : '') + b.toString(16);
                }
            }
            return result;
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

  private async queryNetworkStats(): Promise<Array<{ difficulty: number, hashRate: number }>> {
    // Query known network nodes for their POW statistics
    // Note: These are placeholder endpoints for simulation. In a real app, these would be real servers.
    // We return empty for now to avoid console errors.
    return [];
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
    const random = new Uint8Array(16);
    if (window.crypto) {
      window.crypto.getRandomValues(random);
    } else {
      // Fallback for non-secure contexts
      for (let i = 0; i < 16; i++) random[i] = Math.floor(Math.random() * 256);
    }
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
      if (!this.currentChallenge || solution.challengeId !== this.currentChallenge.id) {
        return false;
      }

      // Reconstruct the message and hash it
      const message = this.currentChallenge.data + solution.nonce;
      const hash = await this.sha256(message);
      const hashBinary = this.hexToBinary(hash);

      // Check if hash meets difficulty
      const meetsTarget = hashBinary.startsWith('0'.repeat(this.currentChallenge.difficulty));
      const matchesHash = hash === solution.hash;

      return meetsTarget && matchesHash;
    } catch (error) {
      console.error('Solution verification failed:', error);
      return false;
    }
  }

  private async sha256(message: string): Promise<string> {
    if (window.crypto && window.crypto.subtle) {
      try {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {
        // Fallback to polyfill
      }
    }
    return this.sha256Polyfill(message);
  }

  private sha256Polyfill(ascii: string): string {
    function rightRotate(value: number, amount: number) {
      return (value >>> amount) | (value << (32 - amount));
    }

    var mathPow = Math.pow;
    var maxWord = mathPow(2, 32);
    var lengthProperty = 'length';
    var i, j;
    var result = '';
    var words: any[] = [];
    var asciiBitLength = ascii.length * 8;

    var hash = (this.sha256Polyfill as any).h = (this.sha256Polyfill as any).h || [];
    var k = (this.sha256Polyfill as any).k = (this.sha256Polyfill as any).k || [];
    var primeCounter = k.length;

    var isComposite: any = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) {
          isComposite[i] = candidate;
        }
        hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }

    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii.length; i++) {
      j = ascii.charCodeAt(i);
      if (j >> 8) return ''; // ASCII check: only support characters > 255
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = ((asciiBitLength / maxWord) | 0);
    words[words.length] = (asciiBitLength)

    for (j = 0; j < words.length;) {
      var w = words.slice(j, j += 16);
      var oldHash = hash;
      hash = hash.slice(0, 8);

      for (i = 0; i < 64; i++) {
        var i2 = i + j;
        var w15 = w[i - 15], w2 = w[i - 2];

        var a = hash[0], e = hash[4];
        var temp1 = hash[7]
          + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) // S1
          + ((e & hash[5]) ^ ((~e) & hash[6])) // ch
          + k[i]
          + (w[i] = (i < 16) ? w[i] : (
            w[i - 16]
            + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) // s0
            + w[i - 7]
            + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10)) // s1
          ) | 0
          );
        var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) // S0
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2])); // maj

        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }

      for (i = 0; i < 8; i++) {
        hash[i] = (hash[i] + oldHash[i]) | 0;
      }
    }

    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        var b = (hash[i] >> (j * 8)) & 255;
        result += ((b < 16) ? 0 : '') + b.toString(16);
      }
    }
    return result;
  }

  private hexToBinary(hex: string): string {
    return hex.split('').map(c => parseInt(c, 16).toString(2).padStart(4, '0')).join('');
  }

  private async broadcastSolution(solution: POWSolution) {
    // Broadcast solution to network nodes
    // Note: Disabled for simulation to prevent network errors
    return;
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
