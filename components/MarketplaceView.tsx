
import React, { useState, useEffect } from 'react';
import { Listing } from '../types';
import { realMarketplaceService } from '../services/realMarketplaceService';

// Fix: MarketplaceListing now correctly extends Listing without type conflicts on category
interface MarketplaceListing extends Listing {
  location?: string;
}

const MOCK_LISTINGS: MarketplaceListing[] = [
  { id: 'l1', title: 'Vintage Gameboy Color', price: '450 XC', senderHandle: '@retro_king', timestamp: Date.now() - 3600000, category: 'HAVE', description: 'Purple edition, works perfectly. No scratches.' },
  { id: 'l2', title: 'Need Math Tutor', price: 'Negotiable', senderHandle: '@student_x', timestamp: Date.now() - 7200000, category: 'WANT', description: 'Help with Calculus 2. Can pay in XC or Moola.' },
  { id: 'l3', title: 'Bike Repair Service', price: '50 XC/hr', senderHandle: '@spoke_master', timestamp: Date.now() - 14400000, category: 'SERVICE', description: 'Available weekends for tune-ups and flat fixes.' },
  { id: 'l4', title: 'Node Meetup: Central Park', price: 'FREE', senderHandle: '@admin_node', timestamp: Date.now() - 1800000, category: 'EVENT', description: 'Saturday @ 2PM. Come chat offline and trade skins!', location: 'Sector 428F' },
];

interface MarketplaceViewProps {
  onBack: () => void;
  onContact: (handle: string) => void;
}

const MarketplaceView: React.FC<MarketplaceViewProps> = ({ onBack, onContact }) => {
  const [filter, setFilter] = useState<'ALL' | 'HAVE' | 'WANT' | 'SERVICE' | 'EVENT'>('ALL');
  const [showPostModal, setShowPostModal] = useState(false);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);

  // Load real-time listings
  useEffect(() => {
    // Initial load
    setListings(realMarketplaceService.getListings(filter));

    // Subscribe to real-time updates
    const unsubscribeListingAdded = realMarketplaceService.subscribe('listingAdded', (listing) => {
      setListings(prev => [listing, ...prev]);
    });

    const unsubscribeListingUpdated = realMarketplaceService.subscribe('listingUpdated', (listing) => {
      setListings(prev => prev.map(l => l.id === listing.id ? listing : l));
    });

    const unsubscribeListingRemoved = realMarketplaceService.subscribe('listingRemoved', ({ id }) => {
      setListings(prev => prev.filter(l => l.id !== id));
    });

    const unsubscribeListingReceived = realMarketplaceService.subscribe('listingReceived', (listing) => {
      setListings(prev => [listing, ...prev]);
    });

    return () => {
      unsubscribeListingAdded();
      unsubscribeListingUpdated();
      unsubscribeListingRemoved();
      unsubscribeListingReceived();
    };
  }, []);

  // Update listings when filter changes
  useEffect(() => {
    setListings(realMarketplaceService.getListings(filter));
  }, [filter]);

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-black text-current font-mono no-scrollbar">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="terminal-btn px-2 py-0 h-8 text-[10px] uppercase">back_to_hub</button>
      </div>

      <div className="flex justify-between items-center mb-8 border-b border-current pb-4">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-tighter glow-text">local_trade.bbs</h2>
          <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest text-white/30">community_bulletin_board_v4</p>
        </div>
        <button onClick={() => setShowPostModal(true)} className="terminal-btn active px-2 py-1 text-[8px] uppercase font-bold">+ New_Broadcast</button>
      </div>

      <div className="flex gap-2 mb-8 overflow-x-auto pb-2 no-scrollbar">
        {['ALL', 'HAVE', 'WANT', 'SERVICE', 'EVENT'].map(cat => (
          <button 
            key={cat} 
            onClick={() => setFilter(cat as any)}
            className={`terminal-btn px-4 h-8 text-[9px] uppercase tracking-widest transition-all ${filter === cat ? 'active' : 'opacity-40 hover:opacity-100'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {listings.map(item => (
          <div key={item.id} className="border border-current border-opacity-10 bg-[#050505] p-5 group hover:border-white/40 transition-all flex flex-col gap-3 relative">
            {item.category === 'EVENT' && (
              <div className="absolute top-0 right-0 px-3 py-1 bg-white text-black text-[8px] font-black uppercase tracking-widest">
                verified_gathering
              </div>
            )}
            
            <div className="flex justify-between items-start">
              <div>
                <span className={`text-[8px] font-bold px-2 py-0.5 border ${
                  item.category === 'HAVE' ? 'border-green-500 text-green-500' : 
                  item.category === 'WANT' ? 'border-amber-500 text-amber-500' : 
                  item.category === 'EVENT' ? 'border-white text-white' : 'border-cyan-500 text-cyan-500'
                }`}>
                  {item.category}
                </span>
                <h3 className="text-lg font-bold uppercase mt-2 text-white group-hover:glow-text transition-all">{item.title}</h3>
                <p className="text-[10px] opacity-40 uppercase tracking-widest mt-1">origin: {item.senderHandle} {item.location ? `| loc: ${item.location}` : ''}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-black glow-text text-white">{item.price}</p>
                <p className="text-[8px] opacity-30 uppercase mt-1">val_units</p>
              </div>
            </div>
            <p className="text-xs opacity-60 leading-relaxed text-white/70 italic">&gt; {item.description}</p>
            <div className="flex gap-4 mt-2">
              <button 
                onClick={() => onContact(item.senderHandle)}
                className="terminal-btn active flex-1 py-1 text-[10px] uppercase font-bold shadow-lg"
              >
                {item.category === 'EVENT' ? 'join_gathering' : 'contact_node'}
              </button>
              <button className="terminal-btn flex-1 py-1 text-[10px] uppercase font-bold opacity-30 hover:opacity-100 transition-opacity">save_id</button>
            </div>
          </div>
        ))}
      </div>

      {showPostModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 animate-in fade-in">
          <div className="max-w-md w-full border-2 border-current bg-[#050505] p-8 shadow-[0_0_50px_currentColor]">
            <h3 className="text-xl font-bold uppercase tracking-widest mb-6 glow-text text-center">broadcast_init.exe</h3>
            <div className="space-y-4">
              <input className="w-full bg-black border border-current p-3 text-xs text-white placeholder-white/20" placeholder="broadcast_title" />
              <select className="w-full bg-black border border-current p-3 text-xs text-white">
                <option>HAVE (Trade Something)</option>
                <option>WANT (Looking For)</option>
                <option>SERVICE (Offer Help)</option>
                <option>EVENT (Local Meetup)</option>
              </select>
              <input className="w-full bg-black border border-current p-3 text-xs text-white placeholder-white/20" placeholder="reward / xc_units" />
              <textarea className="w-full bg-black border border-current p-3 text-xs text-white min-h-[100px] placeholder-white/20" placeholder="detailed_listing_data..."></textarea>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setShowPostModal(false)} className="terminal-btn py-3 uppercase text-[10px]">abort</button>
                <button className="terminal-btn active py-3 uppercase text-[10px]">push_to_bbs</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketplaceView;
