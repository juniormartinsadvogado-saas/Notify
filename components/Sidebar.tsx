
import React from 'react';
import { ViewState } from '../types';
import { LayoutDashboard, Monitor, Video, CreditCard, LogOut, Settings, ChevronLeft, ChevronRight, Inbox, MessageCircle } from 'lucide-react';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  onLogout: () => void;
  isOpen: boolean;
  onToggle: () => void;
  badgeCounts?: Record<string, number>;
}

const LogoYSidebar = () => (
  <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 40C31.0457 40 40 31.0457 40 20C40 8.9543 31.0457 0 20 0C8.9543 0 0 8.9543 0 20C0 31.0457 8.9543 40 20 40Z" fill="white"/>
    <path d="M12 12L20 22L28 12" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 22V30" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, onLogout, isOpen, onToggle, badgeCounts }) => {
  
  const menuItems = [
    { 
        id: ViewState.DASHBOARD, 
        label: 'Painel Geral', 
        icon: <LayoutDashboard size={20} /> 
    },
    {
        id: ViewState.MONITORING, 
        label: 'Notificações',
        icon: <Monitor size={20} />
    },
    {
        id: ViewState.RECEIVED_NOTIFICATIONS, 
        label: 'Recebidas',
        icon: <Inbox size={20} />,
        hasBadge: true
    },
    {
        id: ViewState.MEETINGS, 
        label: 'Conciliações',
        icon: <Video size={20} />
    },
    {
        id: ViewState.BILLING, 
        label: 'Pagamentos', 
        icon: <CreditCard size={20} />
    },
    { 
        id: ViewState.SETTINGS, 
        label: 'Configurações', 
        icon: <Settings size={20} />
    },
  ];

  return (
    <div 
      className={`
        fixed inset-y-0 left-0 z-[60] bg-[#0F172A] text-slate-300 h-screen flex flex-col shadow-2xl transition-all duration-300
        ${isOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0 md:w-20'}
      `}
      onClick={(e) => e.stopPropagation()} 
    >
      <button 
        onClick={onToggle}
        className="hidden md:flex absolute -right-3 top-9 bg-white text-slate-900 p-1 rounded-full shadow-lg border border-slate-100 hover:scale-110 transition-transform z-50"
      >
        {isOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      {/* Header Logo */}
      <div className={`p-8 flex items-center ${isOpen ? 'space-x-4' : 'justify-center'} shrink-0 h-28 transition-all duration-300`}>
        <div className="relative group cursor-pointer" onClick={() => onChangeView(ViewState.DASHBOARD)}>
           <div className="absolute inset-0 bg-blue-500 rounded-full blur opacity-40 group-hover:opacity-60 transition-opacity"></div>
           <div className="relative transform group-hover:scale-105 transition-transform duration-300">
             <LogoYSidebar />
           </div>
        </div>
        <span className={`text-2xl font-bold text-white tracking-tight transition-all duration-300 overflow-hidden whitespace-nowrap ${isOpen ? 'opacity-100 w-auto translate-x-0' : 'opacity-0 w-0 -translate-x-4 hidden'}`}>
          Notify
        </span>
      </div>

      <nav className="flex-1 px-4 space-y-2 overflow-y-auto overflow-x-hidden scrollbar-none py-4">
        {isOpen && (
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 mb-2 animate-fade-in">
                Menu Principal
            </p>
        )}
        
        {menuItems.map((item) => {
          const isActive = item.id === currentView;
          const count = item.hasBadge && badgeCounts ? badgeCounts[item.id] || 0 : 0;
          
          return (
            <button
                key={item.id}
                onClick={() => {
                    onChangeView(item.id);
                    if (window.innerWidth < 768) onToggle();
                }}
                title={!isOpen ? item.label : ''}
                className={`w-full flex items-center ${isOpen ? 'px-4 space-x-3' : 'justify-center px-0'} py-3.5 rounded-xl transition-all duration-300 font-medium relative group ${
                    isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
            >
                <div className="relative shrink-0">
                    <span className={`transition-colors duration-300 ${isActive ? 'text-white' : 'group-hover:text-blue-400'}`}>
                    {item.icon}
                    </span>
                    {!isOpen && count > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-[#0F172A]">
                            {count > 9 ? '9+' : count}
                        </span>
                    )}
                </div>

                <div className={`flex items-center justify-between flex-1 overflow-hidden transition-all duration-300 ${isOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'}`}>
                    <span className="tracking-wide text-sm whitespace-nowrap ml-1">
                        {item.label}
                    </span>
                    {count > 0 && (
                        <span className="bg-blue-500/20 text-blue-200 text-xs font-bold px-2 py-0.5 rounded-full ml-2">
                            {count}
                        </span>
                    )}
                </div>
            </button>
          );
        })}
      </nav>

      <div className="p-4 shrink-0 border-t border-slate-800/50 flex flex-col gap-2 bg-[#0F172A] z-10">
         <a 
            href="https://wa.me/558391559429" 
            target="_blank" 
            rel="noopener noreferrer"
            title={!isOpen ? "Suporte WhatsApp" : ""}
            className={`w-full flex items-center ${isOpen ? 'space-x-3 px-4 py-3' : 'justify-center p-2'} text-slate-400 hover:text-white hover:bg-emerald-500/10 rounded-xl group transition-all duration-200`}
         >
            <MessageCircle size={20} className="group-hover:text-emerald-400 transition-colors" />
            <span className={`whitespace-nowrap font-bold text-sm transition-all duration-300 group-hover:text-emerald-400 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}>Suporte</span>
         </a>

         <button 
            onClick={onLogout}
            title={!isOpen ? "Sair da conta" : ''}
            className={`w-full flex items-center ${isOpen ? 'space-x-3 px-4 py-3' : 'justify-center p-2'} text-slate-400 hover:text-white hover:bg-red-500/10 rounded-xl group transition-all duration-200`}
         >
            <LogOut size={20} className="group-hover:text-red-400 transition-colors" />
            <span className={`whitespace-nowrap font-bold text-sm transition-all duration-300 group-hover:text-red-400 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}>Sair</span>
         </button>
      </div>
    </div>
  );
};

export default Sidebar;
