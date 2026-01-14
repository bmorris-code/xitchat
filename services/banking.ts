import { Transaction, Wallet } from './transactions';
import { bluetoothMesh, MeshNode } from './bluetoothMesh';
import { meshDataSync } from './meshDataSync';

export interface TransferRequest {
  id: string;
  from: string;
  to: string;
  amount: number;
  message: string;
  timestamp: number;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  expiresAt: number;
}

export interface PaymentRequest {
  id: string;
  from: string;
  to: string;
  amount: number;
  description: string;
  timestamp: number;
  status: 'pending' | 'paid' | 'cancelled' | 'expired';
  expiresAt: number;
}

export interface SavingsAccount {
  id: string;
  balance: number;
  interestRate: number;
  lockPeriod: number; // in days
  createdAt: number;
  maturesAt: number;
  status: 'active' | 'matured' | 'withdrawn';
}

export interface CreditOffer {
  id: string;
  lender: string;
  borrower: string;
  amount: number;
  interestRate: number;
  term: number; // in days
  collateral?: string;
  status: 'offered' | 'accepted' | 'active' | 'completed' | 'defaulted';
  timestamp: number;
}

export interface BankingAnalytics {
  totalTransactions: number;
  averageTransaction: number;
  mostActiveDay: string;
  spendingCategories: { [key: string]: number };
  meshEconomyRank: number;
  reputationScore: number;
}

class JoeBankerService {
  private transferRequests: TransferRequest[] = [];
  private paymentRequests: PaymentRequest[] = [];
  private savingsAccounts: SavingsAccount[] = [];
  private creditOffers: CreditOffer[] = [];
  private analytics: BankingAnalytics;
  private listeners: { [key: string]: ((data: any) => void)[] } = {};

  constructor() {
    this.initializeAnalytics();
    this.loadFromStorage();
    this.startBackgroundProcesses();
  }

  private initializeAnalytics() {
    this.analytics = {
      totalTransactions: 0,
      averageTransaction: 0,
      mostActiveDay: 'Monday',
      spendingCategories: {},
      meshEconomyRank: 1,
      reputationScore: 750
    };
  }

  private loadFromStorage() {
    try {
      const saved = localStorage.getItem('joebanker_data');
      if (saved) {
        const data = JSON.parse(saved);
        this.transferRequests = data.transferRequests || [];
        this.paymentRequests = data.paymentRequests || [];
        this.savingsAccounts = data.savingsAccounts || [];
        this.creditOffers = data.creditOffers || [];
        this.analytics = data.analytics || this.analytics;
      }
    } catch (error) {
      console.error('Failed to load banking data:', error);
    }
  }

  private saveToStorage() {
    localStorage.setItem('joebanker_data', JSON.stringify({
      transferRequests: this.transferRequests,
      paymentRequests: this.paymentRequests,
      savingsAccounts: this.savingsAccounts,
      creditOffers: this.creditOffers,
      analytics: this.analytics
    }));
  }

  private startBackgroundProcesses() {
    // Process expired requests
    setInterval(() => {
      this.processExpiredRequests();
      this.processMaturedSavings();
      this.updateAnalytics();
    }, 60000); // Every minute
  }

  // P2P TRANSFERS
  async initiateTransfer(toNode: string, amount: number, message: string): Promise<string> {
    const transferId = `transfer_${Date.now()}`;
    
    const request: TransferRequest = {
      id: transferId,
      from: 'me',
      to: toNode,
      amount,
      message,
      timestamp: Date.now(),
      status: 'pending',
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };

    this.transferRequests.push(request);

    // Send transfer request via mesh
    const meshMessage = {
      type: 'transfer_request',
      payload: request
    };

    await bluetoothMesh.sendMessage(toNode, JSON.stringify(meshMessage));
    this.saveToStorage();
    this.notifyListeners('transferRequest', request);

    return transferId;
  }

  async acceptTransfer(transferId: string): Promise<boolean> {
    const transfer = this.transferRequests.find(t => t.id === transferId);
    if (!transfer || transfer.status !== 'pending') return false;

    transfer.status = 'completed';
    
    // Create transaction record
    const transaction: Transaction = {
      id: `tx_${Date.now()}`,
      type: 'deposit',
      amount: transfer.amount,
      description: `Transfer from ${transfer.from}`,
      status: 'completed',
      counterparty: transfer.from,
      timestamp: Date.now()
    };

    // IMPORTANT: Banking data is NEVER synced to mesh - stays local only
    // This protects user privacy and financial data
    // await meshDataSync.syncBankingTransaction(transaction); // REMOVED

    this.updateAnalytics();
    this.saveToStorage();
    this.notifyListeners('transferCompleted', transfer);

    return true;
  }

  // PAYMENT REQUESTS
  async createPaymentRequest(toNode: string, amount: number, description: string): Promise<string> {
    const requestId = `payment_${Date.now()}`;
    
    const request: PaymentRequest = {
      id: requestId,
      from: 'me',
      to: toNode,
      amount,
      description,
      timestamp: Date.now(),
      status: 'pending',
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    };

    this.paymentRequests.push(request);

    // Send payment request via mesh
    const meshMessage = {
      type: 'payment_request',
      payload: request
    };

    await bluetoothMesh.sendMessage(toNode, JSON.stringify(meshMessage));
    this.saveToStorage();
    this.notifyListeners('paymentRequest', request);

    return requestId;
  }

  async payPaymentRequest(requestId: string): Promise<boolean> {
    const request = this.paymentRequests.find(r => r.id === requestId);
    if (!request || request.status !== 'pending') return false;

    request.status = 'paid';
    
    // Create transaction record
    const transaction: Transaction = {
      id: `tx_${Date.now()}`,
      type: 'purchase',
      amount: request.amount,
      description: request.description,
      status: 'completed',
      counterparty: request.to,
      timestamp: Date.now()
    };

    this.updateAnalytics();
    this.saveToStorage();
    this.notifyListeners('paymentCompleted', request);

    return true;
  }

  // SAVINGS ACCOUNTS
  createSavingsAccount(amount: number, lockPeriod: number, interestRate: number = 5.0): string {
    const accountId = `savings_${Date.now()}`;
    
    const account: SavingsAccount = {
      id: accountId,
      balance: amount,
      interestRate,
      lockPeriod,
      createdAt: Date.now(),
      maturesAt: Date.now() + (lockPeriod * 24 * 60 * 60 * 1000),
      status: 'active'
    };

    this.savingsAccounts.push(account);
    this.saveToStorage();
    this.notifyListeners('savingsCreated', account);

    return accountId;
  }

  withdrawSavings(accountId: string): boolean {
    const account = this.savingsAccounts.find(a => a.id === accountId);
    if (!account || account.status !== 'matured') return false;

    account.status = 'withdrawn';
    
    // Add interest to balance
    const interest = account.balance * (account.interestRate / 100) * (account.lockPeriod / 365);
    const totalAmount = account.balance + interest;

    // Create withdrawal transaction
    const transaction: Transaction = {
      id: `tx_${Date.now()}`,
      type: 'withdrawal',
      amount: totalAmount,
      description: `Savings withdrawal + interest`,
      status: 'completed',
      timestamp: Date.now()
    };

    this.updateAnalytics();
    this.saveToStorage();
    this.notifyListeners('savingsWithdrawn', { account, totalAmount });

    return true;
  }

  // CREDIT SYSTEM
  async offerCredit(borrower: string, amount: number, interestRate: number, term: number): Promise<string> {
    const offerId = `credit_${Date.now()}`;
    
    const offer: CreditOffer = {
      id: offerId,
      lender: 'me',
      borrower,
      amount,
      interestRate,
      term,
      status: 'offered',
      timestamp: Date.now()
    };

    this.creditOffers.push(offer);

    // Send credit offer via mesh
    const meshMessage = {
      type: 'credit_offer',
      payload: offer
    };

    await bluetoothMesh.sendMessage(borrower, JSON.stringify(meshMessage));
    this.saveToStorage();
    this.notifyListeners('creditOffered', offer);

    return offerId;
  }

  acceptCreditOffer(offerId: string): boolean {
    const offer = this.creditOffers.find(o => o.id === offerId);
    if (!offer || offer.status !== 'offered') return false;

    offer.status = 'active';
    
    // Create loan transaction
    const transaction: Transaction = {
      id: `tx_${Date.now()}`,
      type: 'deposit',
      amount: offer.amount,
      description: `Credit from ${offer.lender}`,
      status: 'completed',
      counterparty: offer.lender,
      timestamp: Date.now()
    };

    this.saveToStorage();
    this.notifyListeners('creditAccepted', offer);

    return true;
  }

  // ANALYTICS
  private updateAnalytics() {
    // Calculate mesh economy rank based on activity
    const activityScore = this.transferRequests.length + this.paymentRequests.length + this.savingsAccounts.length;
    this.analytics.meshEconomyRank = Math.max(1, Math.floor(activityScore / 10) + 1);
    
    // Update reputation score based on successful transactions
    const successfulTransfers = this.transferRequests.filter(t => t.status === 'completed').length;
    this.analytics.reputationScore = Math.min(1000, 750 + (successfulTransfers * 5));
  }

  private processExpiredRequests() {
    const now = Date.now();
    
    // Expire transfer requests
    this.transferRequests.forEach(transfer => {
      if (transfer.status === 'pending' && transfer.expiresAt < now) {
        transfer.status = 'expired';
      }
    });

    // Expire payment requests
    this.paymentRequests.forEach(request => {
      if (request.status === 'pending' && request.expiresAt < now) {
        request.status = 'expired';
      }
    });

    this.saveToStorage();
  }

  private processMaturedSavings() {
    const now = Date.now();
    
    this.savingsAccounts.forEach(account => {
      if (account.status === 'active' && account.maturesAt <= now) {
        account.status = 'matured';
        this.notifyListeners('savingsMatured', account);
      }
    });

    this.saveToStorage();
  }

  // GETTERS
  getTransferRequests(): TransferRequest[] {
    return this.transferRequests;
  }

  getPaymentRequests(): PaymentRequest[] {
    return this.paymentRequests;
  }

  getSavingsAccounts(): SavingsAccount[] {
    return this.savingsAccounts;
  }

  getCreditOffers(): CreditOffer[] {
    return this.creditOffers;
  }

  getAnalytics(): BankingAnalytics {
    return this.analytics;
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

export const joeBanker = new JoeBankerService();
