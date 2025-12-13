
import React, { useState, useEffect } from 'react';
import { Transaction } from '../types';
import { Download, Clock, CheckCircle2, AlertTriangle, Zap, MessageCircle, FileText, Loader2, Copy, Send, RefreshCw, XCircle, ChevronRight, Calendar, User } from 'lucide-react';
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
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
  const [historyTransactions, setHistoryTransactions] = useState<Transaction[]>([]);
  
  const [payingTransactionId, setPayingTransactionId] = useState<string | null>(null);
  
  // Estado para controle do modal e pagamento
  const [pixModalData, setPixModalData] = useState<{ encodedImage: string, payload: string, asaasId?: string, notificationId?: string } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState<string>('');

  useEffect(() => {
    // Separação Lógica: Pendentes vs Histórico
    const sorted = [...transactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Se houver filtro externo, respeita. Senão, divide.
    if (filterStatus && filterStatus.length > 0) {
        const filtered = sorted.filter(t => filterStatus.includes(t.status));
        setPendingTransactions(filtered.filter(t => t.status === 'Pendente'));
        setHistoryTransactions(filtered.filter(t => t.status !== 'Pendente'));
    } else {
        setPendingTransactions(sorted.filter(t => t.status === 'Pendente'));
        setHistoryTransactions(sorted.filter(t => t.status !== 'Pendente'));
    }
  }, [transactions, filterStatus]);

  // --- LOOP DE VERIFICAÇÃO DE PAGAMENTO ---
  useEffect(() => {
      let interval: any;

      if (pixModalData && pixModalData.asaasId) {
          interval = setInterval(async () => {
              try {
                  const status = await checkPaymentStatus(pixModalData.asaasId!);
                  if (status.paid) {
                      clearInterval(interval);
                      handlePaymentSuccess();
                  }
              } catch (e) {
                  console.error("Erro no polling de pagamento:", e);
              }
          }, 3000); 
      }

      return () => { if (interval) clearInterval(interval); };
  }, [pixModalData]);

  const handlePaymentSuccess = async () => {
      if (!pixModalData?.notificationId) {
          alert("Pagamento confirmado, mas ID da notificação não encontrado. Entre em contato com suporte.");
          setPixModalData(null);
          return;
      }

      setIsSending(true); 
      setRecoveryStatus("Pagamento identificado. Validando assinatura...");

      try {
          // 1. Atualiza status no Banco
          await confirmPayment(pixModalData.notificationId);

          // 2. Busca dados completos da notificação para envio
          setRecoveryStatus("Preparando documentos para envio...");
          const fullNotification = await getNotificationById(pixModalData.notificationId);

          // 3. Dispara comunicações (WhatsApp e E-mail)
          if (fullNotification) {
              setRecoveryStatus("Enviando E-mail Certificado e WhatsApp...");
              await dispatchCommunications(fullNotification);
              setRecoveryStatus("Envio Concluído com Sucesso!");
              
              await new Promise(r => setTimeout(r, 1500));
              // Fecha modal
              setPixModalData(null);
              // Recarrega página ou atualiza estado local (idealmente via callback, mas aqui forçamos update visual no reload sutil ou alert)
              alert(`Sucesso! A notificação para ${fullNotification.recipientName} foi enviada.`);
          } else {
              alert("Pagamento confirmado, mas houve um erro ao recuperar os dados para envio.");
          }

      } catch (error) {
          console.error("Erro no fluxo pós-pagamento:", error);
          alert("Pagamento confirmado, mas erro ao enviar comunicações.");
      } finally {
          setIsSending(false);
          setPixModalData(null);
          setRecoveryStatus('');
      }
  };

  const handlePayPending = async (transaction: Transaction) => {
      setPayingTransactionId(transaction.id);
      try {
          // Fallback para encontrar ID da notificação
          let notificationId = transaction.notificationId;
          if (!notificationId && transaction.description.includes('Ref:')) {
              const parts = transaction.description.split('Ref:');
              if (parts.length > 1) notificationId = parts[1].trim().split(' ')[0];
          }

          if (!notificationId) {
              alert("Não foi possível identificar a notificação associada. Entre em contato com o suporte.");
              return;
          }

          // REGRAS DE PAGAMENTO RETARDADO:
          // 1. Buscar a notificação original para garantir que temos os dados do PAGADOR corretos (Notificante ou Representante)
          // 2. Gerar novo Pix (o antigo do momento da criação pode ter expirado)
          const fullNotification = await getNotificationById(notificationId);
          
          if (!fullNotification) {
              alert("A notificação original foi excluída ou não existe mais.");
              return;
          }

          // Monta dados do pagador baseados estritamente na notificação salva
          // Isso garante que se eu fiz como Representante, o Pix sai no meu nome, e não buga.
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
      doc.setFontSize(22); doc.setFont("helvetica", "bold");
      doc.text("Recibo de Pagamento", 105, 20, { align: "center" });
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      doc.text("Plataforma Notify - Inteligência Jurídica", 105, 28, { align: "center" });
      doc.line(20, 35, 190, 35);
      
      let y = 50; const h = 10;
      doc.setFontSize(12);
      doc.text(`ID Transação: ${transaction.id}`, 20, y); y += h;
      doc.text(`Data: ${new Date(transaction.date).toLocaleString('pt-BR')}`, 20, y); y += h;
      doc.text(`Referência: ${transaction.description}`, 20, y); y += h;
      doc.text(`Status: ${transaction.status.toUpperCase()}`, 20, y); y += h;
      
      doc.setFontSize(16); doc.setFont("helvetica", "bold");
      doc.text(`Total Pago: R$ ${transaction.amount.toFixed(2)}`, 20, y + 15);
      
      doc.save(`recibo_${transaction.id}.pdf`);
  };

  return (
    <div className="space-y-10 animate-fade-in pb-12">
      
      {/* --- SEÇÃO 1: PENDÊNCIAS (Destaque Visual) --- */}
      {pendingTransactions.length > 0 && (
          <section>
              <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                      <AlertTriangle size={20}/>
                  </div>
                  <div>
                      <h2 className="text-lg font-bold text-slate-800">Ações Necessárias</h2>
                      <p className="text-xs text-slate-500">Notificações assinadas aguardando liberação.</p>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingTransactions.map(t => (
                      <div key={t.id} className="bg-white rounded-xl border-l-4 border-amber-400 shadow-sm border-y border-r border-slate-200 p-5 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all">
                          <div className="mb-4">
                              <div className="flex justify-between items-start mb-2">
                                  <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-1 rounded border border-amber-100">
                                      AGUARDANDO ENVIO
                                  </span>
                                  <span className="text-xs font-mono text-slate-400">
                                      {new Date(t.date).toLocaleDateString()}
                                  </span>
                              </div>
                              <h3 className="font-bold text-slate-800 text-sm line-clamp-1" title={t.recipientName || t.description}>
                                  {t.recipientName ? t.recipientName : t.description}
                              </h3>
                              <p className="text-xs text-slate-500 mt-1">
                                  Notificação Extrajudicial
                              </p>
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                              <span className="text-lg font-bold text-slate-800">
                                  R$ {t.amount.toFixed(2)}
                              </span>
                              <button 
                                  onClick={() => handlePayPending(t)}
                                  disabled={payingTransactionId === t.id}
                                  className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center hover:bg-slate-800 transition-colors shadow-lg disabled:opacity-70"
                              >
                                  {payingTransactionId === t.id ? <Loader2 size={14} className="animate-spin mr-2"/> : <Zap size={14} className="mr-2 text-amber-300"/>}
                                  Pagar e Enviar
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          </section>
      )}

      {/* --- SEÇÃO 2: HISTÓRICO (Tabela Compacta) --- */}
      <section>
          <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
                  <Clock size={20}/>
              </div>
              <div>
                  <h2 className="text-lg font-bold text-slate-800">Histórico Financeiro</h2>
                  <p className="text-xs text-slate-500">Registro de todas as operações realizadas.</p>
              </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase">Referência</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase hidden md:table-cell">Data</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Valor</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Opções</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {historyTransactions.length === 0 ? (
                          <tr>
                              <td colSpan={5} className="p-8 text-center text-slate-400 text-sm">
                                  Nenhum registro no histórico.
                              </td>
                          </tr>
                      ) : (
                          historyTransactions.map(t => (
                              <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="p-4">
                                      <div className="flex items-center">
                                          <div className={`p-1.5 rounded-full mr-3 ${
                                              t.status === 'Pago' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                                          }`}>
                                              {t.status === 'Pago' ? <CheckCircle2 size={14}/> : <XCircle size={14}/>}
                                          </div>
                                          <div>
                                              <p className="text-sm font-bold text-slate-700 line-clamp-1">{t.recipientName || t.description}</p>
                                              <p className="text-[10px] text-slate-400 font-mono hidden md:block">{t.id}</p>
                                          </div>
                                      </div>
                                  </td>
                                  <td className="p-4 text-xs text-slate-500 hidden md:table-cell">
                                      {new Date(t.date).toLocaleDateString()}
                                  </td>
                                  <td className="p-4">
                                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                          t.status === 'Pago' ? 'bg-green-50 text-green-700 border border-green-100' : 
                                          'bg-red-50 text-red-700 border border-red-100'
                                      }`}>
                                          {t.status}
                                      </span>
                                  </td>
                                  <td className="p-4 text-right text-sm font-bold text-slate-700">
                                      R$ {t.amount.toFixed(2)}
                                  </td>
                                  <td className="p-4 text-right">
                                      <div className="flex justify-end gap-2">
                                          {t.status === 'Pago' && (
                                              <button 
                                                  onClick={() => generateReceipt(t)}
                                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                                                  title="Baixar Recibo"
                                              >
                                                  <Download size={16}/>
                                              </button>
                                          )}
                                          <a 
                                              href={`https://wa.me/558391559429?text=Suporte%20Transacao%20${t.id}`}
                                              target="_blank" rel="noopener noreferrer"
                                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition"
                                              title="Ajuda"
                                          >
                                              <MessageCircle size={16}/>
                                          </a>
                                      </div>
                                  </td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
          </div>
      </section>

      {/* MODAL DE PIX / STATUS DE ENVIO */}
      {pixModalData && (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden relative">
                  
                  {/* HEADER DO MODAL */}
                  <div className={`p-4 flex justify-between items-center text-white ${isSending ? 'bg-blue-600' : 'bg-slate-900'}`}>
                      <h3 className="font-bold flex items-center text-sm">
                          {isSending ? (
                              <><Send size={16} className="mr-2 animate-bounce"/> Processando Envio...</>
                          ) : (
                              <><Zap size={16} className="mr-2 text-amber-400"/> Pagamento Pendente</>
                          )}
                      </h3>
                      {!isSending && (
                          <button onClick={() => setPixModalData(null)} className="text-slate-400 hover:text-white"><Zap size={18} className="rotate-45"/></button>
                      )}
                  </div>

                  {/* CONTEÚDO */}
                  <div className="p-6 flex flex-col items-center text-center">
                      
                      {isSending ? (
                          <div className="py-8 w-full">
                              <div className="relative mb-6 mx-auto w-16 h-16">
                                  <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full"></div>
                                  <Loader2 size={64} className="text-blue-600 animate-spin relative z-10" />
                              </div>
                              <p className="text-slate-800 font-bold mb-2">Confirmado!</p>
                              <p className="text-slate-500 text-xs mb-6">Não feche esta janela enquanto finalizamos.</p>
                              
                              <div className="bg-slate-50 px-3 py-3 rounded-lg border border-slate-200 w-full">
                                  <p className="text-xs text-slate-600 font-mono animate-pulse flex items-center justify-center">
                                      <RefreshCw size={12} className="mr-2 animate-spin"/>
                                      {recoveryStatus || "Iniciando..."}
                                  </p>
                              </div>
                          </div>
                      ) : (
                          <>
                              <div className="mb-4 bg-amber-50 text-amber-800 p-3 rounded-lg text-xs flex items-start text-left w-full">
                                  <AlertTriangle size={16} className="mr-2 shrink-0 mt-0.5"/>
                                  <span>Ao pagar, a notificação assinada anteriormente será <b>enviada imediatamente</b>.</span>
                              </div>

                              <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-inner mb-4 relative group">
                                  <img src={`data:image/png;base64,${pixModalData.encodedImage}`} alt="Pix QR" className="w-48 h-48 mix-blend-multiply" />
                              </div>
                              
                              <div className="flex gap-2 w-full mb-4">
                                  <input type="text" readOnly value={pixModalData.payload} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[10px] text-slate-500 truncate font-mono" />
                                  <button 
                                    onClick={() => {navigator.clipboard.writeText(pixModalData.payload); alert("Copiado!");}}
                                    className="bg-blue-100 text-blue-600 p-2 rounded-lg hover:bg-blue-200 transition"
                                  >
                                      <Copy size={16}/>
                                  </button>
                              </div>

                              <div className="flex items-center justify-center text-emerald-600 text-xs animate-pulse font-bold bg-emerald-50 py-2 rounded-lg w-full">
                                  <RefreshCw size={12} className="mr-2 animate-spin"/>
                                  Aguardando confirmação do banco...
                              </div>
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
