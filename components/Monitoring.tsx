
import React, { useState, useEffect } from 'react';
import { NotificationItem, NotificationStatus } from '../types';
import { saveNotification } from '../services/notificationService';
import { initiateCheckout } from '../services/paymentService';
import { getUserProfile } from '../services/userService';
import { Send, Mail, FileText, User, CheckCircle2, Circle, Clock, Inbox, Loader2, Zap, Copy, QrCode, MessageCircle, Check, Eye, Shield, Lock, Phone, DownloadCloud, Hash, AlertTriangle, Package, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

interface MonitoringProps {
  notifications: NotificationItem[];
  filterStatus?: string[]; // Alterado para string[] para suportar os filtros mistos
  searchQuery?: string;
  defaultTab?: 'sent' | 'received'; 
}

const Monitoring: React.FC<MonitoringProps> = ({ notifications: propNotifications, filterStatus, searchQuery = '', defaultTab = 'sent' }) => {
  const savedUser = localStorage.getItem('mock_session_user');
  const user = savedUser ? JSON.parse(savedUser) : null;
  
  const [activeTab, setActiveTab] = useState<'sent' | 'received'>(defaultTab);
  const [filteredItems, setFilteredItems] = useState<NotificationItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const [isResending, setIsResending] = useState(false);
  const [pixData, setPixData] = useState<{ encodedImage: string, payload: string } | null>(null);

  useEffect(() => { if (defaultTab) setActiveTab(defaultTab); }, [defaultTab]);

  // CORREÇÃO CRÍTICA: Usa os dados vindos via PROP (App.tsx) como fonte da verdade.
  // Não faz mais fetch interno, evitando race conditions e pastas vazias.
  useEffect(() => {
    let result = propNotifications || [];
    
    // Filtro por Status (vindo das props do Dashboard)
    // Agora verifica se o status do item está INCLUSO na lista de filtros permitidos
    if (filterStatus && filterStatus.length > 0) {
        result = result.filter(i => {
            // Verifica correspondência exata ou parcial se necessário
            return filterStatus.includes(i.status);
        });
    }
    
    // Busca textual
    if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        result = result.filter(item => 
            item.recipientName?.toLowerCase().includes(query) ||
            item.id.toLowerCase().includes(query) ||
            item.subject?.toLowerCase().includes(query)
        );
    }
    setFilteredItems(result);
  }, [propNotifications, filterStatus, searchQuery]);

  const handleResendWithPayment = async (item: NotificationItem) => {
      if(!confirm("Deseja reenviar esta notificação? Será gerado um novo pagamento.")) return;
      setIsResending(true);
      try {
          await saveNotification({ ...item, status: NotificationStatus.PENDING_PAYMENT, createdAt: new Date().toISOString() });
          const response = await initiateCheckout(item, 'single', 'PIX');
          if (response.success && response.pixData) setPixData(response.pixData);
          else alert("Erro ao gerar cobrança: " + response.error);
      } catch (e) { console.error(e); alert("Erro ao processar."); } finally { setIsResending(false); }
  };

  const DeliveryFlow = ({ notification }: { notification: NotificationItem }) => {
      // Normalização de status para checagem visual
      const status = notification.status;
      const isDelivered = ['SENT', 'DELIVERED', 'READ', 'Enviada', 'Entregue', 'Lida'].includes(status);
      const isRead = ['READ', 'Lida', 'OPENED', 'CLICKED'].includes(status) || notification.emailStatus === 'OPENED' || notification.whatsappStatus === 'READ';
      
      return (
          <div className="w-full">
            <div className="flex items-center justify-between w-full max-w-md mt-4 relative px-2 mb-6">
                <div className="absolute top-2.5 left-0 w-full h-0.5 bg-slate-200 -z-10"></div>
                {[{ label: 'Paga', completed: true }, { label: 'Enviada', completed: true }, { label: 'Entregue', completed: isDelivered }, { label: 'Lida', completed: isRead }].map((step, idx) => (
                    <div key={idx} className="flex flex-col items-center z-10 bg-white px-1">
                        {step.completed ? <CheckCircle2 size={24} className="text-green-500 bg-white rounded-full border-2 border-green-500" /> : <Circle size={24} className="text-slate-300 bg-white rounded-full border-2 border-slate-200" />}
                        <span className={`text-[10px] mt-1 font-bold ${step.completed ? 'text-slate-800' : 'text-slate-400'}`}>{step.label}</span>
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex items-start gap-3">
                    <div className="p-2 bg-slate-100 rounded-full"><Mail size={16} className="text-slate-600"/></div>
                    <div>
                        <p className="text-xs font-bold text-slate-700">E-mail</p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[120px]" title={notification.recipientEmail}>{notification.recipientEmail}</p>
                        <div className="mt-1 text-[10px] font-bold text-blue-600">{notification.emailStatus || 'Enviado'}</div>
                    </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex items-start gap-3">
                    <div className="p-2 bg-emerald-50 rounded-full"><MessageCircle size={16} className="text-emerald-600"/></div>
                    <div>
                        <p className="text-xs font-bold text-slate-700">WhatsApp</p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[120px]">{notification.recipientPhone || '-'}</p>
                        <div className="mt-1 text-[10px] font-bold text-blue-600">{notification.whatsappStatus || 'Enviado'}</div>
                    </div>
                </div>
            </div>
          </div>
      );
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-10">
      <div className="flex justify-between items-center mb-2">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">{activeTab === 'sent' ? 'Notificações Enviadas' : 'Notificações Recebidas'}</h2>
            <p className="text-slate-500">{activeTab === 'sent' ? 'Histórico completo e status de envio.' : 'Documentos oficiais destinados ao seu CPF.'}</p>
        </div>
      </div>

      <div className="space-y-4">
        {filteredItems.length === 0 ? 
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center"><Package className="text-slate-400 mx-auto mb-4" size={24} /><h3 className="text-lg font-medium text-slate-700">Nenhuma notificação nesta pasta</h3></div> 
        : filteredItems.map((notif) => (
            <div key={notif.id} className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${expandedId === notif.id ? 'shadow-lg border-blue-200 ring-1 ring-blue-100' : 'shadow-sm border-slate-200 hover:border-blue-200'}`}>
                <div onClick={() => setExpandedId(expandedId === notif.id ? null : notif.id)} className="p-5 flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border ${['Lida', 'READ'].includes(notif.status) ? 'bg-green-100 text-green-600' : ['PENDING_PAYMENT', 'Pendente'].includes(notif.status) ? 'bg-amber-100 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                            {['Lida', 'READ'].includes(notif.status) ? <CheckCircle2 size={24} /> : ['PENDING_PAYMENT', 'Pendente'].includes(notif.status) ? <AlertTriangle size={24} /> : <Send size={20} />}
                        </div>
                        <div>
                            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                                <h4 className="font-bold text-slate-800 text-sm md:text-base group-hover:text-blue-600 transition-colors">{activeTab === 'sent' ? `Para: ${notif.recipientName}` : `De: ${notif.notificante_dados_expostos?.nome}`}</h4>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${['PENDING_PAYMENT', 'Pendente'].includes(notif.status) ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{notif.status}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="flex items-center text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200"><Hash size={10} className="mr-1"/>{notif.id}</span>
                                <p className="text-xs text-slate-500 font-medium">{notif.species}</p>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{new Date(notif.createdAt).toLocaleDateString()} às {new Date(notif.createdAt).toLocaleTimeString()}</p>
                        </div>
                    </div>
                </div>

                {expandedId === notif.id && (
                    <div className="bg-slate-50 border-t border-slate-100 p-6 animate-slide-in-down">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            
                            {/* COLUNA ESQUERDA: Rastreamento e Dados */}
                            <div>
                                {!['PENDING_PAYMENT', 'Pendente'].includes(notif.status) && (
                                    <>
                                        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Rastreamento de Entrega</h5>
                                        <div className="mb-6 p-4 bg-white rounded-xl border border-slate-100 shadow-sm"><DeliveryFlow notification={notif} /></div>
                                    </>
                                )}
                                
                                <div className="bg-white p-4 rounded-xl border border-slate-200 mt-4 shadow-sm">
                                    <h6 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center"><User size={12} className="mr-1"/> Dados do Destinatário</h6>
                                    <div className="space-y-3">
                                        <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-xs text-slate-400">Nome</span><span className="text-xs font-medium text-slate-700">{notif.recipientName}</span></div>
                                        <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-xs text-slate-400">CPF/CNPJ</span><span className="text-xs font-medium text-slate-700 font-mono">{notif.recipientDocument || 'N/A'}</span></div>
                                        <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-xs text-slate-400">WhatsApp</span><span className="text-xs font-medium text-slate-700 font-mono">{notif.recipientPhone}</span></div>
                                        <div className="flex justify-between pb-2"><span className="text-xs text-slate-400">E-mail</span><span className="text-xs font-medium text-slate-700">{notif.recipientEmail}</span></div>
                                    </div>
                                </div>

                                {/* EVIDÊNCIAS */}
                                {notif.evidences && notif.evidences.length > 0 && (
                                    <div className="mt-6">
                                        <h6 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center"><Shield size={12} className="mr-1"/> Evidências Anexadas</h6>
                                        <div className="flex gap-2 overflow-x-auto pb-2">
                                            {notif.evidences.map((ev, idx) => (
                                                <a key={idx} href={ev.url} target="_blank" rel="noopener noreferrer" className="block w-20 h-20 rounded-lg border border-slate-200 overflow-hidden relative hover:opacity-80 transition bg-white shrink-0 group shadow-sm" title={ev.name}>
                                                    {ev.type === 'image' ? (
                                                        <img src={ev.url} alt={ev.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-400 flex-col">
                                                            <FileText size={20} className="mb-1 text-slate-300 group-hover:text-slate-500 transition"/>
                                                            <span className="text-[8px] uppercase font-bold text-slate-400">DOC</span>
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center">
                                                        <ExternalLink size={12} className="text-white opacity-0 group-hover:opacity-100" />
                                                    </div>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* COLUNA DIREITA: Resumo e Ações */}
                            <div className="flex flex-col justify-between">
                                <div className="bg-white p-4 rounded-xl border border-slate-200 mb-4 h-full relative">
                                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Resumo da Notificação</h5>
                                    <p className="text-sm text-slate-600 italic line-clamp-[12] leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                                        "{notif.content?.substring(0, 600)}..."
                                    </p>
                                </div>
                                <div className="space-y-3">
                                    {notif.pdf_url && (
                                        <a href={notif.pdf_url} target="_blank" rel="noopener noreferrer" className="w-full bg-slate-900 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center hover:bg-slate-800 shadow-lg shadow-slate-300 transition-all hover:-translate-y-0.5">
                                            <DownloadCloud size={16} className="mr-2" /> Baixar Documento Oficial (PDF)
                                        </a>
                                    )}
                                    {activeTab === 'sent' && (
                                        <button onClick={() => handleResendWithPayment(notif)} disabled={isResending} className="w-full bg-white text-blue-600 border border-blue-200 py-3 rounded-xl text-sm font-bold flex items-center justify-center hover:bg-blue-50 transition-all">
                                            {isResending ? <Loader2 className="animate-spin mr-2"/> : <Zap size={16} className="mr-2" />} Reenviar com Novo Pagamento
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        ))}
      </div>
      {pixData && (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
                  <h3 className="font-bold mb-4">Pagamento Pix</h3>
                  <img src={`data:image/png;base64,${pixData.encodedImage}`} className="w-48 h-48 mx-auto mb-4" />
                  <input type="text" readOnly value={pixData.payload} className="w-full bg-slate-50 border rounded px-2 py-1 text-xs mb-4" />
                  <button onClick={() => setPixData(null)} className="w-full bg-slate-900 text-white py-2 rounded font-bold">Fechar</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default Monitoring;
