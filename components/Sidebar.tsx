import React, { useState } from 'react';
import { ViewState } from '../types';
import { LayoutDashboard, FilePlus, Monitor, Video, CreditCard, LogOut, Settings, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CheckCircle, Clock, AlertCircle, Calendar, XCircle, FileText, Send, User, Palette, Crown, Zap, History } from 'lucide-react';

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

interface SubMenuItem {
  id: ViewState;
  label: string;
  icon?: React.ReactNode;
}

interface MenuItem {
  id?: string; // ID for grouping
  label: string;
  icon: React.ReactNode;
  viewState?: ViewState; // Direct link if no children
  children?: SubMenuItem[];
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, onLogout, isOpen, onToggle, badgeCounts = {} }) => {
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    'notifications': true,
    'conciliations': false,
    'payments': false,
    'subscription': false,
    'settings': false
  });

  const toggleMenu = (menuId: string) => {
    if (!isOpen) onToggle(); // Open sidebar if collapsed
    setExpandedMenus(prev => ({ ...prev, [menuId]: !prev[menuId] }));
  };

  const menuStructure: MenuItem[] = [
    { 
        label: 'Painel de Controle', 
        icon: <LayoutDashboard size={20} />, 
        viewState: ViewState.DASHBOARD 
    },
    {
        id: 'notifications',
        label: 'Notificações',
        icon: <Monitor size={20} />,
        children: [
            { id: ViewState.NOTIFICATIONS_CREATED, label: 'Criadas', icon: <FileText size={14} /> },
            { id: ViewState.NOTIFICATIONS_DELIVERED, label: 'Entregues', icon: <Send size={14} /> },
            { id: ViewState.NOTIFICATIONS_PENDING, label: 'Pendentes', icon: <Clock size={14} /> }
        ]
    },
    {
        id: 'conciliations',
        label: 'Conciliações',
        icon: <Video size={20} />,
        children: [
            { id: ViewState.CONCILIATIONS_SCHEDULED, label: 'Agendadas', icon: <Calendar size={14} /> },
            { id: ViewState.CONCILIATIONS_DONE, label: 'Realizadas', icon: <CheckCircle size={14} /> },
            { id: ViewState.CONCILIATIONS_CANCELED, label: 'Canceladas', icon: <XCircle size={14} /> }
        ]
    },
    {
        id: 'payments',
        label: 'Pagamentos',
        icon: <CreditCard size={20} />,
        children: [
            { id: ViewState.PAYMENTS_CONFIRMED, label: 'Confirmados', icon: <CheckCircle size={14} /> },
            { id: ViewState.PAYMENTS_PENDING, label: 'Pendentes', icon: <Clock size={14} /> },
            { id: ViewState.PAYMENTS_REFUNDED, label: 'Reembolsados', icon: <AlertCircle size={14} /> }
        ]
    },
    {
        id: 'subscription',
        label: 'Minha Assinatura',
        icon: <Crown size={20} />,
        children: [
            { id: ViewState.SUBSCRIPTION_PLAN, label: 'Plano e Créditos', icon: <Zap size={14} /> },
            { id: ViewState.SUBSCRIPTION_HISTORY, label: 'Histórico Mensal', icon: <History size={14} /> }
        ]
    },
    { 
        id: 'settings',
        label: 'Configurações', 
        icon: <Settings size={20} />, 
        children: [
            { id: ViewState.SETTINGS_ACCOUNT, label: 'Conta', icon: <User size={14} /> },
            { id: ViewState.SETTINGS_PLATFORM, label: 'Painel', icon: <Palette size={14} /> }
        ]
    },
  ];

  return (
    <div 
      className={`
        fixed inset-y-0 left-0 z-50 bg-[#0F172A] text-slate-300 h-screen flex flex-col shadow-2xl transition-all duration-300
        ${isOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0 md:w-20'}
      `}
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

      {/* Featured Buttons - Simplified Version (Painel Removido) */}
      <div className={`px-4 mb-6 space-y-3 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-100 px-3'}`}>
          
          {/* NOVA NOTIFICAÇÃO */}
          <button
            onClick={() => {
                onChangeView(ViewState.CREATE_NOTIFICATION);
                if (window.innerWidth < 768) onToggle();
            }}
            className={`
                w-full flex items-center rounded-xl transition-all duration-200 border border-blue-600/50 shadow-lg shadow-blue-900/10
                ${isOpen ? 'justify-start px-4 py-3 bg-blue-600 hover:bg-blue-500' : 'justify-center p-3 bg-blue-600 hover:bg-blue-500'}
            `}
            title={!isOpen ? "Nova Notificação" : ""}
          >
              <FilePlus size={20} className="text-white shrink-0" />
              {isOpen && (
                  <div className="ml-3 text-left overflow-hidden">
                      <span className="block text-white font-bold text-sm truncate">Nova Notificação</span>
                      <span className="block text-blue-100 text-[10px] uppercase font-medium tracking-wide">Criar Agora</span>
                  </div>
              )}
          </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto overflow-x-hidden scrollbar-none py-4">
        {isOpen && (
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 mb-2 animate-fade-in">
                Menu Principal
            </p>
        )}
        
        {menuStructure.map((item, index) => {
          const isGroup = !!item.children;
          const isExpanded = item.id ? expandedMenus[item.id] : false;
          const isActive = item.viewState === currentView || (item.children && item.children.some(child => child.id === currentView));
          
          return (
            <div key={index} className="space-y-1">
                <button
                onClick={() => {
                    if (isGroup && item.id) {
                        toggleMenu(item.id);
                    } else if (item.viewState) {
                        onChangeView(item.viewState);
                        if (window.innerWidth < 768) onToggle();
                    }
                }}
                title={!isOpen ? item.label : ''}
                className={`w-full flex items-center ${isOpen ? 'px-4 space-x-3' : 'justify-center px-0'} py-3 rounded-xl transition-all duration-300 font-medium relative group ${
                    isActive && !isGroup
                    ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
                >
                    <div className="relative shrink-0">
                        <span className={`transition-colors duration-300 ${isActive && !isGroup ? 'text-blue-400' : 'group-hover:text-blue-400'}`}>
                        {item.icon}
                        </span>
                    </div>

                    <span className={`tracking-wide text-sm whitespace-nowrap flex-1 text-left transition-all duration-300 ${isOpen ? 'opacity-100 ml-1' : 'opacity-0 w-0 hidden'}`}>
                        {item.label}
                    </span>

                    {isOpen && isGroup && (
                        <div className="text-slate-500">
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                    )}
                </button>

                {/* Submenu */}
                {isGroup && isOpen && isExpanded && item.children && (
                    <div className="ml-4 pl-4 border-l border-slate-700/50 space-y-1 my-1 animate-slide-in-down">
                        {item.children.map(child => {
                            const isChildActive = child.id === currentView;
                            return (
                                <button
                                    key={child.id}
                                    onClick={() => {
                                        onChangeView(child.id);
                                        if (window.innerWidth < 768) onToggle();
                                    }}
                                    className={`w-full flex items-center space-x-2 py-2 px-3 rounded-lg text-sm transition-all ${
                                        isChildActive 
                                        ? 'bg-white/10 text-white font-medium' 
                                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                    }`}
                                >
                                    {child.icon}
                                    <span>{child.label}</span>
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
          );
        })}
      </nav>

      {/* Footer User/Logout */}
      <div className="p-4 shrink-0 border-t border-slate-800/50">
         <div className={`rounded-xl transition-colors ${isOpen ? '' : 'flex justify-center p-2'}`}>
            <button 
            onClick={onLogout}
            title={!isOpen ? "Sair da conta" : ''}
            className={`w-full flex items-center ${isOpen ? 'space-x-3 px-4 py-3' : 'justify-center p-2'} text-slate-400 hover:text-white hover:bg-red-500/10 rounded-xl group transition-all duration-200`}
            >
            <LogOut size={20} className="group-hover:text-red-400 transition-colors" />
            <span className={`whitespace-nowrap font-bold text-sm transition-all duration-300 group-hover:text-red-400 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}>Sair da Conta</span>
            </button>
         </div>
      </div>
    </div>
  );
};

export default Sidebar;