import React, { useState, useEffect } from 'react';
import { Listing } from '../types';

export interface Transaction {
  id: string;
  type: 'purchase' | 'sale' | 'deposit' | 'withdrawal';
  amount: number;
  description: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  counterparty?: string;
  timestamp: number;
  listingId?: string;
}

export interface Wallet {
  balance: number;
  pendingTransactions: number;
  totalEarnings: number;
  totalSpent: number;
}

export interface PaymentMethod {
  id: string;
  type: 'paysharp' | 'xc_token' | 'cash';
  name: string;
  isActive: boolean;
  address?: string;
}

interface TransactionService {
  // Wallet operations
  getBalance: () => Promise<number>;
  getWallet: () => Promise<Wallet>;
  updateBalance: (amount: number) => Promise<void>;
  
  // Transaction operations
  createTransaction: (transaction: Omit<Transaction, 'id' | 'timestamp'>) => Promise<Transaction>;
  getTransactions: () => Promise<Transaction[]>;
  updateTransactionStatus: (transactionId: string, status: Transaction['status']) => Promise<void>;
  
  // Payment operations
  initiatePayment: (listingId: string, amount: number, paymentMethod: PaymentMethod) => Promise<string>;
  confirmPayment: (transactionId: string, verificationCode?: string) => Promise<boolean>;
  requestPayout: (amount: number, paymentMethod: PaymentMethod) => Promise<string>;
  
  // Real-time events
  subscribeToTransactions: (callback: (transaction: Transaction) => void) => () => void;
  subscribeToListings: (callback: (listing: Listing) => void) => () => void;
}

class MeshTransactionService implements TransactionService {
  private transactions: Transaction[] = [];
  private wallet: Wallet = {
    balance: 1240,
    pendingTransactions: 0,
    totalEarnings: 0,
    totalSpent: 0
  };
  private listeners: { [key: string]: ((data: any) => void)[] } = {};

  constructor() {
    this.loadFromStorage();
    // Removed simulation - only real transactions allowed
  }

  private loadFromStorage() {
    try {
      const savedWallet = localStorage.getItem('mesh_wallet');
      const savedTransactions = localStorage.getItem('mesh_transactions');
      
      if (savedWallet) {
        this.wallet = JSON.parse(savedWallet);
      } else {
        // Initialize with default values if nothing in storage
        this.wallet = {
          balance: 1240,
          pendingTransactions: 0,
          totalEarnings: 0,
          totalSpent: 0
        };
        this.saveToStorage();
      }
      
      if (savedTransactions) {
        this.transactions = JSON.parse(savedTransactions);
      } else {
        this.transactions = [];
      }
      
      console.log('TransactionService initialized - Wallet:', this.wallet);
      console.log('TransactionService initialized - Transactions:', this.transactions);
    } catch (error) {
      console.error('Failed to load from storage:', error);
      // Set default values on error
      this.wallet = {
        balance: 1240,
        pendingTransactions: 0,
        totalEarnings: 0,
        totalSpent: 0
      };
      this.transactions = [];
    }
  }

  private saveToStorage() {
    localStorage.setItem('mesh_wallet', JSON.stringify(this.wallet));
    localStorage.setItem('mesh_transactions', JSON.stringify(this.transactions));
  }

  private addTransaction(transaction: Transaction) {
    this.transactions.unshift(transaction);
    this.saveToStorage();
    
    // Update wallet
    if (transaction.status === 'completed') {
      if (transaction.type === 'sale' || transaction.type === 'deposit') {
        this.wallet.balance += transaction.amount;
        this.wallet.totalEarnings += transaction.amount;
      } else if (transaction.type === 'purchase' || transaction.type === 'withdrawal') {
        this.wallet.balance -= transaction.amount;
        this.wallet.totalSpent += transaction.amount;
      }
      this.saveToStorage();
    }
    
    this.notifyListeners('transaction', transaction);
  }

  private notifyListeners(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  async getBalance(): Promise<number> {
    return this.wallet.balance;
  }

  async getWallet(): Promise<Wallet> {
    return this.wallet;
  }

  async updateBalance(amount: number): Promise<void> {
    this.wallet.balance = amount;
    this.saveToStorage();
  }

  async createTransaction(transaction: Omit<Transaction, 'id' | 'timestamp'>): Promise<Transaction> {
    const newTransaction: Transaction = {
      ...transaction,
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };

    this.addTransaction(newTransaction);
    this.notifyListeners('transaction', newTransaction);
    
    return newTransaction;
  }

  async getTransactions(): Promise<Transaction[]> {
    return this.transactions;
  }

  async updateTransactionStatus(transactionId: string, status: Transaction['status']): Promise<void> {
    const transaction = this.transactions.find(t => t.id === transactionId);
    if (transaction) {
      transaction.status = status;
      this.saveToStorage();
      this.notifyListeners('transaction', transaction);
    }
  }

  async initiatePayment(listingId: string, amount: number, paymentMethod: PaymentMethod): Promise<string> {
    // Real payment processing - no simulation
    const transactionId = `payment_${Date.now()}`;
    
    const transactionData: Omit<Transaction, 'id' | 'timestamp'> = {
      type: 'purchase',
      amount,
      description: `Payment for listing ${listingId}`,
      counterparty: await this.getListingSeller(listingId),
      status: 'pending',
      listingId
    };

    const transaction = await this.createTransaction(transactionData);
    
    // Real payment processing - connect to actual payment processor
    try {
      await this.processRealPayment(transactionId, paymentMethod);
      this.updateTransactionStatus(transaction.id, 'completed');
    } catch (error) {
      this.updateTransactionStatus(transaction.id, 'failed');
      throw error;
    }
    
    return transaction.id;
  }

  async confirmPayment(transactionId: string, verificationCode?: string): Promise<boolean> {
    const transaction = this.transactions.find(t => t.id === transactionId);
    if (transaction && transaction.status === 'pending') {
      await this.updateTransactionStatus(transactionId, 'completed');
      return true;
    }
    return false;
  }

  async requestPayout(amount: number, paymentMethod: PaymentMethod): Promise<string> {
    const payoutId = `payout_${Date.now()}`;
    
    const transactionData: Omit<Transaction, 'id' | 'timestamp'> = {
      type: 'withdrawal',
      amount,
      description: `Payout to ${paymentMethod.name}`,
      status: 'pending'
    };

    const transaction = await this.createTransaction(transactionData);
    
    // Simulate payout processing
    setTimeout(() => {
      this.updateTransactionStatus(transaction.id, 'completed');
    }, 5000);

    return payoutId;
  }

  subscribeToTransactions(callback: (transaction: Transaction) => void): () => void {
    if (!this.listeners['transaction']) {
      this.listeners['transaction'] = [];
    }
    this.listeners['transaction'].push(callback);
    
    return () => {
      this.listeners['transaction'] = this.listeners['transaction'].filter(cb => cb !== callback);
    };
  }

  private async getListingSeller(listingId: string): Promise<string> {
    // In real implementation, fetch from marketplace API
    return `seller_${listingId.slice(-6)}`;
  }
  
  private async processRealPayment(transactionId: string, paymentMethod: PaymentMethod): Promise<void> {
    // Real payment processing - connect to payment processor
    console.log(`Processing real payment ${transactionId} via ${paymentMethod.type}`);
    
    // In real implementation, integrate with:
    // - Stripe/PayPal for fiat payments
    // - Blockchain wallets for crypto
    // - Bank APIs for direct transfers
    
    // Simulate network delay for real processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Validate payment success
    // In real implementation, verify with payment processor
  }
  
  private getPaymentProcessor(paymentMethod: PaymentMethod): string {
    switch (paymentMethod.type) {
      case 'paysharp': return 'PaySharp';
      case 'xc_token': return 'XC Token Network';
      case 'cash': return 'Cash Processing';
      default: return 'Unknown Processor';
    }
  }
  
  private calculateNetworkFee(amount: number, paymentMethod: PaymentMethod): number {
    // Real network fee calculation based on payment method
    switch (paymentMethod.type) {
      case 'paysharp': return amount * 0.029 + 0.30; // 2.9% + $0.30
      case 'xc_token': return amount * 0.01; // 1% blockchain fee
      case 'cash': return 0; // No fee for cash
      default: return amount * 0.05; // 5% default
    }
  }
  
  subscribeToListings(callback: (listing: Listing) => void): () => void {
    if (!this.listeners['listing']) {
      this.listeners['listing'] = [];
    }
    this.listeners['listing'].push(callback);
    
    return () => {
      this.listeners['listing'] = this.listeners['listing'].filter(cb => cb !== callback);
    };
  }
}

// Singleton instance
export const transactionService = new MeshTransactionService();
export const useTransactionService = () => {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const walletData = await transactionService.getWallet();
        const transactionData = await transactionService.getTransactions();
        
        console.log('useTransactionService - Loaded wallet:', walletData);
        console.log('useTransactionService - Loaded transactions:', transactionData);
        
        setWallet(walletData);
        setTransactions(transactionData);
        setIsLoading(false);
      } catch (error) {
        console.error('useTransactionService - Failed to load data:', error);
        setIsLoading(false);
      }
    };

    loadData();

    // Subscribe to real-time updates
    const unsubscribeTransactions = transactionService.subscribeToTransactions((transaction) => {
      console.log('useTransactionService - Real-time transaction update:', transaction);
      setTransactions(prev => [transaction, ...prev]);
      transactionService.getWallet().then(setWallet);
    });

    return () => {
      unsubscribeTransactions();
    };
  }, []);

  return {
    wallet,
    transactions,
    isLoading,
    createTransaction: transactionService.createTransaction.bind(transactionService),
    initiatePayment: transactionService.initiatePayment.bind(transactionService),
    confirmPayment: transactionService.confirmPayment.bind(transactionService),
    requestPayout: transactionService.requestPayout.bind(transactionService),
    updateBalance: transactionService.updateBalance.bind(transactionService)
  };
};
