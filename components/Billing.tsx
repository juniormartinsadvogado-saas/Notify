
import React, { useState, useEffect } from 'react';
import { Transaction } from '../types';
import { Download, Clock, CheckCircle2, AlertTriangle, Zap, Loader2, Copy, RefreshCw, Hash, User, FileCheck } from 'lucide-react';
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

const Billing: React.FC<BillingProps> = ({ transactions, filterStatus }) => {
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
  const [historyTransactions, setHistoryTransactions] = useState<Transaction[]>([]);
  const [payingTransactionId, setPayingTransactionId] = useState<string | null>(null);
  const [pixModalData, setPixModalData] = useState<{ encodedImage: string, payload: string, asaasId?: string, notificationId?: string } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isCheckingManual, setIsCheckingManual] = useState(false);

  useEffect(() => {
    const sorted = [...transactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const filtered = filterStatus ? sorted.filter(t => filterStatus.includes(t.status)) : sorted;
    setPendingTransactions(filtered.filter(t => t.status === 'Pendente'));
    setHistoryTransactions(filtered.filter(t => t.status !== 'Pendente'));
  }, [transactions, filterStatus]);

  useEffect(() => {
      let interval: any;
      let unsubscribe: () => void;
      if (pixModalData && pixModalData.notificationId && !isSending) {
          unsubscribe = onSnapshot(doc(db, 'notificacoes', pixModalData.notificationId), (docSnap) => {
              if (docSnap.exists() && ['SENT', 'Enviada', 'Entregue'].includes(docSnap.data().status)) {
                  executeSuccessFlow();
              }
          });
          if (pixModalData.asaasId) {
              interval = setInterval(async () => {
                  const status = await checkPaymentStatus(pixModalData.asaasId!);
                  if (status.paid) executeSuccessFlow();
              }, 2000);
          }
      }
      return () => { clearInterval(interval); if(unsubscribe) unsubscribe(); };
  }, [pixModalData, isSending]);

  const executeSuccessFlow = async () => {
      if (!pixModalData?.notificationId || isSending) return;
      setIsSending(true);
      try {
          await confirmPayment(pixModalData.notificationId);
          const fullNotification = await getNotificationById(pixModalData.notificationId);
          if (fullNotification) await dispatchCommunications(fullNotification);
          setPixModalData(null);
          alert("Sucesso! Notificação enviada.");
          window.location.reload();
      } catch (error) { console.error(error); setPixModalData(null); } finally { setIsSending(false); }
  };

  const handlePayPending = async (transaction: Transaction) => {
      setPayingTransactionId(transaction.id);
      try {
          let notificationId = transaction.notificationId;
          if (!notificationId && transaction.description.includes('Ref:')) notificationId = transaction.description.split('Ref:')[1].trim().split(' ')[0];
          
          if (!notificationId) return alert("Notificação não encontrada.");
          const fullNotification = await getNotificationById(notificationId);
          if (!fullNotification) return alert("Notificação original não existe mais.");

          const response = await initiateCheckout(fullNotification, 'single', 'PIX', null, {
              name: fullNotification.notificante_dados_expostos?.nome || 'Cliente',
              cpfCnpj: fullNotification.notificante_cpf || '',
              email: fullNotification.notificante_dados_expostos?.email || '',
              phone: fullNotification.notificante_dados_expostos?.telefone || ''
          });
          
          if (response.success && response.pixData) {
              setPixModalData({ ...response.pixData, asaasId: response.paymentId, notificationId: notificationId });
          } else alert("Erro Pix: " + response.error);
      } catch (e: any) { alert(e.message); } finally { setPayingTransactionId(null); }
  };

  const generateReceipt = (transaction: Transaction) => {
      const doc = new jsPDF();
      doc.setFont("helvetica", "bold");
      doc.text("RECIBO DE PAGAMENTO - NOTIFY", 20, 20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Protocolo: ${transaction.id}`, 20, 30);
      doc.text(`Ref. Notificação: ${transaction.notificationId || 'N/A'}`, 20, 36);
      doc.text(`Data: ${new Date(transaction.date).toLocaleString()}`, 20, 42);
      doc.text(`Valor: R$ ${transaction.amount.toFixed(2)}`, 20, 48);
      if(transaction.recipientName) doc.text(`Destinatário: ${transaction.recipientName}`, 20, 54);
      doc.save(`recibo_${transaction.id}.pdf`);
  };

  return (
    <div className="space-y-10 animate-fade-in pb-12">
      {pendingTransactions.length > 0 && (
          <section>
              <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><AlertTriangle size={20}/></div>
                  <h2 className="text-lg font-bold text-slate-800">Pagamentos Pendentes</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingTransactions.map(t => (
                      <div key={t.id} className="bg-white rounded-xl border-l-4 border-amber-400 shadow-sm p-5 flex flex-col justify-between">
                          <div className="mb-4">
                              <div className="flex justify-between items-start mb-2">
                                  <h3 className="font-bold text-slate-800 text-sm line-clamp-1">{t.description}</h3>
                                  <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{t.notificationId || 'N/A'}</span>
                              </div>
                              {t.recipientName && <p className="text-xs text-slate-600 mb-1 flex items-center"><User size={12} className="mr-1"/> Para: {t.recipientName}</p>}
                              <p className="text-xs text-slate-500 mt-1 flex items-center"><Clock size={12} className="mr-1"/> Aguardando Pagamento</p>
                          </div>
                          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                              <span className="text-lg font-bold text-slate-800">R$ {t.amount.toFixed(2)}</span>
                              <button onClick={() => handlePayPending(t)} disabled={payingTransactionId === t.id} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center hover:bg-slate-800 transition-colors shadow-lg">
                                  {payingTransactionId === t.id ? <Loader2 size={14} className="animate-spin mr-2"/> : <Zap size={14} className="mr-2 text-amber-300"/>} Pagar
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          </section>
      )}

      <section>
          <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-slate-100 text-slate-600 rounded-lg"><FileCheck size={20}/></div>
              <h2 className="text-lg font-bold text-slate-800">Histórico de Transações</h2>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase">Protocolo</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase">Descrição / Destinatário</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase">Data</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Valor</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Ações</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {historyTransactions.map(t => (
                          <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-4"><div className="flex items-center text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded w-fit"><Hash size={10} className="mr-1"/>{t.notificationId || t.id.substring(0,8)}</div></td>
                              <td className="p-4"><p className="text-sm font-bold text-slate-700">{t.description}</p>{t.recipientName && <p className="text-xs text-slate-500 mt-0.5">Destino: {t.recipientName}</p>}</td>
                              <td className="p-4 text-xs text-slate-500">{new Date(t.date).toLocaleDateString()}</td>
                              <td className="p-4"><span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${t.status === 'Pago' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{t.status}</span></td>
                              <td className="p-4 text-right text-sm font-bold text-slate-700">R$ {t.amount.toFixed(2)}</td>
                              <td className="p-4 text-right">{t.status === 'Pago' && <button onClick={() => generateReceipt(t)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg text-xs font-bold flex items-center justify-end w-full"><Download size={14} className="mr-1"/> Recibo</button>}</td>
                          </tr>
                      ))}
                      {historyTransactions.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400 text-sm">Nenhum histórico encontrado.</td></tr>}
                  </tbody>
              </table>
          </div>
      </section>

      {pixModalData && (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
                  <div className="bg-slate-900 p-4 flex justify-between items-center text-white"><h3 className="font-bold flex items-center text-sm">{isSending ? 'Processando...' : 'Pagamento Pendente'}</h3><button onClick={() => setPixModalData(null)}><Zap size={18} className="rotate-45"/></button></div>
                  <div className="p-6 flex flex-col items-center text-center">
                      {isSending ? <div className="py-8"><Loader2 size={48} className="text-blue-600 animate-spin mb-4"/><p className="text-slate-600 font-bold">Finalizando envio...</p></div> : (
                          <>
                              <img src={`data:image/png;base64,${pixModalData.encodedImage}`} className="w-56 h-56 object-contain mix-blend-multiply mb-4" />
                              <div className="flex gap-2 w-full mb-4"><input type="text" readOnly value={pixModalData.payload} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[10px]" /><button onClick={() => {navigator.clipboard.writeText(pixModalData.payload); alert("Copiado!");}} className="bg-blue-100 text-blue-600 p-2 rounded-lg"><Copy size={16}/></button></div>
                              <div className="flex items-center justify-center text-emerald-600 font-bold text-xs bg-emerald-50 px-4 py-3 rounded-full w-full animate-pulse border border-emerald-100 mb-4 shadow-sm"><RefreshCw size={14} className="animate-spin mr-2"/> Aguardando confirmação...</div>
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
