
import React, { useState, useEffect } from 'react';
import { Transaction } from '../types';
import { Download, Clock, CheckCircle2, AlertTriangle, Zap, MessageCircle, FileText, Loader2, Copy, Send, RefreshCw, XCircle, ChevronRight, Calendar, User } from 'lucide-react';
import { initiateCheckout, checkPaymentStatus } from '../services/paymentService';
import { confirmPayment, getNotificationById } from '../services/notificationService';
import { dispatchCommunications } from '../services/communicationService';
import { jsPDF } from "jspdf";
import { db } from '../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface BillingProps {
  transactions: Transaction[];
  filterStatus?: string[];
  onRefund?: (id: string) => void;
}

const Billing: React.FC<BillingProps> = ({ transactions, filterStatus, onRefund }) => {
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
  const [historyTransactions, setHistoryTransactions] = useState<Transaction[]>([]);
  
  const [payingTransactionId, setPayingTransactionId] = useState<string | null>(null);
  
  // Estado para controle do modal e pagamento
  const [pixModalData, setPixModalData] = useState<{ encodedImage: string, payload: string, asaasId?: string, notificationId?: string } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState<string>('');
  
  // Estado de verificação manual
  const [isCheckingManual, setIsCheckingManual] = useState(false);

  useEffect(() => {
    const sorted = [...transactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (filterStatus && filterStatus.length > 0) {
        const filtered = sorted.filter(t => filterStatus.includes(t.status));
        setPendingTransactions(filtered.filter(t => t.status === 'Pendente'));
        setHistoryTransactions(filtered.filter(t => t.status !== 'Pendente'));
    } else {
        setPendingTransactions(sorted.filter(t => t.status === 'Pendente'));
        setHistoryTransactions(sorted.filter(t => t.status !== 'Pendente'));
    }
  }, [transactions, filterStatus]);

  // --- REAL-TIME LISTENER & BACKUP POLLING ---
  useEffect(() => {
      let interval: any;
      let unsubscribeSnapshot: () => void;

      if (pixModalData && pixModalData.notificationId && !isSending) {
          
          // 1. FIRESTORE LISTENER (Instantâneo)
          const docRef = doc(db, 'notificacoes', pixModalData.notificationId);
          unsubscribeSnapshot = onSnapshot(docRef, (docSnap) => {
              if (docSnap.exists()) {
                  const data = docSnap.data();
                  if (data.status === 'SENT' || data.status === 'Enviada' || data.status === 'Entregue') {
                      console.log("[BILLING] Pagamento detectado via Firestore!");
                      executeSuccessFlow();
                  }
              }
          });

          // 2. POLLING DE BACKUP
          if (pixModalData.asaasId) {
              interval = setInterval(async () => {
                  try {
                      const status = await checkPaymentStatus(pixModalData.asaasId!);
                      if (status.paid) {
                          executeSuccessFlow();
                      }
                  } catch (e) {}
              }, 2000); 
          }
      }

      return () => { 
          if (interval) clearInterval(interval);
          if (unsubscribeSnapshot) unsubscribeSnapshot();
      };
  }, [pixModalData, isSending]);

  const handleManualCheck = async () => {
      if (!pixModalData?.asaasId) return;
      setIsCheckingManual(true);
      
      let attempts = 0;
      const maxAttempts = 5;

      const attemptCheck = async (): Promise<boolean> => {
          try {
              const status = await checkPaymentStatus(pixModalData.asaasId!);
              return status.paid;
          } catch (e) { return false; }
      };

      const intervalId = setInterval(async () => {
          attempts++;
          const paid = await attemptCheck();
          
          if (paid) {
              clearInterval(intervalId);
              setIsCheckingManual(false);
              executeSuccessFlow();
          } else {
              if (attempts >= maxAttempts) {
                  clearInterval(intervalId);
                  setIsCheckingManual(false);
                  alert("Pagamento ainda não confirmado. Se acabou de pagar, aguarde alguns instantes.");
              }
          }
      }, 2000);
  };

  const executeSuccessFlow = async () => {
      if (!pixModalData?.notificationId) {
          setPixModalData(null);
          return;
      }

      // Evita execução dupla
      if (isSending) return;

      setIsSending(true); 
      setRecoveryStatus("Pagamento identificado. Finalizando envio...");

      try {
          // Garante atualização
          confirmPayment(pixModalData.notificationId).catch(console.error);

          setRecoveryStatus("Confirmando envio...");
          
          // Busca dados para tentar disparar o envio (caso webhook falhe)
          const fullNotification = await getNotificationById(pixModalData.notificationId);

          if (fullNotification) {
              dispatchCommunications(fullNotification).catch(() => {});
              
              setRecoveryStatus("Envio Concluído com Sucesso!");
              await new Promise(r => setTimeout(r, 1000));
              setPixModalData(null);
              alert(`Sucesso! A notificação foi enviada.`);
              window.location.reload(); 
          } else {
              setPixModalData(null);
          }

      } catch (error) {
          console.error("Erro no fluxo pós-pagamento:", error);
          setPixModalData(null);
      } finally {
          setIsSending(false);
          setRecoveryStatus('');
      }
  };

  const handlePayPending = async (transaction: Transaction) => {
      setPayingTransactionId(transaction.id);
      try {
          let notificationId = transaction.notificationId;
          if (!notificationId && transaction.description.includes('Ref:')) {
              const parts = transaction.description.split('Ref:');
              if (parts.length > 1) notificationId = parts[1].trim().split(' ')[0];
          }

          if (!notificationId) {
              alert("Não foi possível identificar a notificação associada.");
              return;
          }

          const fullNotification = await getNotificationById(notificationId);
          
          if (!fullNotification) {
              alert("A notificação original não existe mais.");
              return;
          }

          const customPayerInfo = {
              name: fullNotification.notificante_dados_expostos?.nome || 'Cliente Notify',
              cpfCnpj: fullNotification.notificante_cpf || '',
              email: fullNotification.notificante_dados_expostos?.email || '',
              phone: fullNotification.notificante_dados_expostos?.telefone || ''
          };

          const response = await initiateCheckout(fullNotification, 'single', 'PIX', null, customPayerInfo);
          
          if (response.success && response.pixData) {
              setPixModalData({
                  ...response.pixData,
                  asaasId: response.paymentId,
                  notificationId: notificationId
              });
          } else {
              alert("Erro ao gerar novo Pix: " + response.error);
          }
      } catch (e: any) {
          console.error(e);
          alert("Erro de conexão: " + e.message);
      } finally {
          setPayingTransactionId(null);
      }
  };

  const generateReceipt = (transaction: Transaction) => {
      const doc = new jsPDF();
      doc.text("Recibo de Pagamento - Notify", 20, 20);
      doc.text(`Valor: R$ ${transaction.amount}`, 20, 30);
      doc.save("recibo.pdf");
  };

  return (
    <div className="space-y-10 animate-fade-in pb-12">
      
      {/* --- SEÇÃO 1: PENDÊNCIAS --- */}
      {pendingTransactions.length > 0 && (
          <section>
              <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><AlertTriangle size={20}/></div>
                  <div><h2 className="text-lg font-bold text-slate-800">Ações Necessárias</h2></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingTransactions.map(t => (
                      <div key={t.id} className="bg-white rounded-xl border-l-4 border-amber-400 shadow-sm border-y border-r border-slate-200 p-5 flex flex-col justify-between">
                          <div className="mb-4">
                              <h3 className="font-bold text-slate-800 text-sm">{t.description}</h3>
                              <p className="text-xs text-slate-500 mt-1">Aguardando Pagamento</p>
                          </div>
                          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                              <span className="text-lg font-bold text-slate-800">R$ {t.amount.toFixed(2)}</span>
                              <button onClick={() => handlePayPending(t)} disabled={payingTransactionId === t.id} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center hover:bg-slate-800 transition-colors shadow-lg disabled:opacity-70">
                                  {payingTransactionId === t.id ? <Loader2 size={14} className="animate-spin mr-2"/> : <Zap size={14} className="mr-2 text-amber-300"/>} Pagar
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          </section>
      )}

      {/* --- SEÇÃO 2: HISTÓRICO --- */}
      <section>
          <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-slate-100 text-slate-600 rounded-lg"><Clock size={20}/></div>
              <div><h2 className="text-lg font-bold text-slate-800">Histórico</h2></div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase">Descrição</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase">Data</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Valor</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Recibo</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {historyTransactions.map(t => (
                          <tr key={t.id} className="hover:bg-slate-50">
                              <td className="p-4 text-sm font-bold text-slate-700">{t.description}</td>
                              <td className="p-4 text-xs text-slate-500">{new Date(t.date).toLocaleDateString()}</td>
                              <td className="p-4"><span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${t.status === 'Pago' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{t.status}</span></td>
                              <td className="p-4 text-right text-sm font-bold text-slate-700">R$ {t.amount.toFixed(2)}</td>
                              <td className="p-4 text-right">
                                  {t.status === 'Pago' && <button onClick={() => generateReceipt(t)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded"><Download size={16}/></button>}
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </section>

      {/* MODAL DE PIX */}
      {pixModalData && (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden relative">
                  <div className={`p-4 flex justify-between items-center text-white ${isSending ? 'bg-blue-600' : 'bg-slate-900'}`}>
                      <h3 className="font-bold flex items-center text-sm">{isSending ? 'Processando...' : 'Pagamento Pendente'}</h3>
                      {!isSending && <button onClick={() => setPixModalData(null)} className="text-slate-400 hover:text-white"><Zap size={18} className="rotate-45"/></button>}
                  </div>
                  <div className="p-6 flex flex-col items-center text-center">
                      {isSending ? (
                          <div className="py-8"><Loader2 size={48} className="text-blue-600 animate-spin mb-4"/><p className="text-slate-600 font-bold">{recoveryStatus}</p></div>
                      ) : (
                          <>
                              <img src={`data:image/png;base64,${pixModalData.encodedImage}`} alt="Pix QR" className="w-56 h-56 object-contain mix-blend-multiply mb-4" />
                              <div className="flex gap-2 w-full mb-4">
                                  <input type="text" readOnly value={pixModalData.payload} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[10px] text-slate-500 truncate" />
                                  <button onClick={() => {navigator.clipboard.writeText(pixModalData.payload); alert("Copiado!");}} className="bg-blue-100 text-blue-600 p-2 rounded-lg"><Copy size={16}/></button>
                              </div>
                              
                              <div className="flex items-center justify-center text-emerald-600 font-bold text-xs bg-emerald-50 px-4 py-3 rounded-full w-full animate-pulse border border-emerald-100 mb-4 shadow-sm">
                                  <RefreshCw size={14} className="animate-spin mr-2"/> Aguardando confirmação...
                              </div>

                              <button 
                                onClick={handleManualCheck} 
                                disabled={isCheckingManual}
                                className={`w-full font-bold py-3 rounded-xl shadow-sm flex items-center justify-center transition-all ${
                                    isCheckingManual 
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                                }`}
                              >
                                  {isCheckingManual ? <Loader2 size={18} className="animate-spin mr-2"/> : <CheckCircle2 size={18} className="mr-2"/>}
                                  {isCheckingManual ? 'Verificando...' : 'Já realizei o pagamento'}
                              </button>
                          </>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Billing;
