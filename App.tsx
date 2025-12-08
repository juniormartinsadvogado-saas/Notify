import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import NotificationCreator from './components/NotificationCreator';
import ReceivedNotifications from './components/ReceivedNotifications';
import MeetingScheduler from './components/MeetingScheduler';
import Monitoring from './components/Monitoring';
import Billing from './components/Billing';
import Settings from './components/Settings';
import FileManager from './components/FileManager';
import Login from './components/Login';
import SplashScreen from './components/SplashScreen'; 
import { ViewState, NotificationItem, NotificationStatus, Meeting, Transaction } from './types';
import { Bell, Search, Menu, X, CheckCircle } from 'lucide-react';
import { ensureUserProfile, getUserProfile } from './services/userService';
import { getNotificationsByRecipientCpf } from './services/notificationService';

const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Theme & Settings State
  const [darkMode, setDarkMode] = useState(false);
  const [themeColor, setThemeColor] = useState('blue');
  
  // System Notifications
  const [systemNotifications, setSystemNotifications] = useState<NotificationItem[]>([]);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);

  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({
    [ViewState.RECEIVED_NOTIFICATIONS]: 0,
    [ViewState.MONITORING]: 0,
    [ViewState.MEETINGS]: 0
  });
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]); 
  const [transactions, setTransactions] = useState<Transaction[]>([
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
    
    const checkSession = async () => {
        const savedUser = localStorage.getItem('mock_session_user');
        if (savedUser) {
            try {
                const parsedUser = JSON.parse(savedUser);
                setUser(parsedUser);
                await ensureUserProfile(parsedUser);
                checkSystemNotifications(parsedUser.uid);
            } catch (e) {
                console.error("Erro ao recuperar sessão:", e);
                localStorage.removeItem('mock_session_user');
            }
        }
    };
    checkSession();

    // Carregar preferências salvas
    const savedTheme = localStorage.getItem('app_theme_pref');
    if (savedTheme) {
        const { dark, color } = JSON.parse(savedTheme);
        setDarkMode(dark);
        setThemeColor(color);
    }

    return () => {
        window.removeEventListener('resize', handleResize);
    };
  }, []);

  const checkSystemNotifications = async (uid: string) => {
      try {
          const profile = await getUserProfile(uid);
          if (profile && profile.cpf) {
              const cleanCpf = profile.cpf.replace(/\D/g, '');
              const received = await getNotificationsByRecipientCpf(cleanCpf);
              // Filtra notificações não lidas ou recentes (Simulação: todas recebidas)
              setSystemNotifications(received);
              if (received.length > 0) {
                  setBadgeCounts(prev => ({ ...prev, [ViewState.RECEIVED_NOTIFICATIONS]: received.length }));
              }
          }
      } catch (e) {
          console.error("Erro ao buscar notificações do sistema", e);
      }
  };

  // --- AUTOMATION: MEETING STATUS POR TEMPO ---
  useEffect(() => {
    const checkMeetingStatus = () => {
        const now = new Date();
        setMeetings(prevMeetings => prevMeetings.map(meeting => {
            if (meeting.status === 'scheduled') {
                try {
                    const meetingDateTime = new Date(`${meeting.date}T${meeting.time}`);
                    if (!isNaN(meetingDateTime.getTime()) && meetingDateTime < now) {
                        return { ...meeting, status: 'completed' };
                    }
                } catch (e) {
                    console.error("Erro ao processar data da reunião", e);
                }
            }
            return meeting;
        }));
    };

    checkMeetingStatus();
    const interval = setInterval(checkMeetingStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleRefund = (transactionId: string) => {
      setTransactions(prev => prev.map(t => 
          t.id === transactionId ? { ...t, status: 'Reembolsado' } : t
      ));

      setNotifications(prev => {
          const newNotifs = [...prev];
          const targetIndex = newNotifs.findIndex(n => n.status === NotificationStatus.SENT);
          if (targetIndex >= 0) {
              newNotifs[targetIndex] = { ...newNotifs[targetIndex], status: NotificationStatus.PENDING_PAYMENT };
          }
          return newNotifs;
      });

      setMeetings(prev => {
          const newMeetings = [...prev];
          const targetIndex = newMeetings.findIndex(m => m.status === 'scheduled');
          if (targetIndex >= 0) {
              newMeetings[targetIndex] = { ...newMeetings[targetIndex], status: 'canceled' };
          }
          return newMeetings;
      });

      alert("Reembolso processado com sucesso.\n- Pagamento estornado\n- Notificação movida para Pendentes\n- Conciliação Cancelada");
  };

  const handleLogin = (mockUser: any) => {
      localStorage.setItem('mock_session_user', JSON.stringify(mockUser));
      setUser(mockUser);
      ensureUserProfile(mockUser); 
      checkSystemNotifications(mockUser.uid);
  };

  const handleLogout = () => {
    localStorage.removeItem('mock_session_user');
    setUser(null);
    setCurrentView(ViewState.DASHBOARD);
  };

  const handleSaveNotification = (notification: NotificationItem, meeting?: Meeting, transaction?: Transaction) => {
    setNotifications(prev => [notification, ...prev]);
    if (meeting) setMeetings(prev => [meeting, ...prev]);
    if (transaction) setTransactions(prev => [transaction, ...prev]);

    setCurrentView(ViewState.DASHBOARD);
    setBadgeCounts(prev => ({ ...prev, [ViewState.DASHBOARD]: (prev[ViewState.DASHBOARD] || 0) + 1 }));
  };

  const handleThemeChange = (isDark: boolean, color: string) => {
      setDarkMode(isDark);
      setThemeColor(color);
      localStorage.setItem('app_theme_pref', JSON.stringify({ dark: isDark, color }));
  };

  useEffect(() => {
    if (badgeCounts[currentView] > 0 && currentView !== ViewState.RECEIVED_NOTIFICATIONS) {
      const timer = setTimeout(() => {
        setBadgeCounts(prev => ({ ...prev, [currentView]: 0 }));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentView]);

  const renderContent = () => {
    switch (currentView) {
      case ViewState.DASHBOARD:
        return <Dashboard notifications={notifications} meetings={meetings} transactions={transactions} onNavigate={setCurrentView} />;
      case ViewState.CREATE_NOTIFICATION:
        return <NotificationCreator onSave={handleSaveNotification} user={user} />;
      case ViewState.RECEIVED_NOTIFICATIONS:
        return <ReceivedNotifications />;
      case ViewState.MONITORING:
        return <Monitoring notifications={notifications} searchQuery={searchQuery} />;
      
      case ViewState.NOTIFICATIONS_CREATED:
        return <Monitoring notifications={notifications} filterStatus={[NotificationStatus.DRAFT]} searchQuery={searchQuery} />;
      case ViewState.NOTIFICATIONS_DELIVERED:
        return <Monitoring notifications={notifications} filterStatus={[NotificationStatus.SENT, NotificationStatus.DELIVERED, NotificationStatus.READ]} searchQuery={searchQuery} />;
      case ViewState.NOTIFICATIONS_PENDING:
        return <Monitoring notifications={notifications} filterStatus={[NotificationStatus.PENDING_PAYMENT]} searchQuery={searchQuery} />;
      
      case ViewState.CONCILIATIONS_SCHEDULED:
          return <MeetingScheduler filterStatus={['scheduled']} meetingsProp={meetings} />;
      case ViewState.CONCILIATIONS_DONE:
          return <MeetingScheduler filterStatus={['completed']} meetingsProp={meetings} />;
      case ViewState.CONCILIATIONS_CANCELED:
          return <MeetingScheduler filterStatus={['canceled']} meetingsProp={meetings} />;
      
      case ViewState.PAYMENTS_CONFIRMED:
          return <Billing transactions={transactions} filterStatus={['Pago']} onRefund={handleRefund} />;
      case ViewState.PAYMENTS_PENDING:
          return <Billing transactions={transactions} filterStatus={['Pendente']} onRefund={handleRefund} />;
      case ViewState.PAYMENTS_REFUNDED:
          return <Billing transactions={transactions} filterStatus={['Reembolsado']} onRefund={handleRefund} />;

      case ViewState.MEETINGS:
        return <MeetingScheduler meetingsProp={meetings} />;
      case ViewState.BILLING:
        return <Billing transactions={transactions} onRefund={handleRefund} />;
      case ViewState.FILES:
        return <FileManager />;
      case ViewState.SETTINGS:
      case ViewState.SETTINGS_ACCOUNT:
      case ViewState.SETTINGS_PLATFORM:
        return <Settings subView={currentView === ViewState.SETTINGS_PLATFORM ? 'platform' : 'account'} onThemeChange={handleThemeChange} initialTheme={{darkMode, themeColor}} />;
      default:
        return <Dashboard notifications={notifications} meetings={meetings} transactions={transactions} onNavigate={setCurrentView} />;
    }
  };

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // Dynamic Styles for Theme
  const getThemeStyles = () => {
      const colors: any = {
          blue: { bg: 'bg-blue-600', text: 'text-blue-600', border: 'border-blue-200', ring: 'focus-within:ring-blue-100' },
          purple: { bg: 'bg-purple-600', text: 'text-purple-600', border: 'border-purple-200', ring: 'focus-within:ring-purple-100' },
          green: { bg: 'bg-green-600', text: 'text-green-600', border: 'border-green-200', ring: 'focus-within:ring-green-100' },
          orange: { bg: 'bg-orange-600', text: 'text-orange-600', border: 'border-orange-200', ring: 'focus-within:ring-orange-100' }
      };
      return colors[themeColor] || colors.blue;
  };
  const theme = getThemeStyles();

  return (
    <div className={`flex min-h-screen ${darkMode ? 'bg-slate-900 text-slate-100' : 'bg-zinc-100 text-slate-900'} overflow-x-hidden transition-colors duration-500`}>
      <Sidebar 
        currentView={currentView} 
        onChangeView={setCurrentView}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        badgeCounts={badgeCounts}
      />
      
      <main className={`flex-1 transition-all duration-300 p-4 md:p-8 ${isSidebarOpen ? 'md:ml-72' : 'md:ml-20'} w-full`}>
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-10 pt-2 gap-4 relative">
          <div className="flex items-center w-full md:w-auto">
            <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                className={`md:hidden mr-3 p-2 rounded-lg ${darkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-200'}`}
            >
                <Menu size={24} />
            </button>

            <div>
              <h1 className={`text-2xl md:text-3xl font-bold capitalize tracking-tight truncate max-w-[200px] md:max-w-none ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                {currentView === ViewState.CREATE_NOTIFICATION ? 'Nova Notificação' : currentView.includes('settings') ? 'Configurações' : currentView === ViewState.RECEIVED_NOTIFICATIONS ? 'Caixa de Entrada' : currentView === ViewState.FILES ? 'Meus Arquivos' : currentView.replace(/_/g, ' ').replace('notifications', 'Notificações').replace('conciliations', 'Conciliações').replace('payments', 'Pagamentos')}
              </h1>
              <p className={`text-xs md:text-sm mt-1 font-light truncate ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Painel do usuário, <span className={`font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{user.displayName || 'Usuário'}</span>.
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 md:space-x-6 w-full md:w-auto justify-end">
             <div className={`hidden md:flex items-center px-4 py-2.5 rounded-full border shadow-sm transition-all ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} ${theme.ring}`}>
                <Search size={18} className={darkMode ? 'text-slate-500' : 'text-slate-400'} />
                <input 
                    type="text" 
                    placeholder="Buscar notificações..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`bg-transparent border-none outline-none text-sm ml-2 w-32 md:w-48 placeholder:text-slate-400 ${darkMode ? 'text-white' : 'text-slate-700'}`} 
                />
             </div>

             <div className="relative">
                 <button 
                    onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                    className={`relative p-2.5 rounded-full transition border shadow-sm group ${darkMode ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-600 hover:text-blue-600 hover:bg-blue-50 border-slate-200'}`}
                 >
                   <Bell size={20} className="group-hover:animate-pulse" />
                   {systemNotifications.length > 0 && (
                       <span className="absolute top-0 right-0 h-3 w-3 bg-red-500 rounded-full border-2 border-white"></span>
                   )}
                 </button>

                 {showNotificationsDropdown && (
                     <div className={`absolute right-0 mt-2 w-80 rounded-xl shadow-2xl border overflow-hidden z-50 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                         <div className={`p-3 border-b flex justify-between items-center ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                             <h4 className={`font-bold text-sm ${darkMode ? 'text-white' : 'text-slate-800'}`}>Notificações do Sistema</h4>
                             <button onClick={() => setShowNotificationsDropdown(false)}><X size={16} className="text-slate-400" /></button>
                         </div>
                         <div className="max-h-64 overflow-y-auto">
                             {systemNotifications.length === 0 ? (
                                 <div className="p-6 text-center text-slate-500 text-sm">Nenhuma nova notificação.</div>
                             ) : (
                                 systemNotifications.map(notif => (
                                     <div key={notif.id} onClick={() => { setCurrentView(ViewState.RECEIVED_NOTIFICATIONS); setShowNotificationsDropdown(false); }} className={`p-3 border-b cursor-pointer transition ${darkMode ? 'border-slate-700 hover:bg-slate-700' : 'border-slate-50 hover:bg-slate-50'}`}>
                                         <div className="flex items-start gap-3">
                                             <div className="mt-1 text-blue-500"><CheckCircle size={16} /></div>
                                             <div>
                                                 <p className={`text-sm font-bold ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>Nova Notificação Recebida</p>
                                                 <p className="text-xs text-slate-500">Remetente: {notif.senderName}</p>
                                                 <p className="text-[10px] text-slate-400 mt-1">{new Date(notif.createdAt).toLocaleDateString()}</p>
                                             </div>
                                         </div>
                                     </div>
                                 ))
                             )}
                         </div>
                     </div>
                 )}
             </div>
             
             {user.photoURL && (
                <div className={`w-10 h-10 rounded-full overflow-hidden border-2 cursor-pointer transition shrink-0 ${darkMode ? 'border-slate-600 hover:border-slate-400' : 'border-slate-200 hover:border-blue-500'}`} onClick={() => setCurrentView(ViewState.SETTINGS)}>
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