
import React, { useState } from 'react';
import { Crown, Zap, CheckCircle2, QrCode, CreditCard, Loader2, ArrowLeft } from 'lucide-react';
import { initiateSubscriptionUpgrade } from '../services/paymentService';

interface SubscriptionManagerProps {
    subView: 'plan' | 'history';
    subscriptionData: {
        active: boolean;
        planName: string;
        creditsTotal: number;
        creditsUsed: number;
        nextBillingDate?: string;
        invoices: any[];
    };
    onToggleSubscription: () => void;
}

const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ subView, subscriptionData, onToggleSubscription }) => {
    
    const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);
    const [selectionStep, setSelectionStep] = useState<'info' | 'method'>('info');

    const handleUpgrade = async (method: 'CREDIT_CARD' | 'PIX') => {
        setIsLoadingCheckout(true);
        try {
            const response = await initiateSubscriptionUpgrade(method);
            if (response.success && response.checkoutUrl) {
                window.location.assign(response.checkoutUrl);
            } else {
                alert("Erro ao iniciar assinatura: " + response.error);
            }
        } catch (e) {
            console.error(e);
            alert("Erro de conexão.");
        } finally {
            setIsLoadingCheckout(false);
        }
    };

    if (subView === 'plan') {
        const percentage = subscriptionData.active 
            ? Math.round((subscriptionData.creditsUsed / subscriptionData.creditsTotal) * 100) 
            : 0;

        return (
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                            <Crown className="mr-2 text-purple-600" /> Minha Assinatura
                        </h2>
                        <p className="text-slate-500 text-sm">Gerencie seu plano e consumo.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Card de Créditos */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
                         <div>
                             <h3 className="font-bold text-slate-700 mb-4 flex items-center"><Zap size={18} className="mr-2 text-blue-500"/> Consumo Mensal</h3>
                             <div className="relative pt-1">
                                 <div className="flex mb-2 items-center justify-between">
                                     <div>
                                         <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">
                                             Notificações
                                         </span>
                                     </div>
                                     <div className="text-right">
                                         <span className="text-xs font-semibold inline-block text-blue-600">
                                             {subscriptionData.creditsUsed} / {subscriptionData.creditsTotal}
                                         </span>
                                     </div>
                                 </div>
                                 <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
                                     <div style={{ width: `${percentage}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-500"></div>
                                 </div>
                             </div>
                             <p className="text-xs text-slate-400 mt-2">
                                 {subscriptionData.active 
                                    ? `Sua renovação ocorre em ${subscriptionData.nextBillingDate}` 
                                    : 'Faça upgrade para ter 10 envios/mês.'}
                             </p>
                         </div>
                    </div>

                    {/* Card de Plano / Upgrade */}
                    <div className={`p-6 rounded-2xl shadow-sm border relative overflow-hidden flex flex-col justify-between ${subscriptionData.active ? 'bg-slate-900 text-white border-slate-800' : 'bg-white border-slate-200'}`}>
                        <div>
                            <h3 className={`text-lg font-bold mb-1 ${subscriptionData.active ? 'text-white' : 'text-slate-800'}`}>
                                {subscriptionData.active ? subscriptionData.planName : 'Plano Gratuito'}
                            </h3>
                            <p className={`text-sm ${subscriptionData.active ? 'text-slate-400' : 'text-slate-500'}`}>
                                {subscriptionData.active ? 'Assinatura ativa e recorrente.' : 'Funcionalidades limitadas.'}
                            </p>
                        </div>

                        {subscriptionData.active ? (
                            <div className="mt-6 space-y-4 relative z-10">
                                <div className="flex items-center text-sm text-green-400 font-medium">
                                    <CheckCircle2 size={16} className="mr-2" /> Status Ativo
                                </div>
                                <button onClick={onToggleSubscription} className="w-full py-3 bg-red-500/10 text-red-400 font-bold rounded-lg border border-red-500/30 hover:bg-red-500/20 transition">
                                    Cancelar Assinatura
                                </button>
                            </div>
                        ) : (
                            <div className="mt-6 relative z-10">
                                {selectionStep === 'info' ? (
                                    <>
                                        <ul className="space-y-2 mb-6">
                                            <li className="flex items-center text-sm text-slate-600"><CheckCircle2 size={14} className="text-green-500 mr-2"/> 10 Notificações / Mês</li>
                                            <li className="flex items-center text-sm text-slate-600"><CheckCircle2 size={14} className="text-green-500 mr-2"/> Conciliações Ilimitadas</li>
                                            <li className="flex items-center text-sm text-slate-600"><CheckCircle2 size={14} className="text-green-500 mr-2"/> Suporte Prioritário</li>
                                        </ul>
                                        <button 
                                            onClick={() => setSelectionStep('method')}
                                            className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition shadow-lg flex items-center justify-center group"
                                        >
                                            <Crown size={16} className="mr-2 text-yellow-400 group-hover:scale-110 transition-transform" />
                                            Assinar por R$ 259,97/mês
                                        </button>
                                    </>
                                ) : (
                                    <div className="animate-fade-in">
                                        <button onClick={() => setSelectionStep('info')} className="text-xs text-slate-400 hover:text-slate-600 mb-4 flex items-center">
                                            <ArrowLeft size={12} className="mr-1" /> Voltar
                                        </button>
                                        <p className="text-sm font-bold text-slate-800 mb-3">Escolha a forma de pagamento:</p>
                                        
                                        <div className="grid grid-cols-2 gap-3">
                                            <button 
                                                onClick={() => handleUpgrade('CREDIT_CARD')}
                                                disabled={isLoadingCheckout}
                                                className="flex flex-col items-center justify-center p-3 border-2 border-slate-100 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all group disabled:opacity-50"
                                            >
                                                <CreditCard size={24} className="text-slate-400 group-hover:text-purple-600 mb-2"/>
                                                <span className="text-xs font-bold text-slate-600 group-hover:text-purple-700">Cartão</span>
                                            </button>

                                            <button 
                                                onClick={() => handleUpgrade('PIX')}
                                                disabled={isLoadingCheckout}
                                                className="flex flex-col items-center justify-center p-3 border-2 border-slate-100 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group disabled:opacity-50"
                                            >
                                                <QrCode size={24} className="text-slate-400 group-hover:text-emerald-600 mb-2"/>
                                                <span className="text-xs font-bold text-slate-600 group-hover:text-emerald-700">Pix</span>
                                            </button>
                                        </div>
                                        {isLoadingCheckout && (
                                            <div className="text-center mt-3 text-xs text-slate-400 flex items-center justify-center">
                                                <Loader2 size={12} className="animate-spin mr-1"/> Processando...
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }
    
    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
             <h2 className="text-2xl font-bold text-slate-800">Histórico de Faturas</h2>
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-500">
                 <p>Nenhuma fatura encontrada no período recente.</p>
             </div>
        </div>
    );
};

export default SubscriptionManager;
