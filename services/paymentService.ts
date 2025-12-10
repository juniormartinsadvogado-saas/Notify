
import { NotificationItem, Transaction } from '../types';
import { db, auth } from './firebase';
import { collection, addDoc, onSnapshot, doc, query, where, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { updateUserProfile } from './userService';

export interface CheckoutResponse {
    success: boolean;
    checkoutUrl?: string;
    error?: string;
}

const TRANSACTIONS_COLLECTION = 'transactions';

// --- CONFIGURAÇÃO DOS PREÇOS DO STRIPE ---
const STRIPE_PRICES = {
    SINGLE: "price_SEU_ID_AVULSO",       
    SUBSCRIPTION: "price_SEU_ID_ASSINATURA" 
};

// --- GESTÃO DE TRANSAÇÕES (HISTÓRICO) ---

export const saveTransaction = async (userId: string, transaction: Transaction) => {
    try {
        // Salva na coleção top-level 'transactions' com userId para consulta
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
                status: data.status
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

// --- STRIPE CHECKOUT ---

export const initiateCheckout = async (notification: NotificationItem, paymentPlan: 'single' | 'subscription'): Promise<CheckoutResponse> => {
    const user = auth.currentUser;
    if (!user) {
        return { success: false, error: "Usuário não autenticado." };
    }

    console.log(`[STRIPE] Iniciando Checkout (Plano: ${paymentPlan})...`);

    const selectedPriceId = paymentPlan === 'subscription' ? STRIPE_PRICES.SUBSCRIPTION : STRIPE_PRICES.SINGLE;
    const mode = paymentPlan === 'subscription' ? 'subscription' : 'payment';

    try {
        const sessionsRef = collection(db, 'customers', user.uid, 'checkout_sessions');
        
        const docRef = await addDoc(sessionsRef, {
            price: selectedPriceId,
            mode: mode,
            success_url: `${window.location.origin}`, 
            cancel_url: `${window.location.origin}`,
            metadata: {
                type: 'notification_checkout',
                notificationId: notification.id,
                userId: user.uid,
                plan: paymentPlan
            }
        });

        return new Promise<CheckoutResponse>((resolve, reject) => {
            const unsubscribe = onSnapshot(doc(db, 'customers', user.uid, 'checkout_sessions', docRef.id), (snap) => {
                const data = snap.data();
                if (data) {
                    if (data.error) {
                        unsubscribe();
                        console.error("[STRIPE] Erro:", data.error.message);
                        resolve({ success: false, error: data.error.message });
                    }
                    if (data.url) {
                        unsubscribe();
                        resolve({ success: true, checkoutUrl: data.url });
                    }
                }
            });

            setTimeout(() => {
                unsubscribe();
                resolve({ 
                    success: false, 
                    error: "Tempo limite excedido. Verifique a configuração do Stripe no Firebase." 
                });
            }, 20000);
        });

    } catch (error: any) {
        console.error("[STRIPE] Erro crítico:", error);
        return { success: false, error: "Falha ao conectar com serviço de pagamento." };
    }
};

export const initiateSubscriptionUpgrade = async (): Promise<CheckoutResponse> => {
    const user = auth.currentUser;
    if (!user) return { success: false, error: "Usuário não autenticado." };

    try {
        const sessionsRef = collection(db, 'customers', user.uid, 'checkout_sessions');
        
        const docRef = await addDoc(sessionsRef, {
            price: STRIPE_PRICES.SUBSCRIPTION,
            mode: 'subscription',
            success_url: window.location.origin,
            cancel_url: window.location.origin,
            metadata: {
                type: 'direct_upgrade',
                userId: user.uid
            }
        });

        return new Promise<CheckoutResponse>((resolve) => {
            const unsubscribe = onSnapshot(doc(db, 'customers', user.uid, 'checkout_sessions', docRef.id), (snap) => {
                const data = snap.data();
                if (data) {
                    if (data.error) {
                        unsubscribe();
                        resolve({ success: false, error: data.error.message });
                    }
                    if (data.url) {
                        unsubscribe();
                        resolve({ success: true, checkoutUrl: data.url });
                    }
                }
            });
            setTimeout(() => { unsubscribe(); resolve({ success: false, error: "Timeout." }); }, 20000);
        });
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};