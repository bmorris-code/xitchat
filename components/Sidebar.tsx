
import React from 'react';
import { View } from '../types';


interface SidebarProps {
  currentView: View;
  setView: (view: View) => void;
  userAvatar?: string;
  totalUnread?: number;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, userAvatar, totalUnread = 0 }) => {
  // Reduced to 5 core Hubs for a modern, clean look
  const navItems = [
    { id: 'chats', icon: 'fa-message', label: 'mesh', badge: true },
    { id: 'map', icon: 'fa-location-crosshairs', label: 'radar' },
    { id: 'rooms', icon: 'fa-user-group', label: 'rooms' },
    { id: 'apps', icon: 'fa-grip', label: 'apps' },
    { id: 'profile', icon: 'fa-user-astronaut', label: 'id' },
  ];

  const isActive = (id: string) => {
    // Some views are sub-views of 'apps' hub
    if (id === 'apps' && ['tradepost', 'joebanker', 'buzz', 'gallery', 'games'].includes(currentView)) return true;
    return currentView === id;
  };

  return (
    <div className="
      w-full md:w-20 
      h-[72px] md:h-full 
      bg-black border-t md:border-t-0 md:border-r border-[#004400] 
      flex flex-row md:flex-col items-center 
      order-last md:order-first 
      pb-safe pr-safe pl-safe md:pb-0
      z-50
      shadow-[0_-1px_20px_rgba(0,0,0,0.8)] md:shadow-none
      min-h-[72px]
      backdrop-blur-md
      sticky bottom-0 md:sticky md:top-0
      mobile-navbar-fix
    "
      style={{
        WebkitBackdropFilter: 'blur(12px)',
      }}>

      {/* Desktop Logo */}
      <div className="hidden md:block py-8 text-2xl glow-text animate-pulse">
        <i className="fa-solid fa-ghost"></i>
      </div>

      {/* Navigation Hubs */}
      <div className="
        flex-1 flex flex-row md:flex-col 
        w-full h-full md:h-auto
        items-center md:items-stretch
        justify-around md:justify-start
        md:gap-10
        px-2 md:px-0
      ">
        {navItems.map((item) => {
          const active = isActive(item.id);
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id as View)}
              className={`
                flex flex-col items-center justify-center 
                gap-1.5 transition-all duration-300
                flex-1 md:flex-none
                h-full md:h-auto
                relative
                group
                ${active ? 'text-[#00ff41]' : 'text-[#004400]'}
              `}
            >
              {/* Active Pill (Mobile) */}
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[3px] bg-[#00ff41] shadow-[0_0_12px_#00ff41] rounded-b-full md:hidden"></div>
              )}

              <div className={`
                p-1.5 rounded-xl transition-all relative
                ${active ? 'bg-white/[0.05]' : 'group-hover:bg-white/[0.02]'}
              `}>
                <i className={`fa-solid ${item.icon} text-xl md:text-lg ${active ? 'glow-text' : ''}`}></i>
                {item.badge && totalUnread > 0 && (
                  <div className="absolute -top-1 -right-2 text-[10px] font-black text-[#00ff41] animate-pulse drop-shadow-[0_0_5px_#00ff41]">
                    [{totalUnread}]
                  </div>
                )}
              </div>

              <span className={`
                text-[9px] md:text-[8px] font-bold uppercase tracking-widest whitespace-nowrap
                transition-opacity
                ${active ? 'opacity-100' : 'opacity-30 group-hover:opacity-60'}
              `}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>



      {/* Desktop Version Settings Button */}
      <div className="hidden md:flex mt-auto py-8">
        <button
          onClick={() => setView('profile')}
          className="w-10 h-10 rounded-full border border-[#004400] flex items-center justify-center overflow-hidden hover:border-[#00ff41] transition-colors"
        >
          <img
            src={userAvatar || "/icon-192.png"}
            className="grayscale opacity-50 hover:opacity-100 transition-opacity w-full h-full object-cover"
            alt="Me"
          />
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
