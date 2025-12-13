
import { NotificationItem, Transaction } from '../types';
import { db, auth } from './firebase';
import { collection, doc, query, where, getDocs, setDoc } from 'firebase/firestore';
import { updateUserProfile, getUserProfile } from './userService';

export interface CheckoutResponse {
    success: boolean;
    checkoutUrl?: string;
    pixData?: { encodedImage: string, payload: string };
    paymentId?: string; // Adicionado ID do pagamento para rastreio
    error?: string;
}

const TRANSACTIONS_COLLECTION = 'transactions';

// --- GESTÃO DE TRANSAÇÕES (HISTÓRICO) ---

export const saveTransaction = async (userId: string, transaction: Transaction) => {
    try {
        const docRef = doc(db, TRANSACTIONS_COLLECTION, transaction.id);
        await setDoc(docRef, {
            ...transaction,
            userId: userId
        });
    } catch (error) {
        console.error("Erro ao salvar transação:", error);
    }
};

export const getUserTransactions = async (userId: string): Promise<Transaction[]> => {
    try {
        const q = query(collection(db, TRANSACTIONS_COLLECTION), where("userId", "==", userId));
        const querySnapshot = await getDocs(q);
        const transactions: Transaction[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            transactions.push({
                id: doc.id,
                description: data.description,
                amount: data.amount,
                date: data.date,
                status: data.status,
                notificationId: data.notificationId, // Recupera ID vinculado
                recipientName: data.recipientName // Recupera Destinatário
            });
        });
        return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
        console.error("Erro ao buscar transações:", error);
        return [];
    }
};

// --- GESTÃO DE ASSINATURA ---

export const updateSubscriptionStatus = async (userId: string, status: { active: boolean, planName: string, nextBillingDate?: string, creditsTotal: number }) => {
    try {
        await updateUserProfile(userId, {
            subscriptionActive: status.active,
            subscriptionPlan: status.planName,
            nextBillingDate: status.nextBillingDate,
            creditsTotal: status.creditsTotal
        });
    } catch (error) {
        console.error("Erro ao atualizar assinatura:", error);
    }
};

// --- VALIDAÇÃO MANUAL (NOVO) ---
export const checkPaymentStatus = async (paymentId: string): Promise<{ paid: boolean, status?: string }> => {
    try {
        const response = await fetch('/api/validate-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentId })
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Erro ao validar pagamento manualmente:", error);
        return { paid: false };
    }
};

// --- ASAAS CHECKOUT (VIA API SERVERLESS) ---

// Agora aceita customPayerInfo como último argumento opcional
export const initiateCheckout = async (
    notification: NotificationItem, 
    paymentPlan: 'single' | 'subscription', 
    method: 'CREDIT_CARD' | 'PIX', 
    cardData?: any,
    customPayerInfo?: { name: string, cpfCnpj: string, email?: string, phone?: string }
): Promise<CheckoutResponse> => {
    
    const user = auth.currentUser;
    if (!user) {
        return { success: false, error: "Usuário não autenticado." };
    }

    console.log(`[ASAAS] Iniciando Checkout via API (Plano: ${paymentPlan}, Método: ${method})...`);

    const mode = paymentPlan === 'subscription' ? 'subscription' : 'payment';
    
    // Preparação dos dados do pagador
    let payerInfoToSend: any = {};

    if (customPayerInfo) {
        // Se fornecido manualmente pelo frontend (Formulário), usa este com prioridade máxima
        payerInfoToSend = {
            name: customPayerInfo.name,
            cpfCnpj: customPayerInfo.cpfCnpj
        };
    } else {
        // Fallback: Busca do perfil do usuário no Firestore
        const userProfile = await getUserProfile(user.uid);
        // Tenta usar o da notificação ou do perfil
        const cpfToUse = notification.notificante_cpf || userProfile?.cpf;
        
        payerInfoToSend = {
            name: userProfile?.name || user.displayName || 'Cliente Notify',
            cpfCnpj: cpfToUse
        };
    }

    // Validação extra antes de enviar
    if (!payerInfoToSend.cpfCnpj) {
        return { success: false, error: "CPF/CNPJ do pagador não identificado." };
    }

    try {
        const response = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: mode,
                userEmail: user.email, // Email da conta sempre vai para rastreio, mas customer no Asaas pode ter outro
                billingType: method,
                cardData: cardData,
                payerInfo: payerInfoToSend,
                metadata: {
                    type: 'notification_checkout',
                    notificationId: notification.id,
                    userId: user.uid,
                    plan: paymentPlan,
                    name: payerInfoToSend.name,
                    cpfCnpj: payerInfoToSend.cpfCnpj
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Erro na criação da cobrança Asaas.");
        }

        return { 
            success: true, 
            checkoutUrl: data.url,
            paymentId: data.id, 
            pixData: data.pixData 
        };

    } catch (error: any) {
        console.error("[ASAAS] Erro na API:", error);
        return { success: false, error: error.message || "Falha ao conectar com serviço de pagamento." };
    }
};

export const initiateSubscriptionUpgrade = async (method: 'CREDIT_CARD' | 'PIX'): Promise<CheckoutResponse> => {
    const user = auth.currentUser;
    if (!user) return { success: false, error: "Usuário não autenticado." };

    const userProfile = await getUserProfile(user.uid);

    try {
        const response = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'subscription',
                userEmail: user.email,
                billingType: method,
                payerInfo: {
                    name: userProfile?.name || user.displayName,
                    cpfCnpj: userProfile?.cpf
                },
                metadata: {
                    type: 'direct_upgrade',
                    userId: user.uid,
                    name: userProfile?.name || user.displayName,
                    cpfCnpj: userProfile?.cpf
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Erro ao criar assinatura no Asaas.");
        }

        return { 
            success: true, 
            checkoutUrl: data.url,
            paymentId: data.id,
            pixData: data.pixData
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};
