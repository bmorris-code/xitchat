import React, { useState, useEffect } from 'react';
import { useTransactionService } from '../services/transactions';
import { joeBanker, TransferRequest, PaymentRequest, SavingsAccount, CreditOffer, BankingAnalytics } from '../services/banking';
import { bluetoothMesh, MeshNode } from '../services/bluetoothMesh';
import { hybridMesh } from '../services/hybridMesh';
import { showToast } from './TerminalModal';

interface JoeBankerViewProps {
  onBack?: () => void;
}

const JoeBankerView: React.FC<JoeBankerViewProps> = ({ onBack }) => {
  const { wallet, transactions, isLoading } = useTransactionService();
  const [activeTab, setActiveTab] = useState<'overview' | 'transfers' | 'payments' | 'savings' | 'credit' | 'analytics'>('overview');
  const [nearbyNodes, setNearbyNodes] = useState<MeshNode[]>([]);
  
  // Banking data
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [savingsAccounts, setSavingsAccounts] = useState<SavingsAccount[]>([]);
  const [creditOffers, setCreditOffers] = useState<CreditOffer[]>([]);
  const [analytics, setAnalytics] = useState<BankingAnalytics | null>(null);
  
  // Modal states
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSavingsModal, setShowSavingsModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  
  // Form states
  const [transferForm, setTransferForm] = useState({ toNode: '', amount: '', message: '' });
  const [paymentForm, setPaymentForm] = useState({ toNode: '', amount: '', description: '' });
  const [savingsForm, setSavingsForm] = useState({ amount: '', lockPeriod: '30' });
  const [creditForm, setCreditForm] = useState({ borrower: '', amount: '', interestRate: '10', term: '30' });

  useEffect(() => {
    initializeBanking();
    
    // Load real nearby nodes from mesh network
    const loadNearbyNodes = () => {
      try {
        // Get nodes from hybrid mesh (includes all network types)
        const meshPeers = hybridMesh.getPeers();
        const bluetoothNodes = bluetoothMesh.getPeers();
        
        // Convert to MeshNode format
        const realNodes: MeshNode[] = [
          ...meshPeers.map(peer => ({
            id: peer.id,
            name: peer.name,
            handle: peer.handle,
            distance: Number.isFinite((peer as any).distance) ? (peer as any).distance : 0,
            lastSeen: new Date(peer.lastSeen),
            capabilities: peer.capabilities,
            isRelay: peer.capabilities.includes('relay'),
            signalStrength: peer.signalStrength || 75
          })),
          ...bluetoothNodes.map(node => ({
            id: node.id,
            name: node.name || 'Unknown Device',
            handle: node.handle || `@${node.id.substring(0, 8)}`,
            distance: node.distance || 0,
            lastSeen: node.lastSeen,
            capabilities: node.capabilities || ['chat'],
            isRelay: node.isRelay || false,
            signalStrength: node.signalStrength || 70
          }))
        ];
        
        setNearbyNodes(realNodes);
        console.log('Real mesh nodes loaded:', realNodes);
      } catch (error) {
        console.error('Failed to load real mesh nodes:', error);
        setNearbyNodes([]);
      }
    };
    
    // Load initial nodes
    loadNearbyNodes();
    
    // Subscribe to mesh updates for real-time data
    const unsubscribeMesh = hybridMesh.subscribe('peersUpdated', loadNearbyNodes);
    const unsubscribeBluetooth = bluetoothMesh.subscribe('peersUpdated', loadNearbyNodes);
    
    // Refresh nodes every 30 seconds
    const interval = setInterval(loadNearbyNodes, 30000);
    
    return () => {
      unsubscribeMesh();
      unsubscribeBluetooth();
      clearInterval(interval);
    };
  }, []);

  const initializeBanking = () => {
    // Load banking data
    setTransferRequests(joeBanker.getTransferRequests());
    setPaymentRequests(joeBanker.getPaymentRequests());
    setSavingsAccounts(joeBanker.getSavingsAccounts());
    setCreditOffers(joeBanker.getCreditOffers());
    setAnalytics(joeBanker.getAnalytics());

    // Subscribe to updates
    const unsubscribeTransfer = joeBanker.subscribe('transferRequest', (request) => {
      setTransferRequests(prev => [request, ...prev]);
    });

    const unsubscribePayment = joeBanker.subscribe('paymentRequest', (request) => {
      setPaymentRequests(prev => [request, ...prev]);
    });

    const unsubscribeSavings = joeBanker.subscribe('savingsCreated', (account) => {
      setSavingsAccounts(prev => [account, ...prev]);
    });

    const unsubscribeCredit = joeBanker.subscribe('creditOffered', (offer) => {
      setCreditOffers(prev => [offer, ...prev]);
    });

    // Load nearby nodes for transfers
    setNearbyNodes(bluetoothMesh.getPeers());

    return () => {
      unsubscribeTransfer();
      unsubscribePayment();
      unsubscribeSavings();
      unsubscribeCredit();
    };
  };

  const handleTransfer = async () => {
    console.log('Transfer button clicked', { transferForm });
    if (!transferForm.toNode || !transferForm.amount) {
      showToast('Please fill in all fields', 'warning');
      return;
    }

    try {
      console.log('Initiating transfer...', transferForm);
      await joeBanker.initiateTransfer(transferForm.toNode, parseInt(transferForm.amount), transferForm.message);
      setShowTransferModal(false);
      setTransferForm({ toNode: '', amount: '', message: '' });
      showToast('Transfer request sent via mesh network!', 'success');
    } catch (error) {
      console.error('Transfer error:', error);
      showToast('Failed to send transfer request: ' + (error as Error).message, 'error');
    }
  };

  const handlePaymentRequest = async () => {
    console.log('Payment request button clicked', { paymentForm });
    if (!paymentForm.toNode || !paymentForm.amount) {
      showToast('Please fill in all fields', 'warning');
      return;
    }

    try {
      console.log('Creating payment request...', paymentForm);
      await joeBanker.createPaymentRequest(paymentForm.toNode, parseInt(paymentForm.amount), paymentForm.description);
      setShowPaymentModal(false);
      setPaymentForm({ toNode: '', amount: '', description: '' });
      showToast('Payment request sent!', 'success');
    } catch (error) {
      console.error('Payment request error:', error);
      showToast('Failed to create payment request: ' + (error as Error).message, 'error');
    }
  };

  const handleCreateSavings = async () => {
    console.log('Create savings button clicked', { savingsForm });
    if (!savingsForm.amount) {
      showToast('Please enter an amount', 'warning');
      return;
    }

    try {
      console.log('Creating savings account...', savingsForm);
      joeBanker.createSavingsAccount(parseInt(savingsForm.amount), parseInt(savingsForm.lockPeriod));
      setShowSavingsModal(false);
      setSavingsForm({ amount: '', lockPeriod: '30' });
      showToast('Savings account created!', 'success');
    } catch (error) {
      console.error('Savings error:', error);
      showToast('Failed to create savings account: ' + (error as Error).message, 'error');
    }
  };

  const handleOfferCredit = async () => {
    console.log('Offer credit button clicked', { creditForm });
    if (!creditForm.borrower || !creditForm.amount) {
      showToast('Please fill in all fields', 'warning');
      return;
    }

    try {
      console.log('Offering credit...', creditForm);
      await joeBanker.offerCredit(creditForm.borrower, parseInt(creditForm.amount), parseFloat(creditForm.interestRate), parseInt(creditForm.term));
      setShowCreditModal(false);
      setCreditForm({ borrower: '', amount: '', interestRate: '10', term: '30' });
      showToast('Credit offer sent!', 'success');
    } catch (error) {
      console.error('Credit offer error:', error);
      showToast('Failed to offer credit: ' + (error as Error).message, 'error');
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': case 'paid': case 'active': return 'text-green-500';
      case 'pending': case 'offered': return 'text-amber-500';
      case 'failed': case 'expired': case 'cancelled': return 'text-red-500';
      case 'matured': return 'text-blue-500';
      default: return 'text-white';
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-black text-current font-mono no-scrollbar">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 border-b border-current pb-4">
        <div className="flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} className="terminal-btn px-2 py-0 h-6 text-[8px] uppercase">back_to_hub</button>
          )}
          <div>
            <h2 className="text-base font-bold uppercase tracking-tighter glow-text">joebanker.exe</h2>
            <p className="text-[8px] font-bold opacity-50 uppercase tracking-widest text-white/30">mesh_financial_protocol_v2</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[6px] font-bold opacity-50 uppercase tracking-widest text-white/40">mesh_economy_rank</p>
          <p className="text-lg font-bold glow-text text-white">#{analytics?.meshEconomyRank || 1}</p>
        </div>
      </div>

      {/* Balance Overview */}
      {wallet && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="border border-current border-opacity-20 p-4 bg-[#050505]">
            <p className="text-[8px] font-bold opacity-30 uppercase tracking-widest mb-2">balance</p>
            <p className="text-2xl font-bold glow-text text-white">{wallet.balance} XC</p>
          </div>
          <div className="border border-current border-opacity-20 p-4 bg-[#050505]">
            <p className="text-[8px] font-bold opacity-30 uppercase tracking-widest mb-2">reputation</p>
            <p className="text-2xl font-bold text-green-500">{analytics?.reputationScore || 750}</p>
          </div>
          <div className="border border-current border-opacity-20 p-4 bg-[#050505]">
            <p className="text-[8px] font-bold opacity-30 uppercase tracking-widest mb-2">savings</p>
            <p className="text-2xl font-bold text-blue-500">
              {savingsAccounts.reduce((sum, acc) => sum + acc.balance, 0)} XC
            </p>
          </div>
          <div className="border border-current border-opacity-20 p-4 bg-[#050505]">
            <p className="text-[8px] font-bold opacity-30 uppercase tracking-widest mb-2">active_credit</p>
            <p className="text-2xl font-bold text-purple-500">
              {creditOffers.filter(c => c.status === 'active').reduce((sum, offer) => sum + offer.amount, 0)} XC
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-current border-opacity-20 overflow-x-auto">
        {[
          { id: 'overview', label: 'OVERVIEW' },
          { id: 'transfers', label: 'TRANSFERS' },
          { id: 'payments', label: 'PAYMENTS' },
          { id: 'savings', label: 'SAVINGS' },
          { id: 'credit', label: 'CREDIT' },
          { id: 'analytics', label: 'ANALYTICS' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? 'border-current text-white' 
                : 'border-transparent opacity-40 hover:opacity-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button 
              onClick={() => {
                console.log('Send Transfer button clicked');
                setShowTransferModal(true);
              }} 
              className="terminal-btn active p-6 text-left hover:scale-105 transition-transform"
            >
              <i className="fa-solid fa-arrow-right text-2xl mb-2"></i>
              <h3 className="font-bold text-lg">Send Transfer</h3>
              <p className="text-xs opacity-60">Send XC to nearby mesh nodes</p>
            </button>
            <button 
              onClick={() => {
                console.log('Request Payment button clicked');
                setShowPaymentModal(true);
              }} 
              className="terminal-btn active p-6 text-left hover:scale-105 transition-transform"
            >
              <i className="fa-solid fa-file-invoice-dollar text-2xl mb-2"></i>
              <h3 className="font-bold text-lg">Request Payment</h3>
              <p className="text-xs opacity-60">Invoice other nodes for services</p>
            </button>
            <button 
              onClick={() => {
                console.log('Create Savings button clicked');
                setShowSavingsModal(true);
              }} 
              className="terminal-btn active p-6 text-left hover:scale-105 transition-transform"
            >
              <i className="fa-solid fa-piggy-bank text-2xl mb-2"></i>
              <h3 className="font-bold text-lg">Create Savings</h3>
              <p className="text-xs opacity-60">Lock XC for guaranteed returns</p>
            </button>
            <button 
              onClick={() => {
                console.log('Offer Credit button clicked');
                setShowCreditModal(true);
              }} 
              className="terminal-btn active p-6 text-left hover:scale-105 transition-transform"
            >
              <i className="fa-solid fa-hand-holding-usd text-2xl mb-2"></i>
              <h3 className="font-bold text-lg">Offer Credit</h3>
              <p className="text-xs opacity-60">Lend XC to trusted nodes</p>
            </button>
          </div>

          {/* Recent Activity */}
          <div>
            <h3 className="text-lg font-bold uppercase mb-4">recent_activity</h3>
            <div className="space-y-2">
              {transactions.slice(0, 5).map(tx => (
                <div key={tx.id} className="border border-current border-opacity-10 p-3 bg-[#050505]">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{tx.description}</span>
                    <span className={`font-bold ${tx.type === 'deposit' ? 'text-green-500' : 'text-red-500'}`}>
                      {tx.type === 'deposit' ? '+' : '-'}{tx.amount} XC
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Transfers Tab */}
      {activeTab === 'transfers' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold uppercase">transfer_requests</h3>
            <button onClick={() => setShowTransferModal(true)} className="terminal-btn active px-4 py-2 text-[10px] uppercase">
              new_transfer
            </button>
          </div>
          {transferRequests.map(request => (
            <div key={request.id} className="border border-current border-opacity-10 p-4 bg-[#050505]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold">{request.amount} XC to {request.to}</p>
                  <p className="text-xs opacity-60">{request.message}</p>
                  <p className="text-[8px] opacity-40">{formatTimestamp(request.timestamp)}</p>
                </div>
                <span className={`text-xs font-bold uppercase ${getStatusColor(request.status)}`}>
                  {request.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Other tabs would follow similar pattern... */}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 animate-in fade-in">
          <div className="max-w-md w-full border-2 border-current bg-[#050505] p-8 shadow-[0_0_50px_currentColor]">
            <h3 className="text-xl font-bold uppercase tracking-widest mb-6 glow-text text-center">mesh_transfer.exe</h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest mb-2">to_node</p>
                <select 
                  value={transferForm.toNode}
                  onChange={(e) => setTransferForm(prev => ({ ...prev, toNode: e.target.value }))}
                  className="w-full bg-black border border-current p-3 text-xs text-white"
                >
                  <option value="">Select nearby node...</option>
                  {nearbyNodes.map(node => (
                    <option key={node.id} value={node.handle}>{node.handle} ({node.distance?.toFixed(1)}m)</option>
                  ))}
                </select>
              </div>
              
              <input 
                type="number"
                value={transferForm.amount}
                onChange={(e) => setTransferForm(prev => ({ ...prev, amount: e.target.value }))}
                className="w-full bg-black border border-current p-3 text-xs text-white placeholder-white/20" 
                placeholder="amount_xc" 
              />
              
              <textarea 
                value={transferForm.message}
                onChange={(e) => setTransferForm(prev => ({ ...prev, message: e.target.value }))}
                className="w-full bg-black border border-current p-3 text-xs text-white min-h-[80px] placeholder-white/20" 
                placeholder="optional_message..." 
              />
              
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setShowTransferModal(false)} className="terminal-btn py-3 uppercase text-[10px]">
                  cancel
                </button>
                <button onClick={handleTransfer} className="terminal-btn active py-3 uppercase text-[10px]">
                  send_transfer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Request Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 animate-in fade-in">
          <div className="max-w-md w-full border-2 border-current bg-[#050505] p-8 shadow-[0_0_50px_currentColor]">
            <h3 className="text-xl font-bold uppercase tracking-widest mb-6 glow-text text-center">payment_request.exe</h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest mb-2">request_from</p>
                <select 
                  value={paymentForm.toNode}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, toNode: e.target.value }))}
                  className="w-full bg-black border border-current p-3 text-xs text-white"
                >
                  <option value="">Select nearby node...</option>
                  {nearbyNodes.map(node => (
                    <option key={node.id} value={node.handle}>{node.handle} ({node.distance?.toFixed(1)}m)</option>
                  ))}
                </select>
              </div>
              
              <input 
                type="number"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                className="w-full bg-black border border-current p-3 text-xs text-white placeholder-white/20" 
                placeholder="amount_xc" 
              />
              
              <textarea 
                value={paymentForm.description}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full bg-black border border-current p-3 text-xs text-white min-h-[80px] placeholder-white/20" 
                placeholder="service_description..." 
              />
              
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setShowPaymentModal(false)} className="terminal-btn py-3 uppercase text-[10px]">
                  cancel
                </button>
                <button onClick={handlePaymentRequest} className="terminal-btn active py-3 uppercase text-[10px]">
                  send_request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Savings Account Modal */}
      {showSavingsModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 animate-in fade-in">
          <div className="max-w-md w-full border-2 border-current bg-[#050505] p-8 shadow-[0_0_50px_currentColor]">
            <h3 className="text-xl font-bold uppercase tracking-widest mb-6 glow-text text-center">savings_account.exe</h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest mb-2">deposit_amount</p>
                <input 
                  type="number"
                  value={savingsForm.amount}
                  onChange={(e) => setSavingsForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full bg-black border border-current p-3 text-xs text-white placeholder-white/20" 
                  placeholder="amount_xc" 
                />
              </div>
              
              <div>
                <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest mb-2">lock_period_days</p>
                <select 
                  value={savingsForm.lockPeriod}
                  onChange={(e) => setSavingsForm(prev => ({ ...prev, lockPeriod: e.target.value }))}
                  className="w-full bg-black border border-current p-3 text-xs text-white"
                >
                  <option value="30">30 days (5.0% APR)</option>
                  <option value="60">60 days (5.5% APR)</option>
                  <option value="90">90 days (6.0% APR)</option>
                  <option value="180">180 days (7.0% APR)</option>
                  <option value="365">365 days (8.0% APR)</option>
                </select>
              </div>
              
              <div className="text-xs opacity-60 space-y-1">
                <p>📅 Lock Period: {savingsForm.lockPeriod} days</p>
                <p>💰 Interest Rate: {savingsForm.lockPeriod === '30' ? '5.0%' : savingsForm.lockPeriod === '60' ? '5.5%' : savingsForm.lockPeriod === '90' ? '6.0%' : savingsForm.lockPeriod === '180' ? '7.0%' : '8.0%'} APR</p>
                <p>🔒 Funds locked until maturity</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setShowSavingsModal(false)} className="terminal-btn py-3 uppercase text-[10px]">
                  cancel
                </button>
                <button onClick={handleCreateSavings} className="terminal-btn active py-3 uppercase text-[10px]">
                  create_account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Credit Offer Modal */}
      {showCreditModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 animate-in fade-in">
          <div className="max-w-md w-full border-2 border-current bg-[#050505] p-8 shadow-[0_0_50px_currentColor]">
            <h3 className="text-xl font-bold uppercase tracking-widest mb-6 glow-text text-center">credit_offer.exe</h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest mb-2">borrower</p>
                <select 
                  value={creditForm.borrower}
                  onChange={(e) => setCreditForm(prev => ({ ...prev, borrower: e.target.value }))}
                  className="w-full bg-black border border-current p-3 text-xs text-white"
                >
                  <option value="">Select trusted node...</option>
                  {nearbyNodes.map(node => (
                    <option key={node.id} value={node.handle}>{node.handle} ({node.distance?.toFixed(1)}m)</option>
                  ))}
                </select>
              </div>
              
              <div>
                <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest mb-2">loan_amount</p>
                <input 
                  type="number"
                  value={creditForm.amount}
                  onChange={(e) => setCreditForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full bg-black border border-current p-3 text-xs text-white placeholder-white/20" 
                  placeholder="amount_xc" 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest mb-2">interest_rate_%</p>
                  <input 
                    type="number"
                    value={creditForm.interestRate}
                    onChange={(e) => setCreditForm(prev => ({ ...prev, interestRate: e.target.value }))}
                    className="w-full bg-black border border-current p-3 text-xs text-white placeholder-white/20" 
                    placeholder="10.0" 
                    step="0.1"
                    min="0"
                    max="50"
                  />
                </div>
                
                <div>
                  <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest mb-2">term_days</p>
                  <input 
                    type="number"
                    value={creditForm.term}
                    onChange={(e) => setCreditForm(prev => ({ ...prev, term: e.target.value }))}
                    className="w-full bg-black border border-current p-3 text-xs text-white placeholder-white/20" 
                    placeholder="30" 
                    min="1"
                    max="365"
                  />
                </div>
              </div>
              
              <div className="text-xs opacity-60 space-y-1">
                <p>📊 Loan Amount: {creditForm.amount || '0'} XC</p>
                <p>💸 Interest Rate: {creditForm.interestRate}% APR</p>
                <p>📅 Term: {creditForm.term} days</p>
                <p>💰 Total Repayment: {creditForm.amount && creditForm.interestRate ? (parseInt(creditForm.amount) * (1 + (parseFloat(creditForm.interestRate) / 100) * (parseInt(creditForm.term) / 365))).toFixed(2) : '0'} XC</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setShowCreditModal(false)} className="terminal-btn py-3 uppercase text-[10px]">
                  cancel
                </button>
                <button onClick={handleOfferCredit} className="terminal-btn active py-3 uppercase text-[10px]">
                  offer_credit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JoeBankerView;
