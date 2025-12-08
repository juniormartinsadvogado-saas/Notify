import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import NotificationCreator from './NotificationCreator';
import ReceivedNotifications from './ReceivedNotifications';
import MeetingScheduler from './MeetingScheduler';
import Monitoring from './Monitoring';
import Billing from './Billing';
import Settings from './Settings';
import FileManager from './FileManager';
import Login from './Login';
import SplashScreen from './SplashScreen'; 
import { ViewState, NotificationItem, NotificationStatus, Meeting, Transaction } from '../types';
import { Bell, Search, Menu } from 'lucide-react';
import { ensureUserProfile } from '../services/userService';

const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({
    [ViewState.RECEIVED_NOTIFICATIONS]: 3,
    [ViewState.MONITORING]: 1,
    [ViewState.MEETINGS]: 2
  });
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]); 
  const [transactions] = useState<Transaction[]>([
    { id: 'TX-998', description: 'Geração de Notificação', amount: 49.90, date: '2023-10-05', status: 'Pago' },
    { id: 'TX-999', description: 'Plano Mensal', amount: 199.00, date: '2023-10-01', status: 'Pago' },
    { id: 'TX-1000', description: 'Agendamento Premium', amount: 29.90, date: '2023-09-28', status: 'Pendente' },
  ]);

  useEffect(() => {
    const handleResize = () => {
        if (window.innerWidth >= 768) {
            setIsSidebarOpen(true);
        } else {
            setIsSidebarOpen(false);
        }
    };
    window.addEventListener('resize', handleResize);
    
    // VERIFICAÇÃO DE SESSÃO LOCAL (MOCK)
    // Substitui completamente o auth.onAuthStateChanged do Firebase
    const checkSession = async () => {
        const savedUser = localStorage.getItem('mock_session_user');
        if (savedUser) {
            try {
                const parsedUser = JSON.parse(savedUser);
                setUser(parsedUser);
                await ensureUserProfile(parsedUser);
            } catch (e) {
                console.error("Erro ao recuperar sessão:", e);
                localStorage.removeItem('mock_session_user');
            }
        }
    };
    checkSession();

    return () => {
        window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleLogin = (mockUser: any) => {
      localStorage.setItem('mock_session_user', JSON.stringify(mockUser));
      setUser(mockUser);
      ensureUserProfile(mockUser); 
  };

  const handleLogout = () => {
    localStorage.removeItem('mock_session_user');
    setUser(null);
    setCurrentView(ViewState.DASHBOARD);
  };

  const handleSaveNotification = (notification: NotificationItem) => {
    setNotifications(prev => [notification, ...prev]);
    setCurrentView(ViewState.MONITORING);
    setBadgeCounts(prev => ({ ...prev, [ViewState.MONITORING]: (prev[ViewState.MONITORING] || 0) + 1 }));
  };

  useEffect(() => {
    if (badgeCounts[currentView] > 0) {
      const timer = setTimeout(() => {
        setBadgeCounts(prev => ({ ...prev, [currentView]: 0 }));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentView]);

  const renderContent = () => {
    switch (currentView) {
      case ViewState.DASHBOARD:
        return <Dashboard notifications={notifications} meetings={meetings} transactions={transactions} />;
      case ViewState.CREATE_NOTIFICATION:
        return <NotificationCreator onSave={handleSaveNotification} user={user} />;
      case ViewState.RECEIVED_NOTIFICATIONS:
        return <ReceivedNotifications />;
      case ViewState.MONITORING:
        // Passamos notifications como prop, mas o componente também busca do storage
        return <Monitoring notifications={notifications} />;
      case ViewState.MEETINGS:
        return <MeetingScheduler />;
      case ViewState.BILLING:
        return <Billing transactions={transactions} />;
      case ViewState.SETTINGS:
        return <Settings />;
      case ViewState.FILES:
        return <FileManager />;
      default:
        return <Dashboard notifications={notifications} meetings={meetings} transactions={transactions} />;
    }
  };

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex min-h-screen bg-zinc-100 overflow-x-hidden">
      <Sidebar 
        currentView={currentView} 
        onChangeView={setCurrentView}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        badgeCounts={badgeCounts}
      />
      
      <main className={`flex-1 transition-all duration-300 p-4 md:p-8 ${isSidebarOpen ? 'md:ml-72' : 'md:ml-20'} w-full`}>
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-10 pt-2 gap-4">
          <div className="flex items-center w-full md:w-auto">
            <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                className="md:hidden mr-3 p-2 text-slate-600 hover:bg-slate-200 rounded-lg"
            >
                <Menu size={24} />
            </button>

            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 capitalize tracking-tight truncate max-w-[200px] md:max-w-none">
                {currentView === ViewState.CREATE_NOTIFICATION ? 'Nova Notificação' : currentView === ViewState.SETTINGS ? 'Configurações' : currentView === ViewState.RECEIVED_NOTIFICATIONS ? 'Caixa de Entrada' : currentView === ViewState.FILES ? 'Meus Arquivos' : currentView.replace('_', ' ')}
              </h1>
              <p className="text-xs md:text-sm text-slate-500 mt-1 font-light truncate">
                Painel do usuário, <span className="font-medium text-slate-700">{user.displayName || 'Usuário'}</span>.
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 md:space-x-6 w-full md:w-auto justify-end">
             <div className="hidden md:flex items-center bg-white px-4 py-2.5 rounded-full border border-slate-200 shadow-sm focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                <Search size={18} className="text-slate-400" />
                <input type="text" placeholder="Buscar..." className="bg-transparent border-none outline-none text-sm ml-2 w-32 md:w-48 text-slate-700 placeholder:text-slate-400" />
             </div>

             <button className="relative p-2.5 bg-white text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition border border-slate-200 shadow-sm group">
               <Bell size={20} className="group-hover:animate-pulse" />
               <span className="absolute top-0 right-0 h-3 w-3 bg-red-500 rounded-full border-2 border-white"></span>
             </button>
             
             {user.photoURL && (
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-slate-200 cursor-pointer hover:border-blue-500 transition shrink-0" onClick={() => setCurrentView(ViewState.SETTINGS)}>
                    <img src={user.photoURL} alt="Perfil" className="w-full h-full object-cover" />
                </div>
             )}
          </div>
        </header>

        {renderContent()}
      </main>

      {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-10 md:hidden backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          ></div>
      )}
    </div>
  );
};

export default App;