
import React, { useState, useEffect, useMemo } from 'react';
import { getLatestBuzz, BuzzItem } from '../services/hybridAI';
import { liveIntelligenceFeed, IntelligenceItem } from '../services/liveIntelligenceFeed';
import { xcEconomy } from '../services/xcEconomy';
import { hybridMesh } from '../services/hybridMesh';

interface Shoutout extends BuzzItem {
  id: string;
  user: {
    name: string;
    handle: string;
    avatar: string;
    distance: string;
  };
  likes: number;
  comments: number;
  isLiked?: boolean;
  commentsList?: Comment[];
}

interface Comment {
  id: string;
  text: string;
  user: {
    name: string;
    handle: string;
    avatar: string;
  };
  timestamp: number;
}

type FilterCategory = 'ALL' | 'NEWS' | 'GOSSIP' | 'UPDATE' | 'AD';

interface BuzzViewProps {
  onBack?: () => void;
}

const BuzzView: React.FC<BuzzViewProps> = ({ onBack }) => {
  const [shoutouts, setShoutouts] = useState<Shoutout[]>([]);
  const [intelligenceItems, setIntelligenceItems] = useState<IntelligenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<FilterCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPostModal, setShowPostModal] = useState(false);
  const [newBuzzText, setNewBuzzText] = useState('');
  const [newBuzzCat, setNewBuzzCat] = useState<FilterCategory>('GOSSIP');
  const [showOptionsMenu, setShowOptionsMenu] = useState<string | null>(null);
  const [showCommentsModal, setShowCommentsModal] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [showShareModal, setShowShareModal] = useState<string | null>(null);
  const [showIntelligenceOnly, setShowIntelligenceOnly] = useState(false);
  const [mutedNodes, setMutedNodes] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('xitchat_muted_buzz_nodes');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // Logged-in user info
  const myName = localStorage.getItem('xitchat_name') || 'Anonymous';
  const myHandle = localStorage.getItem('xitchat_handle') || '@anon';
  const myAvatar = localStorage.getItem('xitchat_avatar') || '';

  // Initialize with live intelligence feed
  useEffect(() => {
    // Load intelligence feed immediately
    setIntelligenceItems(liveIntelligenceFeed.getIntelligenceItems());

    // Subscribe to intelligence updates
    const unsubscribe = liveIntelligenceFeed.subscribe('intelligenceUpdated', (items: IntelligenceItem[]) => {
      setIntelligenceItems(items);
    });

    const unsubscribeNew = liveIntelligenceFeed.subscribe('newIntelligence', (item: IntelligenceItem) => {
      // Trigger transmission toast for new intelligence
      if (window.dispatchEvent) {
        const event = new CustomEvent('newTransmission', {
          detail: {
            message: `INTEL: ${item.title}`,
            type: 'system'
          }
        });
        window.dispatchEvent(event);
      }
    });

    setShoutouts([]);

    // Listen for mesh buzz items
    const handleMeshItem = (event: any) => {
      const newItem = event.detail;
      setShoutouts(prev => {
        if (prev.find(s => s.id === newItem.id)) return prev;
        return [newItem, ...prev];
      });
    };

    window.addEventListener('meshBuzzItem', handleMeshItem);

    // Also try to fetch additional content
    fetchBuzz();

    return () => window.removeEventListener('meshBuzzItem', handleMeshItem);
  }, []);

  const fetchBuzz = async () => {
    setLoading(true);
    try {
      const buzzItemsRaw = await getLatestBuzz();
      const buzzItems = Array.isArray(buzzItemsRaw)
        ? buzzItemsRaw
        : Array.isArray((buzzItemsRaw as any)?.items)
          ? (buzzItemsRaw as any).items
          : [];

      const mapped: Shoutout[] = buzzItems.map((item) => ({
        ...item,
        id: item.id || `${Date.now()}-${item.title}`,
        user: {
          name: 'Live User',
          handle: '@live',
          avatar: '',
          distance: '--'
        },
        likes: 0,
        comments: 0,
        isLiked: false
      }));

      setShoutouts(prev => [...mapped, ...prev]);
    } catch (error) {
      console.error('Failed to fetch buzz:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleLike = (id: string) => {
    setShoutouts(prev => prev.map(s => {
      if (s.id === id) {
        const wasLiked = s.isLiked;
        return { ...s, likes: s.isLiked ? s.likes - 1 : s.likes + 1, isLiked: !s.isLiked };
      }
      return s;
    }));

    // Award XC for interaction (only once per post)
    const shout = shoutouts.find(s => s.id === id);
    if (shout && !shout.isLiked) {
      xcEconomy.awardInteraction();
    }
  };

  const handlePostBuzz = () => {
    if (!newBuzzText.trim()) return;
    const item: Shoutout = {
      id: Date.now().toString(),
      title: 'Local Signal',
      time: 'Just now',
      snippet: newBuzzText,
      category: newBuzzCat === 'ALL' ? 'GOSSIP' : newBuzzCat,
      user: {
        name: myName,
        handle: myHandle,
        avatar: myAvatar,
        distance: '0.0km'
      },
      likes: 0,
      comments: 0,
      commentsList: []
    };
    setShoutouts(prev => [item, ...prev]);

    // Broadcast to mesh
    hybridMesh.sendMessage(JSON.stringify({
      type: 'buzz_item',
      data: item
    }));

    setNewBuzzText('');
    setShowPostModal(false);

    // Award XC for posting buzz
    xcEconomy.awardBuzzPost();
  };

  const handleMuteNode = (handle: string) => {
    setMutedNodes(prev => {
      const next = new Set(prev);
      next.add(handle);
      localStorage.setItem('xitchat_muted_buzz_nodes', JSON.stringify([...next]));
      return next;
    });
    setShowOptionsMenu(null);
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id).then(() => {
      setCopyToast('ID copied to clipboard');
      setTimeout(() => setCopyToast(null), 2000);
    });
    setShowOptionsMenu(null);
  };

  const handleReport = (id: string) => {
    // Broadcast a report signal over the mesh
    hybridMesh.sendMessage(JSON.stringify({
      type: 'buzz_report',
      buzzId: id,
      reporter: myHandle,
      timestamp: Date.now()
    }));
    setCopyToast('Signal reported to mesh');
    setTimeout(() => setCopyToast(null), 2000);
    setShowOptionsMenu(null);
  };

  const handleComment = (buzzId: string) => {
    setShowCommentsModal(buzzId);
  };

  const handlePostComment = () => {
    if (!newCommentText.trim() || !showCommentsModal) return;

    const newComment: Comment = {
      id: Date.now().toString(),
      text: newCommentText,
      user: {
        name: 'Symbolic',
        handle: '@symbolic',
        avatar: '/icon-192.png'
      },
      timestamp: Date.now()
    };

    setShoutouts(prev => prev.map(shout => {
      if (shout.id === showCommentsModal) {
        const commentsList = shout.commentsList || [];
        return {
          ...shout,
          comments: shout.comments + 1,
          commentsList: [...commentsList, newComment]
        };
      }
      return shout;
    }));

    setNewCommentText('');
    setShowCommentsModal(null);

    // Award XC for commenting
    xcEconomy.awardComment();
  };

  const handleShare = (buzzId: string) => {
    setShowShareModal(buzzId);
  };

  const handleShareAction = (method: string) => {
    const buzz = shoutouts.find(s => s.id === showShareModal);
    if (!buzz) return;

    const shareText = `${buzz.snippet} - via XitChat Buzz by ${buzz.user.handle}`;

    switch (method) {
      case 'copy':
        navigator.clipboard.writeText(shareText).then(() => {
          setCopyToast('Copied to clipboard');
          setTimeout(() => setCopyToast(null), 2000);
        });
        break;
      case 'mesh':
        hybridMesh.sendMessage(JSON.stringify({
          type: 'buzz_item',
          data: buzz
        }));
        setCopyToast('Signal broadcast to mesh');
        setTimeout(() => setCopyToast(null), 2000);
        break;
      case 'external':
        if (navigator.share) {
          navigator.share({
            title: buzz.title,
            text: shareText,
            url: window.location.href
          });
        } else {
          navigator.clipboard.writeText(shareText);
        }
        break;
    }

    setShowShareModal(null);
  };

  const filteredShoutouts = useMemo(() => {
    return shoutouts.filter(s => {
      if (mutedNodes.has(s.user.handle)) return false;
      const matchesCategory = currentFilter === 'ALL' || s.category === currentFilter;
      const matchesSearch = !searchQuery.trim() ||
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.snippet.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.user.handle.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [shoutouts, currentFilter, searchQuery, mutedNodes]);

  return (
    <div className="flex-1 flex flex-col pt-0 p-4 sm:p-6 overflow-y-auto bg-black text-current no-scrollbar relative">
      {/* Toast notification */}
      {copyToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] bg-[#00ff41] text-black text-[10px] font-bold uppercase tracking-widest px-4 py-2 shadow-[0_0_20px_#00ff41] animate-in fade-in slide-in-from-top-2">
          {copyToast}
        </div>
      )}
      {/* Sticky Header Group: Title + Filters */}
      <div className="sticky top-0 z-50 bg-black/95 backdrop-blur-md border-b border-current border-opacity-20 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-6 pb-2 mb-4 shadow-lg">
        {/* Title Row */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="terminal-btn px-2 py-0 h-7 text-[10px] uppercase">back</button>
            )}
            <div>
              <h2 className="text-base font-bold uppercase tracking-tighter glow-text">the_buzz.exe</h2>
              <p className="text-[8px] font-bold opacity-50 uppercase tracking-[0.2em] text-white/40">local_mesh_broadcast</p>
            </div>
          </div>
          <button
            onClick={() => setShowPostModal(true)}
            className="terminal-btn active px-2 py-1 flex items-center gap-1 text-[10px] shadow-[0_0_10px_currentColor]"
          >
            <i className="fa-solid fa-tower-broadcast"></i>
            <span className="uppercase tracking-widest font-bold">post</span>
          </button>
        </div>

        {/* Filter Row */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {['ALL', 'NEWS', 'GOSSIP', 'UPDATE', 'AD'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCurrentFilter(cat as FilterCategory)}
              className={`terminal-btn uppercase tracking-widest text-[8px] min-h-0 h-6 font-bold whitespace-nowrap px-3 transition-all flex-shrink-0 ${currentFilter === cat
                ? 'active scale-105 shadow-[0_0_15px_currentColor]'
                : 'opacity-40 hover:opacity-100 hover:bg-white/5'
                }`}
            >
              <i className={`fa-${cat === 'ALL' ? 'globe' : cat === 'NEWS' ? 'newspaper' : cat === 'GOSSIP' ? 'comments' : cat === 'UPDATE' ? 'refresh' : 'bullhorn'} mr-2`}></i>
              {cat}
              {currentFilter === cat && (
                <span className="ml-2 w-1.5 h-1.5 bg-current rounded-full animate-pulse"></span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar (Scrolls with content) */}
      <div className="mb-6 relative group shrink-0">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none opacity-40 group-focus-within:opacity-100 transition-opacity">
          <i className="fa-solid fa-magnifying-glass text-xs"></i>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="search_mesh_signals..."
          className="w-full bg-[#050505] border border-current border-opacity-20 py-3 pl-10 pr-10 text-xs font-mono text-white focus:outline-none focus:border-opacity-100 focus:bg-white/[0.02] transition-all placeholder-white/20"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-4 flex items-center opacity-40 hover:opacity-100 transition-opacity"
          >
            <i className="fa-solid fa-xmark text-xs"></i>
          </button>
        )}
      </div>

      <div className="max-w-2xl w-full mx-auto space-y-4 pb-20">
        {loading && shoutouts.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center opacity-30 gap-4">
            <i className="fa-solid fa-shuttle-space animate-bounce text-4xl"></i>
            <p className="text-xs font-bold uppercase tracking-widest">polling mesh network...</p>
          </div>
        ) : filteredShoutouts.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center opacity-30 gap-4 text-center">
            <i className="fa-solid fa-tower-broadcast text-4xl mb-2 animate-pulse"></i>
            <p className="text-xs font-bold uppercase tracking-widest">no signals found</p>
            {searchQuery && <p className="text-[10px] opacity-40 mt-1">try a different frequency</p>}
            {!searchQuery && (
              <button
                onClick={() => setShowPostModal(true)}
                className="mt-4 terminal-btn active px-6 py-2 text-xs"
              >
                be the first to broadcast
              </button>
            )}
          </div>
        ) : (
          filteredShoutouts.map((shout) => (
            <div key={shout.id} className="border border-current border-opacity-20 p-4 sm:p-6 group hover:bg-white/[0.03] hover:border-white/40 transition-all cursor-pointer relative bg-[#050505]">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 border border-current border-opacity-30 overflow-hidden shrink-0">
                    {shout.user.avatar ? (
                      <img src={shout.user.avatar} className="w-full h-full object-cover grayscale opacity-50 group-hover:opacity-100 transition-all" alt="" />
                    ) : (
                      <div className="w-full h-full bg-gray-600 flex items-center justify-center text-white text-xs">
                        {shout.user.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold tracking-tight text-white">&lt;{shout.user.name}&gt;</h4>
                      {(shout.user.distance.includes('0.') || shout.user.distance === '0.0km') && (
                        <i className="fa-solid fa-circle-check text-[10px] text-[#00ff41]" title="Verified Location"></i>
                      )}
                      <span className="text-[8px] font-bold border border-current border-opacity-40 px-1 uppercase tracking-widest text-white/40">
                        {shout.user.distance}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[7px] border px-1 font-black ${shout.category === 'AD' ? 'border-amber-500 text-amber-500 bg-amber-500/10' : 'border-current border-opacity-40 text-white/40'
                        }`}>
                        {shout.category}
                      </span>
                      <p className="text-[9px] font-bold opacity-30 uppercase text-white/30">{shout.time || 'now'}</p>
                    </div>
                  </div>
                </div>
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowOptionsMenu(showOptionsMenu === shout.id ? null : shout.id); }}
                    className="opacity-30 hover:opacity-100 transition-colors p-2"
                  >
                    <i className="fa-solid fa-ellipsis-vertical"></i>
                  </button>
                  {showOptionsMenu === shout.id && (
                    <div className="absolute right-0 top-full mt-2 w-44 bg-black border border-current z-50 animate-in fade-in slide-in-from-top-2 shadow-2xl">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReport(shout.id); }}
                        className="w-full p-3 text-[10px] font-bold uppercase tracking-widest text-left hover:bg-white/10 flex items-center gap-3 text-red-400 hover:text-red-300"
                      >
                        <i className="fa-solid fa-flag"></i> report signal
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopyId(shout.id); }}
                        className="w-full p-3 text-[10px] font-bold uppercase tracking-widest text-left hover:bg-white/10 flex items-center gap-3"
                      >
                        <i className="fa-solid fa-link"></i> copy id
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMuteNode(shout.user.handle); }}
                        className="w-full p-3 text-[10px] font-bold uppercase tracking-widest text-left hover:bg-white/10 border-t border-current border-opacity-20 flex items-center gap-3 text-amber-400 hover:text-amber-300"
                      >
                        <i className="fa-solid fa-volume-xmark"></i> mute node
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm leading-relaxed text-white/70 italic group-hover:text-white transition-colors">
                  &gt; {shout.snippet}
                </p>
              </div>

              <div className="flex items-center gap-6 pt-4 border-t border-current border-opacity-10">
                <button
                  onClick={(e) => { e.stopPropagation(); handleLike(shout.id); }}
                  className={`flex items-center gap-2 text-[10px] font-bold transition-all ${shout.isLiked ? 'text-red-500 glow-text scale-110' : 'opacity-40 hover:opacity-100 text-white/60'
                    }`}
                >
                  <i className={`fa-${shout.isLiked ? 'solid' : 'regular'} fa-heart`}></i>
                  <span>{shout.likes}</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleComment(shout.id); }}
                  className="flex items-center gap-2 text-[10px] font-bold opacity-40 hover:opacity-100 text-white/60"
                >
                  <i className="fa-regular fa-comment"></i>
                  <span>{shout.comments}</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleShare(shout.id); }}
                  className="flex items-center gap-2 text-[9px] font-bold opacity-40 hover:opacity-100 text-white/60 ml-auto uppercase tracking-widest hover:text-[#00ff41]"
                >
                  <i className="fa-solid fa-share-nodes"></i>
                  <span>share</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Action Button - Responsive Positioning */}
      <button
        onClick={() => setShowPostModal(true)}
        className="fixed bottom-20 right-4 w-12 h-12 bg-current border-2 border-black rounded-full flex items-center justify-center shadow-[0_0_30px_currentColor] animate-pulse z-50 hover:scale-110 transition-transform md:bottom-24 md:right-6"
      >
        <i className="fa-solid fa-plus text-white text-lg"></i>
      </button>

      {showPostModal && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
          <div className="max-w-md w-full border-2 border-current bg-[#050505] p-8 shadow-[0_0_50px_currentColor]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold uppercase tracking-widest glow-text">broadcast_signal</h3>
              <button onClick={() => setShowPostModal(false)} className="text-xl font-bold hover:text-white transition-colors">X</button>
            </div>

            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest mb-2">signal_category</p>
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {['NEWS', 'GOSSIP', 'UPDATE'].map(c => (
                    <button
                      key={c}
                      onClick={() => setNewBuzzCat(c as FilterCategory)}
                      className={`terminal-btn px-4 h-8 text-[9px] font-bold uppercase tracking-widest ${newBuzzCat === c ? 'active' : 'opacity-40'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest mb-2">signal_data</p>
                <textarea
                  value={newBuzzText}
                  onChange={(e) => setNewBuzzText(e.target.value)}
                  className="w-full bg-black border border-current border-opacity-30 p-4 text-xs font-mono text-white focus:outline-none focus:border-opacity-100 min-h-[120px]"
                  placeholder="type your broadcast message here..."
                ></textarea>
              </div>

              <button
                onClick={handlePostBuzz}
                disabled={!newBuzzText.trim()}
                className="terminal-btn active w-full py-4 uppercase font-bold text-xs tracking-[0.3em] shadow-lg disabled:opacity-20"
              >
                transmit_signal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments Modal */}
      {showCommentsModal && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
          <div className="max-w-md w-full border-2 border-current bg-[#050505] p-8 shadow-[0_0_50px_currentColor] max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold uppercase tracking-widest glow-text">comments</h3>
              <button onClick={() => setShowCommentsModal(null)} className="text-xl font-bold hover:text-white transition-colors">X</button>
            </div>

            {/* Comments List */}
            <div className="space-y-4 mb-6 max-h-60 overflow-y-auto">
              {shoutouts.find(s => s.id === showCommentsModal)?.commentsList?.map(comment => (
                <div key={comment.id} className="border border-current border-opacity-10 p-3 bg-black/50">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 border border-current border-opacity-30 overflow-hidden">
                      <img src={comment.user.avatar} className="w-full h-full object-cover grayscale" alt="" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{comment.user.name}</p>
                      <p className="text-[8px] opacity-40">{comment.user.handle}</p>
                    </div>
                  </div>
                  <p className="text-xs text-white/70">{comment.text}</p>
                </div>
              )) || (
                  <p className="text-center opacity-40 text-sm">no comments yet</p>
                )}
            </div>

            {/* Add Comment */}
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest mb-2">add_comment</p>
                <textarea
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  className="w-full bg-black border border-current border-opacity-30 p-3 text-xs font-mono text-white focus:outline-none focus:border-opacity-100 min-h-[80px]"
                  placeholder="type your comment here..."
                ></textarea>
              </div>
              <button
                onClick={handlePostComment}
                disabled={!newCommentText.trim()}
                className="terminal-btn active w-full py-3 uppercase font-bold text-xs tracking-[0.3em] shadow-lg disabled:opacity-20"
              >
                post_comment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
          <div className="max-w-md w-full border-2 border-current bg-[#050505] p-8 shadow-[0_0_50px_currentColor]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold uppercase tracking-widest glow-text">share_signal</h3>
              <button onClick={() => setShowShareModal(null)} className="text-xl font-bold hover:text-white transition-colors">X</button>
            </div>

            <div className="space-y-4">
              <div className="p-4 border border-current border-opacity-20 bg-black">
                <p className="text-xs font-mono text-white/80 leading-relaxed italic">
                  {shoutouts.find(s => s.id === showShareModal)?.snippet}
                </p>
                <p className="text-[8px] opacity-40 mt-2">
                  — {shoutouts.find(s => s.id === showShareModal)?.user.handle}
                </p>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => handleShareAction('copy')}
                  className="w-full p-3 border border-current border-opacity-20 text-left hover:bg-white/5 transition-colors flex items-center gap-3"
                >
                  <i className="fa-solid fa-copy"></i>
                  <span className="text-sm font-bold">copy to clipboard</span>
                </button>
                <button
                  onClick={() => handleShareAction('mesh')}
                  className="w-full p-3 border border-current border-opacity-20 text-left hover:bg-white/5 transition-colors flex items-center gap-3"
                >
                  <i className="fa-solid fa-share-nodes"></i>
                  <span className="text-sm font-bold">share to mesh network</span>
                </button>
                <button
                  onClick={() => handleShareAction('external')}
                  className="w-full p-3 border border-current border-opacity-20 text-left hover:bg-white/5 transition-colors flex items-center gap-3"
                >
                  <i className="fa-solid fa-external-link-alt"></i>
                  <span className="text-sm font-bold">share externally</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuzzView;

