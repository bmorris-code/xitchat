
import React from 'react';
import { View } from '../types';


interface SidebarProps {
  currentView: View;
  setView: (view: View) => void;
  userAvatar?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, userAvatar }) => {
  // Reduced to 5 core Hubs for a modern, clean look
  const navItems = [
    { id: 'chats', icon: 'fa-message', label: 'mesh' },
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
  fixed bottom-0 left-0 md:static
  w-full md:w-20
  h-[72px] md:h-full
  bg-black
  border-t md:border-t-0 md:border-r border-[#004400]
  flex flex-row md:flex-col items-center
  z-50
  px-2
  pb-[env(safe-area-inset-bottom)]
  shadow-[0_-1px_20px_rgba(0,0,0,0.8)]
  md:shadow-none
">

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
                p-1.5 rounded-xl transition-all
                ${active ? 'bg-white/[0.05]' : 'group-hover:bg-white/[0.02]'}
              `}>
                <i className={`fa-solid ${item.icon} text-xl md:text-lg ${active ? 'glow-text' : ''}`}></i>
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
            src={userAvatar || "https://picsum.photos/seed/me/60"}
            className="grayscale opacity-50 hover:opacity-100 transition-opacity w-full h-full object-cover"
            alt="Me"
          />
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
