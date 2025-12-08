import React, { useState, useEffect } from 'react';
import { Transaction } from '../types';
import { CreditCard, Download, ArrowUpRight, ArrowDownLeft, Clock, RefreshCcw, FolderOpen, CheckCircle, AlertCircle, Filter, Zap } from 'lucide-react';

interface BillingProps {
  transactions: Transaction[];
  filterStatus?: string[];
  onRefund?: (id: string) => void;
}

const Billing: React.FC<BillingProps> = ({ transactions, filterStatus, onRefund }) => {
  
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    if (filterStatus && filterStatus.length > 0) {
        setFilteredTransactions(transactions.filter(t => filterStatus.includes(t.status)));
    } else {
        setFilteredTransactions(transactions);
    }
  }, [transactions, filterStatus]);

  // Função auxiliar para verificar se está dentro das 24h
  const isRefundable = (dateString: string) => {
      try {
          const paymentDate = new Date(dateString);
          const now = new Date();
          const diffInMs = now.getTime() - paymentDate.getTime();
          const diffInHours = diffInMs / (1000 * 60 * 60);
          return diffInHours <= 24;
      } catch (e) {
          return false;
      }
  };

  const generateReceiptPDF = (transaction: Transaction) => {
      // Simulação simples de geração de PDF usando janela de impressão
      const receiptWindow = window.open('', '_blank');
      if (receiptWindow) {
          receiptWindow.document.write(`
              <html>
              <head>
                  <title>Recibo - ${transaction.id}</title>
                  <style>
                      body { font-family: sans-serif; padding: 40px; }
                      .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                      .content { margin-bottom: 30px; }
                      .row { display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
                      .total { font-size: 20px; font-weight: bold; text-align: right; margin-top: 20px; }
                      .footer { font-size: 12px; color: #666; text-align: center; margin-top: 50px; }
                  </style>
              </head>
              <body>
                  <div class="header">
                      <h1>RECIBO DE PAGAMENTO</h1>
                      <p>Notify Serviços Jurídicos</p>
                  </div>
                  <div class="content">
                      <div class="row"><strong>ID Transação:</strong> <span>${transaction.id}</span></div>
                      <div class="row"><strong>Data:</strong> <span>${new Date(transaction.date).toLocaleDateString()} ${new Date(transaction.date).toLocaleTimeString()}</span></div>
                      <div class="row"><strong>Descrição:</strong> <span>${transaction.description}</span></div>
                      <div class="row"><strong>Status:</strong> <span>${transaction.status}</span></div>
                  </div>
                  <div class="total">
                      VALOR TOTAL: R$ ${transaction.amount.toFixed(2)}
                  </div>
                  <div class="footer">
                      Este é um documento digital gerado eletronicamente.
                  </div>
              </body>
              </html>
          `);
          receiptWindow.document.close();
          receiptWindow.print();
      }
  };

  const handleSubscription = () => {
      if(confirm('Deseja assinar o Plano Mensal Pro?\n\n- 10 Notificações/mês\n- Prioridade no suporte\n\nValor: R$ 259,97 / mês')) {
          alert('Redirecionando para checkout seguro...');
          // Mock de sucesso
          alert('Assinatura realizada com sucesso! (Simulação)');
      }
  };

  // Helper para configuração visual baseada no filtro
  const getFilterConfig = () => {
      if (!filterStatus) return null;
      const status = filterStatus[0];
      switch(status) {
          case 'Pago': return {
              title: 'Pagamentos Confirmados',
              desc: 'Histórico de transações quitadas com sucesso.',
              icon: CheckCircle,
              colorClass: 'bg-green-100 text-green-600',
              borderClass: 'border-green-200'
          };
          case 'Pendente': return {
              title: 'Pagamentos Pendentes',
              desc: 'Transações aguardando processamento ou pagamento.',
              icon: Clock,
              colorClass: 'bg-amber-100 text-amber-600',
              borderClass: 'border-amber-200'
          };
          case 'Reembolsado': return {
              title: 'Reembolsos',
              desc: 'Valores estornados para o cliente.',
              icon: RefreshCcw,
              colorClass: 'bg-purple-100 text-purple-600',
              borderClass: 'border-purple-200'
          };
          default: return {
              title: 'Transações Filtradas',
              desc: 'Lista personalizada.',
              icon: Filter,
              colorClass: 'bg-slate-100 text-slate-600',
              borderClass: 'border-slate-200'
          };
      }
  };

  const filterConfig = getFilterConfig();

  // --- RENDERIZAÇÃO DA TABELA (Reutilizável) ---
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
                  filteredTransactions.map((t) => {
                    const canRefund = isRefundable(t.date);
                    
                    return (
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
                            {t.status === 'Pago' && (
                                <button 
                                    onClick={() => generateReceiptPDF(t)}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" 
                                    title="Baixar Recibo (PDF)"
                                >
                                    <Download size={16} />
                                </button>
                            )}
                            
                            {/* Botão de Reembolso apenas para PAGOS */}
                            {t.status === 'Pago' && onRefund && (
                                canRefund ? (
                                    <button 
                                        onClick={() => {
                                            if(window.confirm("ATENÇÃO: Solicitar reembolso cancelará a notificação e a conciliação associadas a este pagamento. Deseja continuar?")) {
                                                onRefund(t.id);
                                            }
                                        }}
                                        className="text-xs font-bold text-red-500 hover:text-red-700 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        Reembolsar
                                    </button>
                                ) : (
                                    <span className="text-[10px] text-slate-300 font-medium opacity-0 group-hover:opacity-100 transition-opacity cursor-not-allowed select-none">
                                        Prazo Expirado
                                    </span>
                                )
                            )}
                        </td>
                        </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
    </div>
  );

  // --- VISUALIZAÇÃO DE SUBPASTA (FILTRADA) ---
  if (filterConfig) {
      const folderTotal = filteredTransactions.reduce((acc, curr) => acc + curr.amount, 0);

      return (
          <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${filterConfig.colorClass} border ${filterConfig.borderClass} shadow-sm`}>
                        <filterConfig.icon size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">{filterConfig.title}</h2>
                        <p className="text-slate-500 text-sm">{filterConfig.desc}</p>
                    </div>
                </div>
                
                {/* Resumo da Pasta */}
                <div className="bg-white px-6 py-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-xs font-bold text-slate-400 uppercase">Total nesta pasta</p>
                        <p className="text-xl font-bold text-slate-800">R$ {folderTotal.toFixed(2)}</p>
                    </div>
                </div>
              </div>

              {renderTable()}
          </div>
      );
  }

  // --- VISUALIZAÇÃO PADRÃO (DASHBOARD FINANCEIRO) ---
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Pagamentos e Serviços</h2>
          <p className="text-slate-500">
             Gerencie faturas e histórico de pagamentos.
          </p>
        </div>
        <button 
            onClick={handleSubscription}
            className="mt-4 md:mt-0 bg-gradient-to-r from-slate-900 to-slate-800 text-white px-5 py-2.5 rounded-lg flex items-center hover:shadow-lg hover:scale-105 transition-all shadow-sm font-bold text-sm"
        >
          <Zap className="mr-2 text-yellow-400" size={16} />
          Assinatura Mensal (R$ 259,97)
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-xl shadow-lg text-white">
          <p className="text-slate-400 text-sm mb-1 font-medium">Envios Restantes</p>
          <h3 className="text-3xl font-bold">10 / 10</h3>
          <div className="mt-4 flex items-center text-xs text-slate-400">
            <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded mr-2 flex items-center">
              Plano Pro
            </span>
            Renova em 01/Nov
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-slate-500 text-sm mb-1 font-medium">Confirmados (Geral)</p>
          <h3 className="text-3xl font-bold text-slate-800">R$ {transactions.filter(t => t.status === 'Pago').reduce((acc, curr) => acc + curr.amount, 0).toFixed(2)}</h3>
          <p className="text-xs text-slate-400 mt-2">Total pago confirmado</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-slate-500 text-sm mb-1 font-medium">Pendentes / Falhas</p>
          <h3 className="text-3xl font-bold text-amber-600">R$ {transactions.filter(t => t.status === 'Pendente').reduce((acc, curr) => acc + curr.amount, 0).toFixed(2)}</h3>
          <p className="text-xs text-slate-400 mt-2">Aguardando processamento</p>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-lg">Histórico Recente</h3>
      </div>
      
      {renderTable()}
    </div>
  );
};

export default Billing;