
import React, { useState, useEffect } from 'react';
import { NotificationItem, NotificationStatus } from '../types';
import { getNotificationsBySender, getNotificationsByRecipientCpf, deleteNotification, confirmPayment } from '../services/notificationService';
import { restoreLatestCanceledMeeting } from '../services/meetingService';
import { dispatchCommunications } from '../services/communicationService'; 
import { getUserProfile } from '../services/userService';
import { Send, RefreshCw, ChevronDown, ChevronUp, Package, Mail, FileText, CreditCard, Trash2, User, CheckCircle2, Circle, Clock, FileEdit, Archive, Inbox, Loader2, Zap } from 'lucide-react';

interface MonitoringProps {
  notifications: NotificationItem[];
  filterStatus?: NotificationStatus[]; 
  searchQuery?: string;
  defaultTab?: 'sent' | 'received'; 
  customFolderConfig?: {
      title: string;
      desc?: string;
      icon: any;
      colorClass: string;
      borderClass: string;
  };
}

const Monitoring: React.FC<MonitoringProps> = ({ notifications: propNotifications, filterStatus, searchQuery = '', defaultTab = 'sent', customFolderConfig }) => {
  const savedUser = localStorage.getItem('mock_session_user');
  const user = savedUser ? JSON.parse(savedUser) : null;
  
  const [activeTab, setActiveTab] = useState<'sent' | 'received'>(defaultTab);
  
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null); 
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const [senderProfile, setSenderProfile] = useState<any>(null);

  useEffect(() => {
      if (defaultTab) {
          setActiveTab(defaultTab);
      }
  }, [defaultTab]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, activeTab, propNotifications]); 

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
    if (!user) return;
    setLoading(true);
    try {
        if (activeTab === 'sent') {
            const data = await getNotificationsBySender(user.uid);
            // Sincroniza com as props vindas do App (que podem ser mais novas devido ao fluxo de criação)
            const combinedMap = new Map();
            data.forEach(item => combinedMap.set(item.id, item));
            propNotifications.forEach(item => {
                // Prioriza o que veio do banco, a não ser que a prop seja mais nova?
                // Vamos dar merge garantindo que se o ID existe, pegamos o status mais avançado
                if(item.notificante_uid === user.uid) {
                    const existing = combinedMap.get(item.id);
                    if (existing && existing.status === NotificationStatus.SENT) {
                        // Mantém SENT do banco
                    } else {
                        combinedMap.set(item.id, item);
                    }
                }
            });
            
            const uniqueItems = Array.from(combinedMap.values()).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setItems(uniqueItems);
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

  const handleDelete = async (item: NotificationItem) => {
      if (item.status !== NotificationStatus.PENDING_PAYMENT && item.status !== NotificationStatus.DRAFT) {
          alert("Não é possível excluir notificações já processadas.");
          return;
      }
      if (window.confirm("Tem certeza? Isso excluirá a notificação e todos os arquivos.")) {
          await deleteNotification(item);
          fetchData();
      }
  };

  // Botão de Retry Manual (para casos onde o automático falhou ou o usuário quer forçar)
  const handleRetrySend = async (item: NotificationItem) => {
      setProcessingId(item.id);
      try {
          const success = await dispatchCommunications(item);
          if (success) {
              alert("Notificação reenviada com sucesso!");
          } else {
              alert("Tentativa de reenvio falhou. Verifique o status da API.");
          }
      } catch (e) {
          console.error(e);
      } finally {
          setProcessingId(null);
      }
  };

  const handlePay = async (item: NotificationItem) => {
      if (window.confirm(`Confirmar pagamento de R$ ${item.paymentAmount?.toFixed(2)} e disparar notificação?`)) {
          setProcessingId(item.id);
          try {
              // 1. Atualiza status no banco
              await confirmPayment(item.id);
              
              // 2. Dispara comunicações
              const sendSuccess = await dispatchCommunications(item);
              
              if (user) {
                  await restoreLatestCanceledMeeting(user.uid);
              }
              
              await fetchData();
              
              if (sendSuccess) {
                  alert("Pagamento confirmado e Notificação disparada com sucesso!");
              } else {
                  alert("Pagamento confirmado, mas houve um erro no disparo. O sistema tentará novamente.");
              }
          } catch (error) {
              console.error(error);
              alert("Erro ao processar pagamento.");
          } finally {
              setProcessingId(null);
          }
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

  const getStatusColor = (status: NotificationStatus) => {
    switch (status) {
      case NotificationStatus.SENT: return 'bg-blue-100 text-blue-700 border-blue-200';
      case NotificationStatus.DELIVERED: return 'bg-green-100 text-green-700 border-green-200';
      case NotificationStatus.READ: return 'bg-purple-100 text-purple-700 border-purple-200';
      case NotificationStatus.PENDING_PAYMENT: return 'bg-amber-100 text-amber-700 border-amber-200';
      case NotificationStatus.DRAFT: return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getFolderConfig = () => {
      if (customFolderConfig) return customFolderConfig;

      if (!filterStatus || filterStatus.length === 0) return null;
      
      if (filterStatus.includes(NotificationStatus.DRAFT)) {
          return {
              title: 'Rascunhos & Criadas',
              desc: 'Notificações geradas aguardando envio ou pagamento.',
              icon: FileEdit,
              colorClass: 'bg-gray-100 text-gray-600',
              borderClass: 'border-gray-200'
          };
      }
      if (filterStatus.includes(NotificationStatus.SENT)) {
          return {
              title: 'Enviadas & Entregues',
              desc: 'Histórico de notificações processadas e finalizadas.',
              icon: CheckCircle2,
              colorClass: 'bg-green-100 text-green-600',
              borderClass: 'border-green-200'
          };
      }
      if (filterStatus.includes(NotificationStatus.PENDING_PAYMENT)) {
          return {
              title: 'Pendências Financeiras',
              desc: 'Itens aguardando confirmação de pagamento para envio.',
              icon: Clock,
              colorClass: 'bg-amber-100 text-amber-600',
              borderClass: 'border-amber-200'
          };
      }
      return null;
  };

  const folderConfig = getFolderConfig();

  const DeliveryFlow = ({ status }: { status: NotificationStatus }) => {
      const steps = [
          { label: 'Gerada', completed: true },
          { label: 'Paga/Enviada', completed: [NotificationStatus.SENT, NotificationStatus.DELIVERED, NotificationStatus.READ].includes(status) },
          { label: 'Em Trânsito', completed: [NotificationStatus.SENT, NotificationStatus.DELIVERED, NotificationStatus.READ].includes(status) },
          { label: 'Entregue', completed: [NotificationStatus.DELIVERED, NotificationStatus.READ].includes(status) }
      ];

      if (status === NotificationStatus.PENDING_PAYMENT || status === NotificationStatus.DRAFT) {
          return <div className="text-amber-600 text-xs font-bold bg-amber-50 p-2 rounded border border-amber-100 text-center flex items-center justify-center"><Clock size={14} className="mr-1"/> Aguardando Pagamento / Envio</div>;
      }

      return (
          <div className="flex items-center justify-between w-full max-w-md mt-4 relative">
              <div className="absolute top-2.5 left-0 w-full h-0.5 bg-slate-200 -z-10"></div>
              {steps.map((step, idx) => (
                  <div key={idx} className="flex flex-col items-center z-10">
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
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        {folderConfig ? (
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${folderConfig.colorClass} border ${folderConfig.borderClass} shadow-sm`}>
                    <folderConfig.icon size={24} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">{folderConfig.title}</h2>
                    {folderConfig.desc && <p className="text-slate-500 text-sm">{folderConfig.desc}</p>}
                </div>
            </div>
        ) : (
            <div>
                <h2 className="text-2xl font-bold text-slate-800">
                    {activeTab === 'sent' ? 'Monitoramento de Envios' : 'Caixa de Entrada'}
                </h2>
                <p className="text-slate-500">
                    {activeTab === 'sent' ? 'Acompanhe as notificações que você criou.' : 'Notificações extrajudiciais recebidas pelo seu CPF.'}
                </p>
            </div>
        )}

        <button onClick={fetchData} className="flex items-center text-sm font-medium text-slate-600 hover:text-blue-600 bg-white border border-slate-200 px-3 py-2 rounded-lg transition-all shadow-sm">
            <RefreshCw size={14} className="mr-2" /> Atualizar
        </button>
      </div>

      <div className="bg-white p-1 rounded-xl border border-slate-200 inline-flex shadow-sm mb-4">
          <button 
            onClick={() => setActiveTab('sent')}
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'sent' 
                ? 'bg-slate-900 text-white shadow-md' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
              <Send size={16} className="mr-2" />
              Enviados por Mim
          </button>
          <button 
            onClick={() => setActiveTab('received')}
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'received' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
              <Inbox size={16} className="mr-2" />
              Recebidos (Meu CPF)
          </button>
      </div>

      <div className="space-y-4">
        {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div></div>
        ) : filteredItems.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center animate-fade-in">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    {activeTab === 'sent' ? <Package className="text-slate-400" size={24} /> : <Inbox className="text-slate-400" size={24} />}
                </div>
                <h3 className="text-lg font-medium text-slate-700">
                    {searchQuery ? 'Nenhum resultado para a busca' : (activeTab === 'sent' ? 'Nenhum envio nesta pasta' : 'Caixa de entrada vazia')}
                </h3>
                <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
                    {searchQuery 
                      ? `Não encontramos notificações com o termo "${searchQuery}".`
                      : activeTab === 'sent' 
                        ? (folderConfig ? 'Não há notificações com este status no momento.' : 'Você ainda não criou nenhuma notificação.')
                        : 'Nenhuma notificação foi encontrada vinculada ao seu CPF. Verifique se o seu CPF está preenchido corretamente nas Configurações.'
                    }
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
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors border ${
                                notif.status === NotificationStatus.READ ? 'bg-purple-50 text-purple-600 border-purple-100' : 
                                notif.status === NotificationStatus.SENT ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                                notif.status === NotificationStatus.PENDING_PAYMENT ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-500 border-slate-100'
                            }`}>
                                {activeTab === 'sent' ? <Send size={20} /> : <Mail size={20} />}
                            </div>
                            <div>
                                <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                                    <h4 className="font-bold text-slate-800 text-sm md:text-base group-hover:text-blue-600 transition-colors">
                                        {activeTab === 'sent' ? `Para: ${notif.recipientName}` : `De: ${notif.notificante_dados_expostos?.nome || 'Remetente'}`}
                                    </h4>
                                    <span className={`self-start md:self-auto px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${getStatusColor(notif.status)}`}>
                                        {notif.status === NotificationStatus.SENT ? 'Em Trânsito' : notif.status}
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
                                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Status da Entrega</h5>
                                    
                                    <div className="mb-6 p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                                        <DeliveryFlow status={notif.status} />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-slate-400 text-xs">Protocolo</p>
                                            <p className="font-mono text-slate-700 font-bold">{notif.id}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-400 text-xs">Natureza</p>
                                            <p className="text-slate-700 font-medium">{notif.species}</p>
                                        </div>
                                    </div>
                                    
                                    {activeTab === 'received' && senderProfile && (
                                        <div className="bg-white p-4 rounded-xl border border-blue-100 mt-6 shadow-sm">
                                            <h6 className="text-xs font-bold text-blue-400 uppercase mb-3 flex items-center"><User size={12} className="mr-1"/> Remetente Identificado</h6>
                                            <div className="flex items-center gap-3">
                                                {senderProfile.photoUrl ? (
                                                    <img src={senderProfile.photoUrl} className="w-10 h-10 rounded-full object-cover border border-slate-200" alt="Sender"/>
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold">{senderProfile.name?.charAt(0)}</div>
                                                )}
                                                <div>
                                                    <p className="font-bold text-slate-800 text-sm">{senderProfile.name}</p>
                                                    <p className="text-xs text-slate-500">{senderProfile.email}</p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">CPF Verificado na Plataforma</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {notif.evidences && notif.evidences.length > 0 && (
                                        <div className="mt-6">
                                            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Evidências Anexadas</h5>
                                            <div className="flex flex-wrap gap-2">
                                                {notif.evidences.map((ev, idx) => (
                                                    <a key={idx} href={ev.url} target="_blank" rel="noopener noreferrer" className="flex items-center bg-white px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-400 hover:text-blue-600 text-xs text-slate-600 transition shadow-sm">
                                                        <Archive size={12} className="mr-2" />
                                                        {ev.name}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col justify-between">
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 mb-4 h-full">
                                        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Resumo do Conteúdo</h5>
                                        <p className="text-sm text-slate-600 leading-relaxed italic line-clamp-6">
                                            "{notif.content?.substring(0, 300)}..."
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        {notif.pdf_url && (
                                            <a href={notif.pdf_url} target="_blank" rel="noopener noreferrer" className="w-full bg-slate-900 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center hover:bg-slate-800 shadow-lg shadow-slate-300 transition-all">
                                                <FileText size={16} className="mr-2" /> Visualizar Documento Original (PDF)
                                            </a>
                                        )}

                                        {/* AÇÃO DE PAGAMENTO OU REENVIO */}
                                        {activeTab === 'sent' && (
                                            notif.status === NotificationStatus.PENDING_PAYMENT ? (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button 
                                                        onClick={() => handlePay(notif)} 
                                                        disabled={processingId === notif.id}
                                                        className="bg-green-600 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center hover:bg-green-700 shadow-lg shadow-green-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                                                    >
                                                        {processingId === notif.id ? <Loader2 className="animate-spin mr-2"/> : <CreditCard size={16} className="mr-2" />} 
                                                        {processingId === notif.id ? 'Processando...' : `Pagar R$ ${notif.paymentAmount}`}
                                                    </button>
                                                    <button onClick={() => handleDelete(notif)} className="bg-white text-red-500 border border-red-200 py-3 rounded-xl text-sm font-bold flex items-center justify-center hover:bg-red-50 transition-all">
                                                        <Trash2 size={16} className="mr-2" /> Excluir
                                                    </button>
                                                </div>
                                            ) : (
                                                // Opção de Reenvio se já estiver pago/enviado (para garantir)
                                                <button 
                                                    onClick={() => handleRetrySend(notif)}
                                                    disabled={processingId === notif.id}
                                                    className="w-full bg-white text-blue-600 border border-blue-200 py-3 rounded-xl text-sm font-bold flex items-center justify-center hover:bg-blue-50 transition-all"
                                                >
                                                    {processingId === notif.id ? <Loader2 className="animate-spin mr-2"/> : <Zap size={16} className="mr-2" />}
                                                    Reenviar Notificação (Email/Zap)
                                                </button>
                                            )
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
    </div>
  );
};

export default Monitoring;
