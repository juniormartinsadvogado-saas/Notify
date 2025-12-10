import React, { useState } from 'react';
import { Crown, Zap, Clock, CheckCircle2, AlertTriangle, CalendarDays, Receipt, ChevronRight, XCircle } from 'lucide-react';

interface SubscriptionManagerProps {
    subView: 'plan' | 'history';
    subscriptionData: {
        active: boolean;
        planName: string;
        creditsTotal: number;
        creditsUsed: number;
        nextBillingDate?: string;
        invoices: any[]; // Manteremos vazio se não houver dados
    };
    onToggleSubscription: () => void;
}

const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ subView, subscriptionData, onToggleSubscription }) => {
    
    // --- RENDER: PLANO E CRÉDITOS ---
    if (subView === 'plan') {
        const percentage = subscriptionData.active 
            ? Math.round((subscriptionData.creditsUsed / subscriptionData.creditsTotal) * 100) 
            : 0;

        return (
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
                
                {/* CABEÇALHO */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                            <Crown className="mr-2 text-purple-600" /> Minha Assinatura
                        </h2>
                        <p className="text-slate-500 text-sm">Gerencie seu plano, consumo de créditos e status.</p>
                    </div>
                    {subscriptionData.active && (
                        <span className="px-4 py-1.5 bg-green-100 text-green-700 text-xs font-bold rounded-full border border-green-200 uppercase tracking-wide flex items-center">
                            <CheckCircle2 size={14} className="mr-1.5" /> Assinatura Ativa
                        </span>
                    )}
                </div>

                {/* STATUS DO PLANO */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Card de Créditos */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Créditos de Envio</h3>
                                <p className="text-xs text-slate-500">Renovação Mensal</p>
                            </div>
                            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                                <Zap size={20} />
                            </div>
                        </div>

                        {subscriptionData.active ? (
                            <div className="space-y-4">
                                <div className="flex items-end gap-2">
                                    <span className="text-4xl font-bold text-slate-900">{subscriptionData.creditsTotal - subscriptionData.creditsUsed}</span>
                                    <span className="text-sm text-slate-400 font-medium mb-1.5">/ {subscriptionData.creditsTotal} restantes</span>
                                </div>
                                
                                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-1000 ease-out"
                                        style={{ width: `${100 - percentage}%` }}
                                    ></div>
                                </div>
                                
                                <p className="text-xs text-slate-400">
                                    Você utilizou <strong>{subscriptionData.creditsUsed}</strong> de <strong>{subscriptionData.creditsTotal}</strong> créditos este mês.
                                </p>
                            </div>
                        ) : (
                            <div className="text-center py-6">
                                <p className="text-slate-400 text-sm mb-4">Nenhum plano ativo no momento.</p>
                                <div className="w-full h-3 bg-slate-100 rounded-full"></div>
                            </div>
                        )}
                    </div>

                    {/* Card Detalhes do Plano */}
                    <div className={`p-6 rounded-2xl shadow-sm border relative overflow-hidden flex flex-col justify-between ${subscriptionData.active ? 'bg-slate-900 text-white border-slate-800' : 'bg-white border-slate-200'}`}>
                        {subscriptionData.active && (
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl -mr-10 -mt-10"></div>
                        )}

                        <div>
                            <h3 className={`text-lg font-bold mb-1 ${subscriptionData.active ? 'text-white' : 'text-slate-800'}`}>
                                {subscriptionData.active ? subscriptionData.planName : 'Plano Gratuito'}
                            </h3>
                            <p className={`text-xs ${subscriptionData.active ? 'text-slate-400' : 'text-slate-500'}`}>
                                {subscriptionData.active ? 'Renovação automática habilitada' : 'Pagamento por uso avulso'}
                            </p>
                        </div>

                        {subscriptionData.active ? (
                            <div className="mt-6 space-y-4 relative z-10">
                                <div className="flex items-center text-sm text-slate-300 bg-white/10 p-3 rounded-xl border border-white/5">
                                    <CalendarDays size={16} className="mr-3 text-purple-400" />
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-slate-400">Próxima Fatura</p>
                                        <p className="font-medium text-white">{subscriptionData.nextBillingDate}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={onToggleSubscription}
                                    className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-bold rounded-lg transition border border-red-500/30 flex items-center justify-center"
                                >
                                    <XCircle size={14} className="mr-2" />
                                    Cancelar Assinatura
                                </button>
                            </div>
                        ) : (
                            <div className="mt-6">
                                <p className="text-sm text-slate-500 mb-4">Atualize para o Plano Pro e tenha créditos mensais e suporte prioritário.</p>
                                <button 
                                    onClick={onToggleSubscription}
                                    className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition shadow-lg flex items-center justify-center"
                                >
                                    <Crown size={16} className="mr-2 text-yellow-400" />
                                    Assinar Plano Pro
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* BENEFÍCIOS (VISUAL APENAS) */}
                {!subscriptionData.active && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                        {['10 Envios / Mês', 'Suporte WhatsApp', 'Histórico Ilimitado'].map((ben, idx) => (
                            <div key={idx} className="flex items-center p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm font-medium text-slate-700">
                                <CheckCircle2 size={16} className="text-green-500 mr-2" />
                                {ben}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // --- RENDER: HISTÓRICO DE FATURAS ---
    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl border border-blue-200">
                    <Receipt size={24} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Histórico de Mensalidades</h2>
                    <p className="text-slate-500 text-sm">Faturas referentes apenas à assinatura mensal.</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
                {subscriptionData.invoices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[400px] text-center p-8">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                            <Clock size={32} className="text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700">Nenhum histórico disponível</h3>
                        <p className="text-slate-500 text-sm mt-1 max-w-xs">
                            Você ainda não possui faturas de assinatura geradas. Ative um plano para começar.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">Data</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">Descrição</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Valor</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {subscriptionData.invoices.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors group cursor-pointer">
                                        <td className="p-4 text-sm text-slate-600 font-mono">
                                            {new Date(inv.date).toLocaleDateString()}
                                        </td>
                                        <td className="p-4 text-sm font-medium text-slate-800">
                                            {inv.description}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                                inv.status === 'Pago' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                                {inv.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm font-bold text-slate-800 text-right">
                                            R$ {inv.amount.toFixed(2)}
                                        </td>
                                        <td className="p-4 text-right">
                                            <ChevronRight size={16} className="text-slate-300 ml-auto group-hover:text-slate-500" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SubscriptionManager;