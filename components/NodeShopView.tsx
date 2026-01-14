import React, { useState, useEffect } from 'react';

interface ShopItem {
  id: string;
  name: string;
  price: number;
  category: 'theme' | 'avatar' | 'effect' | 'badge';
  description: string;
  rarity: 'free' | 'common' | 'rare' | 'epic' | 'legendary';
  preview?: string;
  theme?: string;
  isPurchased: boolean;
  isEquipped: boolean;
  isLimited?: boolean;
  isNew?: boolean;
  discount?: number;
}

interface NodeShopViewProps {
  balance: number;
  onBuyItem: (name: string, price: number, itemTheme?: string) => void;
  currentTheme: string;
  onBack: () => void;
}

const NodeShopView: React.FC<NodeShopViewProps> = ({ 
  balance, 
  onBuyItem, 
  currentTheme, 
  onBack 
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'theme' | 'avatar' | 'effect' | 'badge'>('all');
  const [items, setItems] = useState<ShopItem[]>([]);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [ownedItems, setOwnedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Load purchased items from localStorage
    const saved = localStorage.getItem('nodeshop_purchases');
    if (saved) {
      const purchased = JSON.parse(saved);
      setOwnedItems(new Set(purchased));
    }
  }, []);

  const shopItems: ShopItem[] = [
    // FREE THEMES
    {
      id: 'theme_black',
      name: 'Terminal Black',
      price: 0,
      category: 'theme',
      description: 'Classic terminal theme with green text',
      rarity: 'free',
      theme: 'black',
      isPurchased: true,
      isEquipped: currentTheme === 'black'
    },
    {
      id: 'theme_matrix',
      name: 'Matrix Green',
      price: 0,
      category: 'theme',
      description: 'Inspired by the Matrix digital rain',
      rarity: 'free',
      theme: 'matrix',
      isPurchased: true,
      isEquipped: currentTheme === 'matrix'
    },
    
    // PREMIUM THEMES
    {
      id: 'theme_cyan',
      name: 'Cyber Cyan',
      price: 50,
      category: 'theme',
      description: 'Futuristic cyan with neon glow effects',
      rarity: 'common',
      theme: 'cyan',
      isPurchased: false,
      isEquipped: false
    },
    {
      id: 'theme_purple',
      name: 'Neon Purple',
      price: 75,
      category: 'theme',
      description: 'Vibrant purple with pink accents',
      rarity: 'common',
      theme: 'purple',
      isPurchased: false,
      isEquipped: false,
      isNew: true
    },
    {
      id: 'theme_sunset',
      name: 'Sunset Orange',
      price: 100,
      category: 'theme',
      description: 'Warm sunset colors with gradient effects',
      rarity: 'rare',
      theme: 'sunset',
      isPurchased: false,
      isEquipped: false
    },
    
    // EXCLUSIVE THEMES
    {
      id: 'theme_holographic',
      name: 'Holographic',
      price: 150,
      category: 'theme',
      description: 'Iridescent holographic effect',
      rarity: 'epic',
      theme: 'holographic',
      isPurchased: false,
      isEquipped: false,
      isLimited: true
    },
    {
      id: 'theme_glitch',
      name: 'Glitch Art',
      price: 200,
      category: 'theme',
      description: 'Digital glitch aesthetic with artifacts',
      rarity: 'legendary',
      theme: 'glitch',
      isPurchased: false,
      isEquipped: false,
      isLimited: true,
      isNew: true
    },

    // FREE AVATARS
    {
      id: 'avatar_basic',
      name: 'Basic Circle',
      price: 0,
      category: 'avatar',
      description: 'Simple geometric circle avatar',
      rarity: 'free',
      isPurchased: true,
      isEquipped: false
    },
    {
      id: 'avatar_square',
      name: 'Tech Square',
      price: 0,
      category: 'avatar',
      description: 'Minimalist square design',
      rarity: 'free',
      isPurchased: true,
      isEquipped: false
    },

    // PREMIUM AVATARS
    {
      id: 'avatar_cat',
      name: 'Cyber Cat',
      price: 30,
      category: 'avatar',
      description: 'Futuristic cat avatar with glowing eyes',
      rarity: 'common',
      isPurchased: false,
      isEquipped: false
    },
    {
      id: 'avatar_dragon',
      name: 'Tech Dragon',
      price: 75,
      category: 'avatar',
      description: 'Mechanical dragon with circuits',
      rarity: 'rare',
      isPurchased: false,
      isEquipped: false,
      isNew: true
    },
    {
      id: 'avatar_robot',
      name: 'Robot Node',
      price: 100,
      category: 'avatar',
      description: 'Advanced robot with LED display',
      rarity: 'rare',
      isPurchased: false,
      isEquipped: false
    },

    // EXCLUSIVE AVATARS
    {
      id: 'avatar_animated',
      name: 'Animated Avatar',
      price: 150,
      category: 'avatar',
      description: 'Animated 3D avatar with effects',
      rarity: 'epic',
      isPurchased: false,
      isEquipped: false,
      isLimited: true
    },

    // FREE EFFECTS
    {
      id: 'effect_glow',
      name: 'Basic Glow',
      price: 0,
      category: 'effect',
      description: 'Simple glowing effect',
      rarity: 'free',
      isPurchased: true,
      isEquipped: false
    },

    // PREMIUM EFFECTS
    {
      id: 'effect_rainbow',
      name: 'Rainbow Shimmer',
      price: 25,
      category: 'effect',
      description: 'Colorful rainbow shimmer effect',
      rarity: 'common',
      isPurchased: false,
      isEquipped: false
    },
    {
      id: 'effect_electric',
      name: 'Electric Spark',
      price: 50,
      category: 'effect',
      description: 'Electric sparks and lightning',
      rarity: 'rare',
      isPurchased: false,
      isEquipped: false,
      isNew: true
    },
    {
      id: 'effect_matrix_rain',
      name: 'Matrix Rain',
      price: 75,
      category: 'effect',
      description: 'Falling matrix code effect',
      rarity: 'rare',
      isPurchased: false,
      isEquipped: false
    },

    // EXCLUSIVE EFFECTS
    {
      id: 'effect_particles',
      name: 'Particle Explosion',
      price: 100,
      category: 'effect',
      description: 'Explosive particle effects',
      rarity: 'epic',
      isPurchased: false,
      isEquipped: false,
      isLimited: true
    },

    // FREE BADGES
    {
      id: 'badge_newbie',
      name: 'New User',
      price: 0,
      category: 'badge',
      description: 'Welcome to XitChat!',
      rarity: 'free',
      isPurchased: true,
      isEquipped: false
    },

    // PREMIUM BADGES
    {
      id: 'badge_early',
      name: 'Early Adopter',
      price: 20,
      category: 'badge',
      description: 'For early XitChat users',
      rarity: 'common',
      isPurchased: false,
      isEquipped: false
    },
    {
      id: 'badge_buzz',
      name: 'Buzz Master',
      price: 40,
      category: 'badge',
      description: 'Posted 10+ buzz messages',
      rarity: 'rare',
      isPurchased: false,
      isEquipped: false
    },
    {
      id: 'badge_mesh',
      name: 'Mesh Pioneer',
      price: 40,
      category: 'badge',
      description: 'Connected to 50+ mesh nodes',
      rarity: 'rare',
      isPurchased: false,
      isEquipped: false
    },

    // EXCLUSIVE BADGES
    {
      id: 'badge_vip',
      name: 'VIP Member',
      price: 60,
      category: 'badge',
      description: 'Premium XitChat member',
      rarity: 'epic',
      isPurchased: false,
      isEquipped: false,
      isNew: true
    },
    {
      id: 'badge_creator',
      name: 'Content Creator',
      price: 80,
      category: 'badge',
      description: 'Created popular content',
      rarity: 'legendary',
      isPurchased: false,
      isEquipped: false,
      isLimited: true
    }
  ];

  // Update items with purchase status
  useEffect(() => {
    const updatedItems = shopItems.map(item => ({
      ...item,
      isPurchased: ownedItems.has(item.id) || item.price === 0,
      isEquipped: item.price === 0 && currentTheme === item.theme
    }));
    setItems(updatedItems);
  }, [ownedItems, currentTheme]);

  const filteredItems = items.filter(item => 
    selectedCategory === 'all' || item.category === selectedCategory
  );

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'border-gray-500 text-gray-400';
      case 'rare': return 'border-blue-500 text-blue-400';
      case 'epic': return 'border-purple-500 text-purple-400';
      case 'legendary': return 'border-yellow-500 text-yellow-400';
      default: return 'border-gray-500 text-gray-400';
    }
  };

  const getRarityBg = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'bg-gray-500/10';
      case 'rare': return 'bg-blue-500/10';
      case 'epic': return 'bg-purple-500/10';
      case 'legendary': return 'bg-yellow-500/10';
      default: return 'bg-gray-500/10';
    }
  };

  const handlePurchase = () => {
    if (!selectedItem) return;
    
    if (balance < selectedItem.price) {
      alert('INSUFFICIENT_FUNDS: Please top up your XC units at JoeBanker.');
      return;
    }

    // Process purchase
    onBuyItem(selectedItem.name, selectedItem.price, selectedItem.theme);
    
    // Update owned items
    const newOwned = new Set(ownedItems);
    newOwned.add(selectedItem.id);
    setOwnedItems(newOwned);
    localStorage.setItem('nodeshop_purchases', JSON.stringify([...newOwned]));
    
    // Update item status
    setItems(prev => prev.map(item => 
      item.id === selectedItem.id 
        ? { ...item, isPurchased: true }
        : item
    ));

    setShowPurchaseModal(false);
    setSelectedItem(null);

    // Show success message
    alert(`PURCHASE_COMPLETE: ${selectedItem.name} added to your inventory!`);
  };

  const handleEquipItem = (item: ShopItem) => {
    if (item.category === 'theme' && item.theme) {
      onBuyItem(item.name, 0, item.theme); // Use existing buy function for theme change
    }
    // For other categories, you could implement equip logic here
  };

  const categories = [
    { id: 'all', label: 'ALL', icon: 'fa-border-all' },
    { id: 'theme', label: 'THEMES', icon: 'fa-palette' },
    { id: 'avatar', label: 'AVATARS', icon: 'fa-user-astronaut' },
    { id: 'effect', label: 'EFFECTS', icon: 'fa-sparkles' },
    { id: 'badge', label: 'BADGES', icon: 'fa-certificate' }
  ];

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-black text-current font-mono no-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 border-b border-current pb-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="terminal-btn px-2 py-0 h-8 text-[10px] uppercase">back_to_hub</button>
          <div>
            <h2 className="text-lg font-bold uppercase tracking-tighter glow-text">nodeshop.exe</h2>
            <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest text-white/30">digital_gear_protocol</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[6px] font-bold opacity-50 uppercase tracking-widest text-white/40">xc_balance</p>
            <p className="text-md font-bold text-white glow-text">{balance} XC</p>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2 no-scrollbar">
        {categories.map(cat => (
          <button 
            key={cat.id} 
            onClick={() => setSelectedCategory(cat.id as any)}
            className={`terminal-btn px-4 h-8 text-[9px] uppercase tracking-widest transition-all flex items-center gap-2 ${
              selectedCategory === cat.id ? 'active' : 'opacity-40 hover:opacity-100'
            }`}
          >
            <i className={`fa-solid ${cat.icon}`}></i>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Shop Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map(item => (
          <div 
            key={item.id} 
            className={`border border-current border-opacity-20 bg-[#050505] p-5 group hover:border-white/40 transition-all relative overflow-hidden ${
              getRarityBg(item.rarity)
            }`}
          >
            {/* Rarity Indicator */}
            <div className={`absolute top-2 right-2 px-2 py-1 border text-[8px] font-black uppercase tracking-widest ${getRarityColor(item.rarity)}`}>
              {item.rarity}
            </div>

            {/* Item Preview */}
            <div className="flex items-center justify-center h-20 mb-4">
              {item.preview ? (
                <span className="text-4xl">{item.preview}</span>
              ) : item.category === 'theme' ? (
                <div className={`w-16 h-16 border-2 border-current rounded ${item.isEquipped ? 'bg-current/20' : ''}`}></div>
              ) : (
                <i className="fa-solid fa-cube text-2xl opacity-50"></i>
              )}
            </div>

            {/* Item Info */}
            <div className="mb-4">
              <h3 className="text-lg font-bold uppercase text-white group-hover:glow-text transition-all">
                {item.name}
              </h3>
              <p className="text-[10px] opacity-60 uppercase tracking-widest mt-1">
                {item.category}
              </p>
              <p className="text-xs opacity-40 mt-2 line-clamp-2">
                {item.description}
              </p>
            </div>

            {/* Status */}
            {item.isEquipped && (
              <div className="mb-3 px-2 py-1 bg-green-500/20 border border-green-500 text-green-400 text-[8px] font-black uppercase text-center">
                EQUIPPED
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {item.isPurchased ? (
                <button 
                  onClick={() => handleEquipItem(item)}
                  disabled={item.isEquipped}
                  className="terminal-btn flex-1 py-2 text-[10px] uppercase font-bold disabled:opacity-20"
                >
                  {item.isEquipped ? 'EQUIPPED' : 'EQUIP'}
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => {
                      setSelectedItem(item);
                      setShowPurchaseModal(true);
                    }}
                    disabled={balance < item.price}
                    className="terminal-btn active flex-1 py-2 text-[10px] uppercase font-bold disabled:opacity-20"
                  >
                    {item.price} XC
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Purchase Modal */}
      {showPurchaseModal && selectedItem && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 animate-in fade-in">
          <div className="max-w-md w-full border-2 border-current bg-[#050505] p-8 shadow-[0_0_50px_currentColor]">
            <h3 className="text-lg font-bold uppercase tracking-widest mb-6 glow-text text-center">confirm_purchase.exe</h3>
            
            <div className="space-y-6">
              <div className="p-4 border border-current border-opacity-20">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-white">{selectedItem.name}</h4>
                  <span className={`text-[8px] font-black uppercase px-2 py-1 border ${getRarityColor(selectedItem.rarity)}`}>
                    {selectedItem.rarity}
                  </span>
                </div>
                <p className="text-sm opacity-60">{selectedItem.description}</p>
                <p className="text-lg font-bold glow-text mt-2">{selectedItem.price} XC</p>
              </div>
              
              <div className="p-3 bg-[#080808] border border-current border-opacity-20">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] uppercase tracking-widest">your_balance:</span>
                  <span className="font-bold text-white">{balance} XC</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-[10px] uppercase tracking-widest">after_purchase:</span>
                  <span className="font-bold text-white">{balance - selectedItem.price} XC</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    setShowPurchaseModal(false);
                    setSelectedItem(null);
                  }} 
                  className="terminal-btn py-3 uppercase text-[10px]"
                >
                  cancel
                </button>
                <button 
                  onClick={handlePurchase}
                  className="terminal-btn active py-3 uppercase text-[10px]"
                >
                  confirm_purchase
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NodeShopView;
