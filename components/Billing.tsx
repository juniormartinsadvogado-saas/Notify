
import React, { useState, useEffect } from 'react';
import { Transaction } from '../types';
import { Download, ArrowUpRight, ArrowDownLeft, Clock, RefreshCcw, FolderOpen, CheckCircle, Filter, Zap, MessageCircle, CreditCard, QrCode, Loader2, Copy } from 'lucide-react';
import { initiateCheckout } from '../services/paymentService';
import { jsPDF } from "jspdf";

interface BillingProps {
  transactions: Transaction[];
  filterStatus?: string[];
  onRefund?: (id: string) => void;
}

const Billing: React.FC<BillingProps> = ({ transactions, filterStatus, onRefund }) => {
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [payingTransactionId, setPayingTransactionId] = useState<string | null>(null);
  const [pixModalData, setPixModalData] = useState<{ encodedImage: string, payload: string } | null>(null);

  useEffect(() => {
    if (filterStatus && filterStatus.length > 0) {
        setFilteredTransactions(transactions.filter(t => filterStatus.includes(t.status)));
    } else {
        // Ordena por data (mais recente primeiro)
        setFilteredTransactions([...transactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }
  }, [transactions, filterStatus]);

  const handlePayPending = async (transaction: Transaction) => {
      setPayingTransactionId(transaction.id);
      try {
          // Mock básico para o checkout
          let notificationId = '';
          if (transaction.description.includes('Ref:')) {
              notificationId = transaction.description.split('Ref:')[1].trim();
          }
          const mockNotif: any = { id: notificationId || `REF-${transaction.id}` };

          const response = await initiateCheckout(mockNotif, 'single', 'PIX');
          
          if (response.success && response.pixData) {
              setPixModalData(response.pixData);
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
      doc.text(`Data: ${new Date(transaction.date).toLocaleString('pt-BR')}`, 20, y); y += lineHeight;
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
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">Descrição</th>
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
                            <div className="flex items-center">
                            <div className={`p-2 rounded-full mr-3 ${t.status === 'Pago' ? 'bg-green-100 text-green-600' : t.status === 'Reembolsado' ? 'bg-purple-100 text-purple-600' : 'bg-amber-100 text-amber-600'}`}>
                                {t.status === 'Pago' ? <ArrowDownLeft size={16} /> : t.status === 'Reembolsado' ? <RefreshCcw size={16} /> : <Clock size={16} />}
                            </div>
                            <div>
                                <p className="font-medium text-slate-800 text-sm">{t.description}</p>
                                <p className="text-[10px] text-slate-500 font-mono">{t.id}</p>
                            </div>
                            </div>
                        </td>
                        <td className="p-4 text-slate-500 text-sm">
                            {new Date(t.date).toLocaleString('pt-BR')}
                        </td>
                        <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                            t.status === 'Pago' ? 'bg-green-100 text-green-700' : 
                            t.status === 'Pendente' ? 'bg-amber-100 text-amber-700' : 
                            t.status === 'Reembolsado' ? 'bg-purple-100 text-purple-700' :
                            'bg-red-100 text-red-700'
                            }`}>
                            {t.status}
                            </span>
                        </td>
                        <td className="p-4 font-bold text-slate-800 text-right text-sm">
                            R$ {t.amount.toFixed(2)}
                        </td>
                        <td className="p-4 text-right flex items-center justify-end gap-2">
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

      {/* MODAL DE PIX */}
      {pixModalData && (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
                  <div className="bg-slate-900 p-4 flex justify-between items-center text-white">
                      <h3 className="font-bold flex items-center"><QrCode size={18} className="mr-2 text-emerald-400"/> Pagamento Pix</h3>
                      <button onClick={() => setPixModalData(null)} className="text-slate-400 hover:text-white"><Zap size={18} className="rotate-45"/></button>
                  </div>
                  <div className="p-6 flex flex-col items-center text-center">
                      <p className="text-sm text-slate-500 mb-4">Escaneie o QR Code ou copie o código abaixo para pagar.</p>
                      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-inner mb-4">
                          <img src={`data:image/png;base64,${pixModalData.encodedImage}`} alt="Pix QR" className="w-48 h-48" />
                      </div>
                      <div className="flex gap-2 w-full">
                          <input type="text" readOnly value={pixModalData.payload} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-500 truncate" />
                          <button 
                            onClick={() => {navigator.clipboard.writeText(pixModalData.payload); alert("Copiado!");}}
                            className="bg-blue-100 text-blue-600 p-2 rounded-lg hover:bg-blue-200 transition"
                          >
                              <Copy size={16}/>
                          </button>
                      </div>
                      <button onClick={() => setPixModalData(null)} className="mt-6 w-full py-3 bg-slate-900 text-white rounded-xl font-bold">Fechar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Billing;
