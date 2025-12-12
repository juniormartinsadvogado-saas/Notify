
import React, { useState, useEffect } from 'react';
import { Transaction, NotificationStatus } from '../types';
import { Download, ArrowUpRight, ArrowDownLeft, Clock, RefreshCcw, FolderOpen, CheckCircle, Filter, Zap, MessageCircle, CreditCard, QrCode, Loader2, Copy, Send, RefreshCw, FileText } from 'lucide-react';
import { initiateCheckout, checkPaymentStatus } from '../services/paymentService';
import { confirmPayment, getNotificationById } from '../services/notificationService';
import { dispatchCommunications } from '../services/communicationService';
import { jsPDF } from "jspdf";

interface BillingProps {
  transactions: Transaction[];
  filterStatus?: string[];
  onRefund?: (id: string) => void;
}

const Billing: React.FC<BillingProps> = ({ transactions, filterStatus, onRefund }) => {
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [payingTransactionId, setPayingTransactionId] = useState<string | null>(null);
  
  // Estado para controle do modal e pagamento
  const [pixModalData, setPixModalData] = useState<{ encodedImage: string, payload: string, asaasId?: string, notificationId?: string } | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (filterStatus && filterStatus.length > 0) {
        setFilteredTransactions(transactions.filter(t => filterStatus.includes(t.status)));
    } else {
        // Ordena por data (mais recente primeiro)
        setFilteredTransactions([...transactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }
  }, [transactions, filterStatus]);

  // --- LOOP DE VERIFICAÇÃO DE PAGAMENTO ---
  useEffect(() => {
      let interval: any;

      if (pixModalData && pixModalData.asaasId) {
          interval = setInterval(async () => {
              try {
                  // Verifica status no Asaas
                  const status = await checkPaymentStatus(pixModalData.asaasId!);
                  
                  if (status.paid) {
                      clearInterval(interval);
                      handlePaymentSuccess();
                  }
              } catch (e) {
                  console.error("Erro no polling de pagamento:", e);
              }
          }, 3000); // Checa a cada 3 segundos
      }

      return () => {
          if (interval) clearInterval(interval);
      };
  }, [pixModalData]);

  const handlePaymentSuccess = async () => {
      if (!pixModalData?.notificationId) {
          alert("Pagamento confirmado, mas ID da notificação não encontrado. Entre em contato com suporte.");
          setPixModalData(null);
          return;
      }

      setIsSending(true); // Muda UI para "Enviando..."

      try {
          // 1. Atualiza status no Banco
          await confirmPayment(pixModalData.notificationId);

          // 2. Busca dados completos da notificação para envio
          const fullNotification = await getNotificationById(pixModalData.notificationId);

          // 3. Dispara comunicações (WhatsApp e E-mail)
          if (fullNotification) {
              await dispatchCommunications(fullNotification);
              alert("Pagamento confirmado e Notificação ENVIADA com sucesso!");
          } else {
              alert("Pagamento confirmado, mas houve um erro ao recuperar os dados para envio.");
          }

      } catch (error) {
          console.error("Erro no fluxo pós-pagamento:", error);
          alert("Pagamento confirmado, mas erro ao enviar comunicações.");
      } finally {
          setIsSending(false);
          setPixModalData(null);
          // Recarrega a página ou atualiza estado (opcional, pois o app é real-time se usar onSnapshot no pai)
          // window.location.reload(); 
      }
  };

  const handlePayPending = async (transaction: Transaction) => {
      setPayingTransactionId(transaction.id);
      try {
          // Tenta usar o notificationId explícito, senão tenta extrair da descrição (fallback para legados)
          let notificationId = transaction.notificationId;
          
          if (!notificationId && transaction.description.includes('Ref:')) {
              // Formato esperado: "Notificação - Ref: NOT-123456" ou similar
              const parts = transaction.description.split('Ref:');
              if (parts.length > 1) {
                  notificationId = parts[1].trim().split(' ')[0]; // Pega o primeiro token após Ref:
              }
          }

          if (!notificationId) {
              alert("Não foi possível identificar a notificação associada a este pagamento.");
              return;
          }

          // Recria o checkout
          // Nota: Precisamos passar um objeto com ID para o initiateCheckout funcionar
          const mockNotif: any = { id: notificationId };

          const response = await initiateCheckout(mockNotif, 'single', 'PIX');
          
          if (response.success && response.pixData) {
              setPixModalData({
                  ...response.pixData,
                  asaasId: response.paymentId,
                  notificationId: notificationId
              });
          } else {
              alert("Erro ao gerar Pix: " + response.error);
          }
      } catch (e) {
          console.error(e);
          alert("Erro de conexão ao gerar pagamento.");
      } finally {
          setPayingTransactionId(null);
      }
  };

  const generateReceipt = (transaction: Transaction) => {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("Recibo de Pagamento", 105, 20, { align: "center" });
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Plataforma Notify - Inteligência Jurídica", 105, 28, { align: "center" });
      
      doc.setLineWidth(0.5);
      doc.line(20, 35, 190, 35);
      
      // Details
      doc.setFontSize(12);
      let y = 50;
      const lineHeight = 10;
      
      doc.text(`ID da Transação: ${transaction.id}`, 20, y); y += lineHeight;
      if (transaction.notificationId) {
          doc.text(`ID da Notificação: ${transaction.notificationId}`, 20, y); y += lineHeight;
      }
      doc.text(`Data: ${new Date(transaction.date).toLocaleString('pt-BR')}`, 20, y); y += lineHeight;
      
      if (transaction.recipientName) {
          doc.text(`Destinatário: ${transaction.recipientName}`, 20, y); y += lineHeight;
      }
      
      doc.text(`Descrição: ${transaction.description}`, 20, y); y += lineHeight;
      doc.text(`Status: ${transaction.status.toUpperCase()}`, 20, y); y += lineHeight;
      
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(`Valor Total: R$ ${transaction.amount.toFixed(2)}`, 20, y + 10);
      
      // Footer
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.text("Este documento é um comprovante digital gerado automaticamente.", 105, 280, { align: "center" });
      
      doc.save(`recibo_${transaction.id}.pdf`);
  };

  const renderTable = () => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase w-1/3">Detalhes da Notificação</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">Data</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Valor</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Ações</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                  <tr>
                      <td colSpan={5} className="p-12 text-center text-slate-400">
                          <div className="flex flex-col items-center">
                              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                                  <FolderOpen size={24} />
                              </div>
                              <p>Nenhum registro encontrado nesta pasta.</p>
                          </div>
                      </td>
                  </tr>
              ) : (
                  filteredTransactions.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50 group transition-colors">
                        <td className="p-4">
                            <div className="flex items-start">
                                <div className={`p-2 rounded-full mr-3 shrink-0 mt-1 ${t.status === 'Pago' ? 'bg-green-100 text-green-600' : t.status === 'Reembolsado' ? 'bg-purple-100 text-purple-600' : 'bg-amber-100 text-amber-600'}`}>
                                    {t.status === 'Pago' ? <ArrowDownLeft size={16} /> : t.status === 'Reembolsado' ? <RefreshCcw size={16} /> : <Clock size={16} />}
                                </div>
                                <div>
                                    {/* Exibe Nome do Destinatário se disponível, senão a descrição */}
                                    <p className="font-bold text-slate-800 text-sm">
                                        {t.recipientName ? `Destinatário: ${t.recipientName}` : t.description}
                                    </p>
                                    
                                    {/* Exibe Descrição se o nome estiver em cima, para contexto */}
                                    {t.recipientName && (
                                        <p className="text-xs text-slate-500 mt-0.5 mb-1 line-clamp-1">{t.description}</p>
                                    )}

                                    {/* Exibe ID da Notificação e ID da Transação */}
                                    <div className="flex flex-col gap-1 mt-1">
                                        {t.notificationId && (
                                            <span className="text-[10px] font-bold font-mono bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100 flex items-center w-fit">
                                                <FileText size={10} className="mr-1.5"/> 
                                                ID: {t.notificationId}
                                            </span>
                                        )}
                                        <span className="text-[9px] text-slate-400 font-mono">Transação: {t.id}</span>
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td className="p-4 text-slate-500 text-sm align-top pt-5">
                            {new Date(t.date).toLocaleString('pt-BR')}
                        </td>
                        <td className="p-4 align-top pt-5">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                            t.status === 'Pago' ? 'bg-green-100 text-green-700' : 
                            t.status === 'Pendente' ? 'bg-amber-100 text-amber-700' : 
                            t.status === 'Reembolsado' ? 'bg-purple-100 text-purple-700' :
                            'bg-red-100 text-red-700'
                            }`}>
                            {t.status}
                            </span>
                        </td>
                        <td className="p-4 font-bold text-slate-800 text-right text-sm align-top pt-5">
                            R$ {t.amount.toFixed(2)}
                        </td>
                        <td className="p-4 text-right flex items-center justify-end gap-2 align-top pt-4">
                            {t.status === 'Pendente' && (
                                <button 
                                    onClick={() => handlePayPending(t)}
                                    disabled={payingTransactionId === t.id}
                                    className="flex items-center text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg transition-all shadow-sm disabled:opacity-50"
                                >
                                    {payingTransactionId === t.id ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <QrCode size={14} className="mr-1.5" />}
                                    Pagar Agora
                                </button>
                            )}
                            
                            {t.status === 'Pago' && (
                                <button 
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" 
                                    title="Baixar Recibo (PDF)"
                                    onClick={() => generateReceipt(t)}
                                >
                                    <Download size={16} />
                                </button>
                            )}
                        </td>
                        </tr>
                    )
                  )
              )}
            </tbody>
          </table>
        </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Pagamentos</h2>
          <p className="text-slate-500">
             Histórico financeiro e pagamentos pendentes.
          </p>
        </div>
      </div>

      {renderTable()}

      {/* MODAL DE PIX / STATUS DE ENVIO */}
      {pixModalData && (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden relative">
                  
                  {/* HEADER DO MODAL */}
                  <div className={`p-4 flex justify-between items-center text-white ${isSending ? 'bg-blue-600' : 'bg-slate-900'}`}>
                      <h3 className="font-bold flex items-center">
                          {isSending ? (
                              <><Send size={18} className="mr-2 animate-bounce"/> Enviando...</>
                          ) : (
                              <><QrCode size={18} className="mr-2 text-emerald-400"/> Pagamento Pix</>
                          )}
                      </h3>
                      {!isSending && (
                          <button onClick={() => setPixModalData(null)} className="text-slate-400 hover:text-white"><Zap size={18} className="rotate-45"/></button>
                      )}
                  </div>

                  {/* CONTEÚDO */}
                  <div className="p-6 flex flex-col items-center text-center">
                      
                      {isSending ? (
                          <div className="py-8">
                              <div className="relative mb-6">
                                  <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full"></div>
                                  <Loader2 size={48} className="text-blue-600 animate-spin relative z-10" />
                              </div>
                              <p className="text-slate-800 font-bold mb-2">Pagamento Confirmado!</p>
                              <p className="text-slate-500 text-sm">Disparando WhatsApp e E-mail oficiais da notificação...</p>
                          </div>
                      ) : (
                          <>
                              <p className="text-sm text-slate-500 mb-4">Escaneie o QR Code ou copie o código abaixo para pagar.</p>
                              <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-inner mb-4 relative group">
                                  <img src={`data:image/png;base64,${pixModalData.encodedImage}`} alt="Pix QR" className="w-48 h-48" />
                                  
                                  {/* Scan Animation */}
                                  <div className="absolute inset-0 border-b-2 border-emerald-500 opacity-50 animate-scan pointer-events-none"></div>
                              </div>
                              
                              <div className="flex gap-2 w-full mb-4">
                                  <input type="text" readOnly value={pixModalData.payload} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-500 truncate" />
                                  <button 
                                    onClick={() => {navigator.clipboard.writeText(pixModalData.payload); alert("Copiado!");}}
                                    className="bg-blue-100 text-blue-600 p-2 rounded-lg hover:bg-blue-200 transition"
                                  >
                                      <Copy size={16}/>
                                  </button>
                              </div>

                              <div className="flex items-center justify-center text-emerald-600 text-xs animate-pulse font-bold bg-emerald-50 py-2 rounded-lg w-full">
                                  <RefreshCw size={12} className="mr-2 animate-spin"/>
                                  Aguardando confirmação automática...
                              </div>

                              <button onClick={() => setPixModalData(null)} className="mt-4 w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition">Fechar</button>
                          </>
                      )}
                  </div>
              </div>
              
              <style>{`
                @keyframes scan {
                    0% { top: 0; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
                .animate-scan {
                    animation: scan 2s linear infinite;
                }
            `}</style>
          </div>
      )}
    </div>
  );
};

export default Billing;
