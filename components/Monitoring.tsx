
import React, { useState, useEffect } from 'react';
import { NotificationItem, NotificationStatus } from '../types';
import { getNotificationsBySender, getNotificationsByRecipientCpf, saveNotification } from '../services/notificationService';
import { initiateCheckout } from '../services/paymentService';
import { getUserProfile } from '../services/userService';
import { Send, RefreshCw, ChevronDown, ChevronUp, Package, Mail, FileText, CreditCard, Trash2, User, CheckCircle2, Circle, Clock, Inbox, Loader2, Zap, MapPin, AlertCircle, Copy, QrCode, MessageCircle } from 'lucide-react';

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
  const [senderProfile, setSenderProfile] = useState<any>(null);

  // Estados para Reenvio com Pagamento
  const [isResending, setIsResending] = useState(false);
  const [pixData, setPixData] = useState<{ encodedImage: string, payload: string } | null>(null);

  useEffect(() => {
      if (defaultTab) setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    fetchData();
  }, [user?.uid, activeTab]); 

  // Sincroniza props
  useEffect(() => {
      if (propNotifications.length > 0 && activeTab === 'sent') {
          setItems(prev => {
              const currentIds = new Set(prev.map(i => i.id));
              const newItems = propNotifications.filter(pn => !currentIds.has(pn.id));
              if (newItems.length > 0) {
                  return [...newItems, ...prev].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              }
              return prev;
          });
      }
  }, [propNotifications, activeTab]);

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

  const fetchData = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
        if (activeTab === 'sent') {
            const data = await getNotificationsBySender(user.uid);
            // Filtra para mostrar na pasta "Notificações" apenas as pagas/enviadas
            // As pendentes ficam na pasta "Pagamentos"
            const sentOnly = data.filter(d => d.status !== NotificationStatus.PENDING_PAYMENT);
            setItems(sentOnly);
        } else {
            const profile = await getUserProfile(user.uid);
            if (profile && profile.cpf) {
                const cleanCpf = profile.cpf.replace(/\D/g, '');
                const data = await getNotificationsByRecipientCpf(cleanCpf);
                setItems(data);
            } else {
                setItems([]); 
            }
        }
    } catch (error) {
        console.error("Erro ao buscar dados:", error);
    } finally {
        setLoading(false);
    }
  };

  const handleResendWithPayment = async (item: NotificationItem) => {
      if(!confirm("Deseja reenviar esta notificação? Será gerado um novo pagamento de R$ 57,92.")) return;
      
      setIsResending(true);
      try {
          // 1. Reseta o status para Pendente no Banco
          await saveNotification({
              ...item,
              status: NotificationStatus.PENDING_PAYMENT,
              createdAt: new Date().toISOString() // Atualiza data para subir na lista
          });

          // 2. Gera Novo Pix
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
      if (expandedId === item.id) {
          setExpandedId(null);
      } else {
          setExpandedId(item.id);
          if (activeTab === 'received' && item.notificante_uid) {
             const profile = await getUserProfile(item.notificante_uid);
             setSenderProfile(profile);
          }
      }
  };

  const DeliveryFlow = ({ status }: { status: NotificationStatus }) => {
      const steps = [
          { label: 'Paga', completed: true },
          { label: 'Enviada', completed: [NotificationStatus.SENT, NotificationStatus.DELIVERED, NotificationStatus.READ].includes(status) },
          { label: 'Entregue', completed: [NotificationStatus.DELIVERED, NotificationStatus.READ].includes(status) },
          { label: 'Lida', completed: status === NotificationStatus.READ }
      ];

      return (
          <div className="flex items-center justify-between w-full max-w-md mt-4 relative px-2">
              <div className="absolute top-2.5 left-0 w-full h-0.5 bg-slate-200 -z-10"></div>
              {steps.map((step, idx) => (
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
                {activeTab === 'sent' ? 'Histórico de documentos pagos e disparados.' : 'Documentos extrajudiciais recebidos em seu CPF.'}
            </p>
        </div>
        <button onClick={fetchData} className="flex items-center text-sm font-medium text-slate-600 hover:text-blue-600 bg-white border border-slate-200 px-3 py-2 rounded-lg transition-all shadow-sm">
            <RefreshCw size={14} className="mr-2" /> Atualizar
        </button>
      </div>

      {/* Lista */}
      <div className="space-y-4">
        {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div></div>
        ) : filteredItems.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center animate-fade-in">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    {activeTab === 'sent' ? <Package className="text-slate-400" size={24} /> : <Inbox className="text-slate-400" size={24} />}
                </div>
                <h3 className="text-lg font-medium text-slate-700">
                    {activeTab === 'sent' ? 'Nenhuma notificação enviada' : 'Caixa de entrada vazia'}
                </h3>
                <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
                    {activeTab === 'sent' 
                        ? 'As notificações aparecem aqui após a confirmação do pagamento.' 
                        : 'Nenhum documento encontrado para seu CPF.'}
                </p>
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
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors border bg-blue-50 text-blue-600 border-blue-100`}>
                                {activeTab === 'sent' ? <Send size={20} /> : <Mail size={20} />}
                            </div>
                            <div>
                                <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                                    <h4 className="font-bold text-slate-800 text-sm md:text-base group-hover:text-blue-600 transition-colors">
                                        {activeTab === 'sent' ? `Para: ${notif.recipientName}` : `De: ${notif.notificante_dados_expostos?.nome || 'Remetente'}`}
                                    </h4>
                                    <span className="self-start md:self-auto px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border bg-green-100 text-green-700 border-green-200">
                                        Enviada
                                    </span>
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
                                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Rastreamento de Entrega</h5>
                                    
                                    <div className="mb-6 p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                                        <DeliveryFlow status={notif.status} />
                                        <div className="mt-4 pt-4 border-t border-slate-50 grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <p className="font-bold text-slate-700 flex items-center"><Mail size={12} className="mr-1"/> E-mail</p>
                                                <p className="text-slate-500 truncate" title={notif.recipientEmail}>{notif.recipientEmail}</p>
                                                <p className="text-green-600 font-bold mt-0.5">Enviado com sucesso</p>
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-700 flex items-center"><MessageCircle size={12} className="mr-1"/> WhatsApp</p>
                                                <p className="text-slate-500">{notif.recipientPhone || '-'}</p>
                                                <p className="text-green-600 font-bold mt-0.5">Enviado com sucesso</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Alerta de Erro (Simulado para UX) */}
                                    {(!notif.recipientEmail || !notif.recipientPhone) && (
                                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-2 mb-4">
                                            <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                                            <div>
                                                <p className="text-xs font-bold text-amber-700">Atenção nos dados de contato</p>
                                                <p className="text-xs text-amber-600">Alguns canais de envio podem ter falhado se o destinatário não possui e-mail ou telefone cadastrado.</p>
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 mt-4 shadow-sm">
                                        <h6 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center"><User size={12} className="mr-1"/> Dados do Notificado</h6>
                                        <div className="space-y-2">
                                            <div className="flex justify-between border-b border-slate-50 pb-2">
                                                <span className="text-xs text-slate-400">Nome</span>
                                                <span className="text-xs font-medium text-slate-700">{notif.recipientName}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-slate-50 pb-2">
                                                <span className="text-xs text-slate-400">CPF/CNPJ</span>
                                                <span className="text-xs font-medium text-slate-700">{notif.recipientDocument}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col justify-between">
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 mb-4 h-full">
                                        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Resumo da Notificação</h5>
                                        <p className="text-sm text-slate-600 leading-relaxed italic line-clamp-6">
                                            "{notif.content?.substring(0, 300)}..."
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        {notif.pdf_url && (
                                            <a href={notif.pdf_url} target="_blank" rel="noopener noreferrer" className="w-full bg-slate-900 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center hover:bg-slate-800 shadow-lg shadow-slate-300 transition-all">
                                                <FileText size={16} className="mr-2" /> Visualizar Documento (PDF)
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

      {/* MODAL PIX PARA REENVIO */}
      {pixData && (
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
                      <p className="text-xs text-amber-600 mt-4 bg-amber-50 p-2 rounded">
                          Após o pagamento, a notificação será disparada novamente e aparecerá nesta lista.
                      </p>
                      <button onClick={() => { setPixData(null); fetchData(); }} className="mt-4 w-full py-3 bg-slate-900 text-white rounded-xl font-bold">Fechar e Aguardar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Monitoring;
