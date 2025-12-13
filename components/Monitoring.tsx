
import React, { useState, useEffect } from 'react';
import { NotificationItem, NotificationStatus } from '../types';
import { getNotificationsBySender, getNotificationsByRecipientCpf, saveNotification } from '../services/notificationService';
import { initiateCheckout } from '../services/paymentService';
import { getUserProfile } from '../services/userService';
import { Send, RefreshCw, ChevronDown, ChevronUp, Package, Mail, FileText, CreditCard, Trash2, User, CheckCircle2, Circle, Clock, Inbox, Loader2, Zap, MapPin, AlertCircle, Copy, QrCode, MessageCircle, Check, Eye, Shield, Lock, Phone } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

interface MonitoringProps {
  notifications: NotificationItem[];
  filterStatus?: NotificationStatus[]; 
  searchQuery?: string;
  defaultTab?: 'sent' | 'received'; 
}

const Monitoring: React.FC<MonitoringProps> = ({ notifications: propNotifications, filterStatus, searchQuery = '', defaultTab = 'sent' }) => {
  const savedUser = localStorage.getItem('mock_session_user');
  const user = savedUser ? JSON.parse(savedUser) : null;
  
  const [activeTab, setActiveTab] = useState<'sent' | 'received'>(defaultTab);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Estados para Reenvio com Pagamento
  const [isResending, setIsResending] = useState(false);
  const [pixData, setPixData] = useState<{ encodedImage: string, payload: string } | null>(null);

  useEffect(() => {
      if (defaultTab) setActiveTab(defaultTab);
  }, [defaultTab]);

  // --- REAL-TIME LISTENER ---
  useEffect(() => {
    if (!user) {
        setLoading(false);
        return;
    }

    setLoading(true);
    let unsubscribe = () => {};

    const setupListeners = async () => {
        if (activeTab === 'sent') {
            const q = query(
                collection(db, 'notificacoes'), 
                where("notificante_uid", "==", user.uid)
            );
            
            unsubscribe = onSnapshot(q, (snapshot) => {
                const liveData: NotificationItem[] = [];
                snapshot.forEach((doc) => {
                    const data = doc.data() as NotificationItem;
                    // LÓGICA RÍGIDA: Apenas mostrar se JÁ PAGO ou ENVIADO
                    if (data.status === NotificationStatus.PENDING_PAYMENT || data.status === NotificationStatus.DRAFT) return;
                    liveData.push(data);
                });
                liveData.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                setItems(liveData);
                setLoading(false);
            });

        } else {
            // RECEBIDAS: Precisa do CPF do perfil
            const profile = await getUserProfile(user.uid);
            if (profile && profile.cpf) {
                 const cleanCpf = profile.cpf.replace(/\D/g, '');
                 const q = query(
                    collection(db, 'notificacoes'),
                    where("notificados_cpfs", "array-contains", cleanCpf)
                 );
                 
                 unsubscribe = onSnapshot(q, (snapshot) => {
                    const liveData: NotificationItem[] = [];
                    snapshot.forEach((doc) => {
                        const data = doc.data() as NotificationItem;
                        if (data.status !== NotificationStatus.DRAFT && data.status !== NotificationStatus.PENDING_PAYMENT) {
                            liveData.push(data);
                        }
                    });
                    liveData.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                    setItems(liveData);
                    setLoading(false);
                 });
            } else {
                setLoading(false);
            }
        }
    };

    setupListeners();
    return () => unsubscribe();
  }, [user?.uid, activeTab]);

  // Filtragem local
  useEffect(() => {
    let result = items;
    if (filterStatus && filterStatus.length > 0 && activeTab === 'sent') {
        result = result.filter(i => filterStatus.includes(i.status));
    }
    if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        result = result.filter(item => 
            item.recipientName?.toLowerCase().includes(query) ||
            item.notificante_dados_expostos?.nome?.toLowerCase().includes(query) ||
            item.species?.toLowerCase().includes(query) ||
            item.subject?.toLowerCase().includes(query) ||
            item.id.toLowerCase().includes(query)
        );
    }
    setFilteredItems(result);
  }, [items, filterStatus, activeTab, searchQuery]);


  const handleResendWithPayment = async (item: NotificationItem) => {
      if(!confirm("Deseja reenviar esta notificação? Será gerado um novo pagamento de R$ 57,92.")) return;
      
      setIsResending(true);
      try {
          await saveNotification({
              ...item,
              status: NotificationStatus.PENDING_PAYMENT,
              createdAt: new Date().toISOString()
          });

          const response = await initiateCheckout(item, 'single', 'PIX');
          
          if (response.success && response.pixData) {
              setPixData(response.pixData);
          } else {
              alert("Erro ao gerar cobrança: " + response.error);
          }
      } catch (e) {
          console.error(e);
          alert("Erro ao processar reenvio.");
      } finally {
          setIsResending(false);
      }
  };

  const toggleExpand = async (item: NotificationItem) => {
      setExpandedId(expandedId === item.id ? null : item.id);
  };

  const DeliveryFlow = ({ notification }: { notification: NotificationItem }) => {
      const isDelivered = notification.status === NotificationStatus.DELIVERED || notification.status === NotificationStatus.READ || notification.whatsappStatus === 'DELIVERED' || notification.whatsappStatus === 'READ';
      const isRead = notification.status === NotificationStatus.READ || notification.whatsappStatus === 'READ' || notification.emailStatus === 'OPENED';
      const emailSt = notification.emailStatus;
      const whatsSt = notification.whatsappStatus;

      return (
          <div className="w-full">
            <div className="flex items-center justify-between w-full max-w-md mt-4 relative px-2 mb-6">
                <div className="absolute top-2.5 left-0 w-full h-0.5 bg-slate-200 -z-10"></div>
                {[
                    { label: 'Paga', completed: true },
                    { label: 'Enviada', completed: true },
                    { label: 'Entregue', completed: isDelivered },
                    { label: 'Lida', completed: isRead }
                ].map((step, idx) => (
                    <div key={idx} className="flex flex-col items-center z-10 bg-white px-1">
                        {step.completed ? (
                            <CheckCircle2 size={24} className="text-green-500 bg-white rounded-full border-2 border-green-500" />
                        ) : (
                            <Circle size={24} className="text-slate-300 bg-white rounded-full border-2 border-slate-200" />
                        )}
                        <span className={`text-[10px] mt-1 font-bold ${step.completed ? 'text-slate-800' : 'text-slate-400'}`}>
                            {step.label}
                        </span>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex items-start gap-3">
                    <div className="p-2 bg-slate-100 rounded-full">
                        <Mail size={16} className="text-slate-600"/>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-700">E-mail</p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[120px]" title={notification.recipientEmail}>{notification.recipientEmail}</p>
                        <div className="mt-1">
                            {emailSt === 'OPENED' || emailSt === 'CLICKED' ? (
                                <span className="text-[10px] font-bold text-green-600 flex items-center"><Eye size={10} className="mr-1"/> Lido / Aberto</span>
                            ) : emailSt === 'DELIVERED' ? (
                                <span className="text-[10px] font-bold text-blue-600 flex items-center"><Check size={10} className="mr-1"/> Entregue</span>
                            ) : (
                                <span className="text-[10px] font-bold text-slate-500 flex items-center"><Clock size={10} className="mr-1"/> Enviado</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex items-start gap-3">
                    <div className="p-2 bg-emerald-50 rounded-full">
                        <MessageCircle size={16} className="text-emerald-600"/>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-700">WhatsApp</p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[120px]">{notification.recipientPhone || '-'}</p>
                        <div className="mt-1">
                            {whatsSt === 'READ' ? (
                                <span className="text-[10px] font-bold text-blue-500 flex items-center">
                                    <Check size={10} className="mr-0.5"/><Check size={10} className="mr-1 -ml-1"/> Lido
                                </span>
                            ) : whatsSt === 'DELIVERED' ? (
                                <span className="text-[10px] font-bold text-slate-500 flex items-center">
                                    <Check size={10} className="mr-0.5"/><Check size={10} className="mr-1 -ml-1"/> Entregue
                                </span>
                            ) : (
                                <span className="text-[10px] font-bold text-slate-400 flex items-center"><Check size={10} className="mr-1"/> Enviado</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
          </div>
      );
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-10">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">
                {activeTab === 'sent' ? 'Notificações Enviadas' : 'Notificações Recebidas'}
            </h2>
            <p className="text-slate-500">
                {activeTab === 'sent' ? 'Acompanhe documentos pagos e em trânsito.' : 'Documentos oficiais recebidos destinados ao seu CPF.'}
            </p>
        </div>
        {loading && <div className="flex items-center text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-full"><Loader2 size={12} className="animate-spin mr-2"/> Sincronizando...</div>}
      </div>

      {/* Lista */}
      <div className="space-y-4">
        {loading && items.length === 0 ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div></div>
        ) : filteredItems.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center animate-fade-in">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    {activeTab === 'sent' ? <Package className="text-slate-400" size={24} /> : <Inbox className="text-slate-400" size={24} />}
                </div>
                <h3 className="text-lg font-medium text-slate-700">
                    {activeTab === 'sent' ? 'Nenhuma notificação ativa' : 'Caixa de entrada vazia'}
                </h3>
                {activeTab === 'sent' && <p className="text-sm text-slate-400 mt-2">Notificações aguardando pagamento estão na aba Pagamentos.</p>}
            </div>
        ) : (
            filteredItems.map((notif) => (
                <div 
                    key={notif.id} 
                    className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${
                        expandedId === notif.id ? 'shadow-lg border-blue-200 ring-1 ring-blue-100' : 'shadow-sm border-slate-200 hover:border-blue-200'
                    }`}
                >
                    <div 
                        onClick={() => toggleExpand(notif)}
                        className="p-5 flex items-center justify-between cursor-pointer group"
                    >
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors border ${
                                notif.status === NotificationStatus.READ ? 'bg-green-100 text-green-600 border-green-200' : 
                                activeTab === 'received' ? 'bg-orange-100 text-orange-600 border-orange-200' : 'bg-blue-50 text-blue-600 border-blue-100'
                            }`}>
                                {notif.status === NotificationStatus.READ ? <CheckCircle2 size={24} /> : (activeTab === 'sent' ? <Send size={20} /> : <Mail size={20} />)}
                            </div>
                            <div>
                                <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                                    <h4 className="font-bold text-slate-800 text-sm md:text-base group-hover:text-blue-600 transition-colors">
                                        {activeTab === 'sent' ? `Para: ${notif.recipientName}` : `De: ${notif.notificante_dados_expostos?.nome || 'Remetente'}`}
                                    </h4>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                                        notif.status === NotificationStatus.READ 
                                        ? 'bg-green-100 text-green-700 border-green-200' 
                                        : 'bg-blue-50 text-blue-600 border-blue-100'
                                    }`}>
                                        {notif.status}
                                    </span>
                                    {activeTab === 'received' && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border bg-slate-100 text-slate-500 border-slate-200 flex items-center">
                                            <Lock size={8} className="mr-1"/> Privado
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 mt-1 font-medium">{notif.species} <span className="text-slate-300 mx-1">•</span> {notif.subject}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{new Date(notif.createdAt).toLocaleDateString()} às {new Date(notif.createdAt).toLocaleTimeString()}</p>
                            </div>
                        </div>
                        <div className="text-slate-400 bg-slate-50 p-1 rounded-full group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                            {expandedId === notif.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                    </div>

                    {expandedId === notif.id && (
                        <div className="bg-slate-50 border-t border-slate-100 p-6 animate-slide-in-down">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div>
                                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Status & Rastreamento</h5>
                                    
                                    <div className="mb-6 p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                                        <DeliveryFlow notification={notif} />
                                    </div>
                                    
                                    {/* Exibe dados COMPLETOS de envio */}
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 mt-4 shadow-sm">
                                        <h6 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center"><User size={12} className="mr-1"/> 
                                            {activeTab === 'sent' ? 'Dados do Destinatário (Para quem foi enviado)' : 'Dados do Remetente'}
                                        </h6>
                                        <div className="space-y-3">
                                            <div className="flex justify-between border-b border-slate-50 pb-2">
                                                <span className="text-xs text-slate-400">Nome</span>
                                                <span className="text-xs font-medium text-slate-700">
                                                    {activeTab === 'sent' ? notif.recipientName : notif.notificante_dados_expostos?.nome}
                                                </span>
                                            </div>
                                            <div className="flex justify-between border-b border-slate-50 pb-2">
                                                <span className="text-xs text-slate-400">Documento (CPF/CNPJ)</span>
                                                <span className="text-xs font-medium text-slate-700 font-mono">
                                                    {activeTab === 'sent' ? (notif.recipientDocument || 'Não informado') : notif.notificante_cpf || '***.***.***-**'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between border-b border-slate-50 pb-2">
                                                <span className="text-xs text-slate-400">WhatsApp de Envio</span>
                                                <span className="text-xs font-medium text-slate-700 font-mono flex items-center">
                                                    <Phone size={10} className="mr-1 text-emerald-500"/>
                                                    {activeTab === 'sent' ? (notif.recipientPhone || 'Não informado') : notif.notificante_dados_expostos?.telefone}
                                                </span>
                                            </div>
                                            {activeTab === 'sent' && (
                                                <div className="flex justify-between pb-2">
                                                    <span className="text-xs text-slate-400">E-mail de Envio</span>
                                                    <span className="text-xs font-medium text-slate-700">
                                                        {notif.recipientEmail || 'Não informado'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* EVIDÊNCIAS ANEXADAS */}
                                    {notif.evidences && notif.evidences.length > 0 && (
                                        <div className="mt-6">
                                            <h6 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center"><Shield size={12} className="mr-1"/> Evidências Anexadas</h6>
                                            <div className="flex gap-2 overflow-x-auto pb-2">
                                                {notif.evidences.map((ev) => (
                                                    <a key={ev.id} href={ev.url} target="_blank" rel="noopener noreferrer" className="block w-20 h-20 rounded-lg border border-slate-200 overflow-hidden relative hover:opacity-80 transition bg-white" title={ev.name}>
                                                        {ev.type === 'image' ? (
                                                            <img src={ev.url} alt={ev.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-400 flex-col">
                                                                <FileText size={20} className="mb-1"/>
                                                                <span className="text-[8px] uppercase">DOC</span>
                                                            </div>
                                                        )}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col justify-between">
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 mb-4 h-full relative">
                                        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Resumo da Notificação</h5>
                                        <p className="text-sm text-slate-600 leading-relaxed italic line-clamp-[10]">
                                            "{notif.content?.substring(0, 500)}..."
                                        </p>
                                        {activeTab === 'received' && (
                                            <div className="absolute top-2 right-2 bg-slate-100 text-slate-500 text-[9px] font-bold px-2 py-1 rounded border border-slate-200 flex items-center">
                                                <Lock size={8} className="mr-1"/> Somente Leitura
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        {notif.pdf_url && (
                                            <a href={notif.pdf_url} target="_blank" rel="noopener noreferrer" className="w-full bg-slate-900 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center hover:bg-slate-800 shadow-lg shadow-slate-300 transition-all">
                                                <FileText size={16} className="mr-2" /> Visualizar Documento Original (PDF)
                                            </a>
                                        )}

                                        {activeTab === 'sent' && (
                                            <button 
                                                onClick={() => handleResendWithPayment(notif)}
                                                disabled={isResending}
                                                className="w-full bg-white text-blue-600 border border-blue-200 py-3 rounded-xl text-sm font-bold flex items-center justify-center hover:bg-blue-50 transition-all"
                                            >
                                                {isResending ? <Loader2 className="animate-spin mr-2"/> : <Zap size={16} className="mr-2" />}
                                                Reenviar com Novo Pagamento
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ))
        )}
      </div>

      {/* MODAL PIX PARA REENVIO (Apenas Sender) */}
      {pixData && activeTab === 'sent' && (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
                  <div className="bg-slate-900 p-4 flex justify-between items-center text-white">
                      <h3 className="font-bold flex items-center"><QrCode size={18} className="mr-2 text-emerald-400"/> Pagamento Pix</h3>
                      <button onClick={() => setPixData(null)} className="text-slate-400 hover:text-white"><Zap size={18} className="rotate-45"/></button>
                  </div>
                  <div className="p-6 flex flex-col items-center text-center">
                      <p className="text-sm text-slate-500 mb-4">Escaneie para confirmar o reenvio.</p>
                      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-inner mb-4">
                          <img src={`data:image/png;base64,${pixData.encodedImage}`} alt="Pix QR" className="w-48 h-48" />
                      </div>
                      <div className="flex gap-2 w-full">
                          <input type="text" readOnly value={pixData.payload} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-500 truncate" />
                          <button 
                            onClick={() => {navigator.clipboard.writeText(pixData.payload); alert("Copiado!");}}
                            className="bg-blue-100 text-blue-600 p-2 rounded-lg hover:bg-blue-200 transition"
                          >
                              <Copy size={16}/>
                          </button>
                      </div>
                      <button onClick={() => { setPixData(null); }} className="mt-4 w-full py-3 bg-slate-900 text-white rounded-xl font-bold">Fechar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Monitoring;
