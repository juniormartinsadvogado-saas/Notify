
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
import SubscriptionManager from './components/SubscriptionManager'; 
import SplashScreen from './components/SplashScreen'; 
import { ViewState, NotificationItem, NotificationStatus, Meeting, Transaction } from './types';
import { Bell, Search, Menu, X, CheckCircle, FileText, ArrowLeft, LogOut, Loader2, Settings as SettingsIcon, AlertCircle } from 'lucide-react';
import { ensureUserProfile, getUserProfile } from './services/userService';
import { getNotificationsByRecipientCpf, confirmPayment, getNotificationsBySender } from './services/notificationService';
import { saveTransaction, getUserTransactions, updateSubscriptionStatus } from './services/paymentService';
import { dispatchCommunications } from './services/communicationService';
import { auth } from './services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [themeColor, setThemeColor] = useState('blue');
  
  // System Notifications (Sino)
  const [systemNotifications, setSystemNotifications] = useState<any[]>([]);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);

  // Badge Counts (Interno, não usado na sidebar mas útil para lógica)
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [receivedNotificationsCount, setReceivedNotificationsCount] = useState(0); // Novo estado para dashboard
  const [meetings, setMeetings] = useState<Meeting[]>([]); 
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  // Subscription
  const [subscriptionData, setSubscriptionData] = useState({
      active: false,
      planName: 'Plano Gratuito',
      creditsTotal: 0,
      creditsUsed: 0,
      nextBillingDate: '',
      invoices: [] as Transaction[]
  });

  useEffect(() => {
    const handleResize = () => {
        if (window.innerWidth >= 768) {
            setIsSidebarOpen(true);
        } else {
            setIsSidebarOpen(false);
        }
    };
    window.addEventListener('resize', handleResize);
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser) {
            if (currentUser.emailVerified) {
                setUser(currentUser);
                const profile = await ensureUserProfile(currentUser);
                
                // 1. CARREGAR DADOS
                const realTransactions = await getUserTransactions(currentUser.uid);
                setTransactions(realTransactions);
                const sentNotifications = await getNotificationsBySender(currentUser.uid);
                setNotifications(sentNotifications);

                // Carregar assinatura
                if (profile) {
                    setSubscriptionData(prev => ({
                        ...prev,
                        active: profile.subscriptionActive || false,
                        planName: profile.subscriptionPlan || 'Plano Gratuito',
                        creditsTotal: profile.creditsTotal || 0,
                        creditsUsed: profile.creditsUsed || 0,
                        nextBillingDate: profile.nextBillingDate || '',
                        invoices: realTransactions.filter(t => t.description.includes('Assinatura'))
                    }));
                }

                // 2. EXECUTAR MECANISMO DE RECUPERAÇÃO E POPULAR SINO
                await runRecoveryAndAlerts(currentUser.uid, realTransactions, sentNotifications);

            } else {
                setUser(null);
            }
        } else {
            setUser(null);
            localStorage.removeItem('mock_session_user');
        }
        setLoadingAuth(false);
    });

    const savedTheme = localStorage.getItem('app_theme_pref');
    if (savedTheme) {
        const { dark, color } = JSON.parse(savedTheme);
        setDarkMode(dark);
        setThemeColor(color);
    }

    return () => {
        window.removeEventListener('resize', handleResize);
        unsubscribe();
    };
  }, []);

  const runRecoveryAndAlerts = async (uid: string, txs: Transaction[], notifs: NotificationItem[]) => {
      const alerts: any[] = [];
      let recoveredCount = 0;

      // Verifica Recebidas
      try {
          const profile = await getUserProfile(uid);
          if (profile && profile.cpf) {
              const cleanCpf = profile.cpf.replace(/\D/g, '');
              const received = await getNotificationsByRecipientCpf(cleanCpf);
              setReceivedNotificationsCount(received.length); // Atualiza contador do Dashboard
              
              if (received.length > 0) {
                  received.forEach(r => alerts.push({
                      id: `recv-${r.id}`,
                      type: 'received', // Tipo para redirecionamento
                      title: 'Nova Notificação Recebida',
                      desc: `Remetente: ${r.notificante_dados_expostos.nome}`,
                      date: r.createdAt
                  }));
              }
          }
      } catch (e) { console.error(e); }

      // Verifica Pagamentos / Envios
      const pendingNotifs = notifs.filter(n => n.status === NotificationStatus.PENDING_PAYMENT);
      
      for (const n of pendingNotifs) {
          const matchTx = txs.find(t => 
              t.status === 'Pago' && 
              Math.abs(t.amount - (n.paymentAmount || 0)) < 0.1 && 
              new Date(t.date).getTime() >= new Date(n.createdAt).getTime() - 60000 
          );

          if (matchTx) {
              try {
                  await confirmPayment(n.id);
                  await dispatchCommunications(n);
                  recoveredCount++;
                  n.status = NotificationStatus.SENT; 
                  
                  alerts.push({
                      id: `rec-${n.id}`,
                      type: 'system', // Tipo genérico -> Vai para Notificações
                      title: 'Envio Recuperado',
                      desc: `A notificação ${n.id} foi processada com sucesso.`,
                      date: new Date().toISOString()
                  });
              } catch (err) {
                  console.error("Falha na recuperação:", err);
              }
          }
      }

      // Adiciona logs de transações recentes ao sino
      txs.slice(0, 5).forEach(t => {
          alerts.push({
              id: t.id,
              type: 'payment', // Tipo -> Vai para Pagamentos
              title: t.status === 'Pago' ? 'Pagamento Confirmado' : 'Pagamento Pendente',
              desc: `${t.description} - R$ ${t.amount}`,
              date: t.date
          });
      });

      alerts.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setSystemNotifications(alerts);
      
      if (recoveredCount > 0) {
          alert(`${recoveredCount} notificações pagas anteriormente foram recuperadas e enviadas com sucesso!`);
      }
  };

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
      alert("Reembolso processado com sucesso (Simulação Local).");
  };

  const handleLogin = (firebaseUser: any) => {
      setUser(firebaseUser);
  };

  const handleLogout = async () => {
    setIsSidebarOpen(false); 
    setIsLoggingOut(true);
    setTimeout(async () => {
        await signOut(auth);
        localStorage.removeItem('mock_session_user');
        setUser(null);
        setCurrentView(ViewState.DASHBOARD);
        setIsLoggingOut(false);
    }, 3500); 
  };

  const handleSaveNotification = async (notification: NotificationItem, meeting?: Meeting, transaction?: Transaction) => {
    setNotifications(prev => {
        const exists = prev.some(n => n.id === notification.id);
        if (exists) return prev.map(n => n.id === notification.id ? notification : n);
        return [notification, ...prev];
    });

    if (meeting) setMeetings(prev => [meeting, ...prev]);
    
    if (user && transaction) {
        await saveTransaction(user.uid, transaction);
        setTransactions(prev => [transaction, ...prev]);
        
        // Ativação de plano se for assinatura
        if (transaction.description.includes('Assinatura')) {
            handleToggleSubscription();
        }
        
        setSystemNotifications(prev => [{
            id: `pay-${transaction.id}`,
            type: 'payment',
            title: 'Pagamento Realizado',
            desc: transaction.description,
            date: new Date().toISOString()
        }, ...prev]);
    }

    if (notification.status === NotificationStatus.SENT) {
        setSystemNotifications(prev => [{
            id: `sent-${notification.id}`,
            type: 'system',
            title: 'Notificação Enviada',
            desc: `Para: ${notification.recipientName}`,
            date: new Date().toISOString()
        }, ...prev]);
    }

    setCurrentView(ViewState.DASHBOARD);
  };

  const handleToggleSubscription = async () => {
      if (!user) return;
      const willActivate = !subscriptionData.active;
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      
      const newState = {
          active: willActivate,
          planName: willActivate ? 'Plano Pro' : 'Plano Gratuito',
          creditsTotal: willActivate ? 10 : 0,
          nextBillingDate: willActivate ? nextMonth.toLocaleDateString() : ''
      };

      await updateSubscriptionStatus(user.uid, newState);

      if (willActivate) {
          const newInvoice: Transaction = {
              id: `SUB-${Date.now()}`,
              description: 'Assinatura Mensal Pro',
              amount: 259.97,
              date: new Date().toISOString(),
              status: 'Pago'
          };
          await saveTransaction(user.uid, newInvoice);
          setTransactions(prev => [newInvoice, ...prev]);
      }

      setSubscriptionData(prev => ({
          ...prev,
          ...newState,
          creditsUsed: 0,
          invoices: willActivate ? [
              { id: `SUB-${Date.now()}`, description: 'Assinatura Mensal Pro', amount: 259.97, date: new Date().toISOString(), status: 'Pago' },
              ...prev.invoices
          ] : prev.invoices
      }));
  };

  const handleThemeChange = (isDark: boolean, color: string) => {
      setDarkMode(isDark);
      setThemeColor(color);
      localStorage.setItem('app_theme_pref', JSON.stringify({ dark: isDark, color }));
  };

  const handleNotificationClick = (alert: any) => {
      setShowNotificationsDropdown(false);
      // Redirecionamento Inteligente baseado no tipo do alerta
      if (alert.type === 'received') {
          setCurrentView(ViewState.RECEIVED_NOTIFICATIONS);
      } else if (alert.type === 'payment') {
          setCurrentView(ViewState.BILLING);
      } else if (alert.type === 'meeting') {
          setCurrentView(ViewState.MEETINGS);
      } else {
          setCurrentView(ViewState.MONITORING); // Default para notificações enviadas/sistema
      }
  };

  const renderContent = () => {
    switch (currentView) {
      case ViewState.DASHBOARD: return <Dashboard notifications={notifications} meetings={meetings} transactions={transactions} onNavigate={setCurrentView} user={user} />;
      case ViewState.CREATE_NOTIFICATION: return <NotificationCreator onSave={handleSaveNotification} user={user} onBack={() => setCurrentView(ViewState.DASHBOARD)} />;
      case ViewState.RECEIVED_NOTIFICATIONS: return <ReceivedNotifications />;
      case ViewState.MONITORING: return <Monitoring notifications={notifications} searchQuery={searchQuery} />;
      
      // Removed specific sub-folder views from generic navigation, defaulting to main components which handle filtering internally if needed, or removing filter props to show all.
      // But keeping prop capability in components if user drills down from Dashboard cards.
      case ViewState.NOTIFICATIONS_CREATED: 
      case ViewState.NOTIFICATIONS_DELIVERED: 
      case ViewState.NOTIFICATIONS_PENDING:
        // Lógica simplificada: O Dashboard card pode setar um filtro state, mas aqui vamos mandar para o Monitoring geral por enquanto ou passar filtro via prop se necessário.
        // Como o pedido foi "não mostrar subpastas removidas", vamos direcionar tudo para MONITORING (Notificações)
        return <Monitoring notifications={notifications} searchQuery={searchQuery} />;
      
      case ViewState.CONCILIATIONS_SCHEDULED:
      case ViewState.CONCILIATIONS_DONE:
      case ViewState.CONCILIATIONS_CANCELED:
      case ViewState.MEETINGS: 
        return <MeetingScheduler meetingsProp={meetings} />;
      
      case ViewState.PAYMENTS_CONFIRMED:
      case ViewState.PAYMENTS_PENDING:
      case ViewState.PAYMENTS_REFUNDED:
      case ViewState.BILLING: 
        return <Billing transactions={transactions} onRefund={handleRefund} />;
      
      case ViewState.FILES: return <FileManager />;
      
      case ViewState.SUBSCRIPTION_PLAN:
          return <SubscriptionManager subView="plan" subscriptionData={subscriptionData} onToggleSubscription={handleToggleSubscription} />;
      case ViewState.SUBSCRIPTION_HISTORY:
          return <SubscriptionManager subView="history" subscriptionData={subscriptionData} onToggleSubscription={handleToggleSubscription} />;

      case ViewState.SETTINGS: case ViewState.SETTINGS_ACCOUNT: case ViewState.SETTINGS_PLATFORM: return <Settings key={currentView} user={user} subView={currentView === ViewState.SETTINGS_PLATFORM ? 'platform' : 'account'} onThemeChange={handleThemeChange} initialTheme={{darkMode, themeColor}} />;
      default: return <Dashboard notifications={notifications} meetings={meetings} transactions={transactions} onNavigate={setCurrentView} user={user} />;
    }
  };

  if (showSplash) return <SplashScreen onFinish={() => setShowSplash(false)} />;
  if (loadingAuth) return <div className="flex h-screen items-center justify-center bg-zinc-100"><Loader2 className="animate-spin text-slate-400" size={32} /></div>;
  if (isLoggingOut) return <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center text-white animate-fade-in"><div className="mb-8 p-6 bg-white/5 rounded-full backdrop-blur-sm border border-white/10 relative"><div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping opacity-50"></div><LogOut size={48} className="text-slate-200 relative z-10" /></div><h2 className="text-3xl font-bold mb-2 tracking-tight animate-fade-in-up">Saindo da Conta</h2><p className="text-slate-400 text-sm mb-8 font-light">Sincronizando dados e encerrando sessão segura...</p><div className="w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 animate-[loading_3.5s_ease-in-out_forwards] w-full origin-left transform scale-x-0"></div></div><style>{`@keyframes loading { 0% { transform: scaleX(0); } 100% { transform: scaleX(1); } }`}</style></div>;
  if (!user) return <Login onLogin={handleLogin} />;

  const getThemeStyles = () => {
      const colors: any = {
          blue: { ring: 'focus-within:ring-blue-100' },
          purple: { ring: 'focus-within:ring-purple-100' },
          green: { ring: 'focus-within:ring-green-100' },
          orange: { ring: 'focus-within:ring-orange-100' }
      };
      return colors[themeColor] || colors.blue;
  };
  const theme = getThemeStyles();

  return (
    <div className={`flex min-h-screen ${darkMode ? 'bg-slate-900 text-slate-100' : 'bg-zinc-100 text-slate-900'} overflow-x-hidden transition-colors duration-500`}>
      <Sidebar currentView={currentView} onChangeView={setCurrentView} onLogout={handleLogout} isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      <main className={`flex-1 transition-all duration-300 p-4 md:p-8 ${isSidebarOpen ? 'md:ml-72' : 'md:ml-20'} w-full`}>
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-10 pt-2 gap-4 relative">
          <div className="flex items-center w-full md:w-auto">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`md:hidden mr-3 p-2 rounded-lg ${darkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-200'}`}><Menu size={24} /></button>
            {currentView !== ViewState.DASHBOARD && (<div><h1 className={`text-2xl md:text-3xl font-bold capitalize tracking-tight truncate max-w-[200px] md:max-w-none ${darkMode ? 'text-white' : 'text-slate-900'}`}>{currentView === ViewState.CREATE_NOTIFICATION ? 'Nova Notificação' : currentView.includes('settings') ? 'Configurações' : currentView === ViewState.RECEIVED_NOTIFICATIONS ? 'Caixa de Entrada' : currentView === ViewState.FILES ? 'Meus Arquivos' : currentView.replace(/_/g, ' ').replace('notifications', 'Notificações').replace('conciliations', 'Conciliações').replace('payments', 'Pagamentos')}</h1><p className={`text-xs md:text-sm mt-1 font-light truncate ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Painel do usuário, <span className={`font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{user.displayName || 'Usuário'}</span>.</p></div>)}
          </div>
          <div className="flex items-center space-x-3 md:space-x-6 w-full md:w-auto justify-end">
             <div className={`hidden md:flex items-center px-4 py-2.5 rounded-full border shadow-sm transition-all ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} ${theme.ring}`}><Search size={18} className={darkMode ? 'text-slate-500' : 'text-slate-400'} /><input type="text" placeholder="Buscar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`bg-transparent border-none outline-none text-sm ml-2 w-32 md:w-48 placeholder:text-slate-400 ${darkMode ? 'text-white' : 'text-slate-700'}`} /></div>
             <div className="relative">
                 <button onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)} className={`relative p-2.5 rounded-full transition border shadow-sm group ${darkMode ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-600 hover:text-blue-600 hover:bg-blue-50 border-slate-200'}`}><Bell size={20} className="group-hover:animate-pulse" />{systemNotifications.length > 0 && (<span className="absolute top-0 right-0 h-3 w-3 bg-red-500 rounded-full border-2 border-white"></span>)}</button>
                 {showNotificationsDropdown && (
                     <div className={`absolute right-0 mt-2 w-80 rounded-xl shadow-2xl border overflow-hidden z-50 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                         <div className={`p-3 border-b flex justify-between items-center ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}><h4 className={`font-bold text-sm ${darkMode ? 'text-white' : 'text-slate-800'}`}>Central de Notificações</h4><button onClick={() => setShowNotificationsDropdown(false)}><X size={16} className="text-slate-400" /></button></div>
                         <div className="max-h-64 overflow-y-auto">
                             {systemNotifications.length === 0 ? (<div className="p-6 text-center text-slate-500 text-sm">Nenhuma atualização recente.</div>) : (systemNotifications.map(alert => (
                                 <div key={alert.id} onClick={() => handleNotificationClick(alert)} className={`p-3 border-b cursor-pointer transition flex items-start gap-3 ${darkMode ? 'border-slate-700 hover:bg-slate-700' : 'border-slate-50 hover:bg-slate-50'}`}>
                                     <div className={`mt-1 ${alert.type === 'payment' ? 'text-green-500' : alert.type === 'received' ? 'text-blue-500' : 'text-amber-500'}`}>
                                         {alert.type === 'payment' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                     </div>
                                     <div>
                                         <p className={`text-sm font-bold ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{alert.title}</p>
                                         <p className="text-xs text-slate-500 line-clamp-1">{alert.desc}</p>
                                         <p className="text-[10px] text-slate-400 mt-1">{new Date(alert.date).toLocaleDateString()} {new Date(alert.date).toLocaleTimeString()}</p>
                                     </div>
                                 </div>
                             )))}
                         </div>
                     </div>
                 )}
             </div>
             <button onClick={() => setCurrentView(ViewState.SETTINGS)} className={`w-10 h-10 rounded-full flex items-center justify-center border transition shrink-0 ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50'}`} title="Configurações"><SettingsIcon size={20} /></button>
          </div>
        </header>
        {renderContent()}
      </main>
      {currentView !== ViewState.DASHBOARD && currentView !== ViewState.CREATE_NOTIFICATION && (<button onClick={() => setCurrentView(ViewState.DASHBOARD)} className="fixed bottom-6 right-6 z-50 p-4 bg-slate-900 text-white rounded-full shadow-2xl hover:bg-slate-800 transition-all transform hover:scale-105 flex items-center gap-2 group border border-slate-700" title="Voltar ao Painel"><ArrowLeft size={20} /><span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap font-bold text-sm">Voltar ao Início</span></button>)}
      {isSidebarOpen && (<div className="fixed inset-0 bg-black/50 z-10 md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>)}
    </div>
  );
};

export default App;
