
import React, { useState } from 'react';
import { Crown, Zap, Clock, CheckCircle2, AlertTriangle, CalendarDays, Receipt, ChevronRight, XCircle, Loader2 } from 'lucide-react';
import { initiateSubscriptionUpgrade } from '../services/paymentService'; // Importa serviço

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
    onToggleSubscription: () => void; // Mantido para cancelamento local ou webhook
}

const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ subView, subscriptionData, onToggleSubscription }) => {
    
    const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);

    const handleUpgrade = async () => {
        setIsLoadingCheckout(true);
        try {
            const response = await initiateSubscriptionUpgrade();
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
                {/* ... (Cabeçalho igual ao anterior) ... */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                            <Crown className="mr-2 text-purple-600" /> Minha Assinatura
                        </h2>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Card Créditos (igual) */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                         {/* ... Conteúdo de Créditos ... */}
                         <p>Detalhes de consumo...</p>
                    </div>

                    {/* Card Plano / Upgrade */}
                    <div className={`p-6 rounded-2xl shadow-sm border relative overflow-hidden flex flex-col justify-between ${subscriptionData.active ? 'bg-slate-900 text-white border-slate-800' : 'bg-white border-slate-200'}`}>
                        <div>
                            <h3 className={`text-lg font-bold mb-1 ${subscriptionData.active ? 'text-white' : 'text-slate-800'}`}>
                                {subscriptionData.active ? subscriptionData.planName : 'Plano Gratuito'}
                            </h3>
                        </div>

                        {subscriptionData.active ? (
                            <div className="mt-6 space-y-4 relative z-10">
                                <button onClick={onToggleSubscription} className="w-full py-3 bg-red-500/10 text-red-400 font-bold rounded-lg border border-red-500/30">
                                    Cancelar Assinatura
                                </button>
                            </div>
                        ) : (
                            <div className="mt-6">
                                <p className="text-sm text-slate-500 mb-4">Atualize para o Plano Pro.</p>
                                <button 
                                    onClick={handleUpgrade}
                                    disabled={isLoadingCheckout}
                                    className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition shadow-lg flex items-center justify-center disabled:opacity-70"
                                >
                                    {isLoadingCheckout ? <Loader2 className="animate-spin mr-2"/> : <Crown size={16} className="mr-2 text-yellow-400" />}
                                    {isLoadingCheckout ? 'Carregando...' : 'Assinar Plano Pro'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }
    
    // ... (View History mantida igual)
    return <div>Histórico...</div>;
};

export default SubscriptionManager;
