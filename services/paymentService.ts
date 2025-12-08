import { NotificationItem } from '../types';

export interface CheckoutResponse {
    success: boolean;
    checkoutUrl?: string;
    error?: string;
}

export const initiateCheckout = async (notification: NotificationItem): Promise<CheckoutResponse> => {
    // MOCK PARA FINS DE DEMONSTRAÇÃO E RESTAURAÇÃO
    console.log("Iniciando checkout simulado para:", {
        amount: notification.paymentAmount,
        method: notification.paymentMethod
    });

    // Simula sucesso imediato para restaurar o fluxo visual
    return new Promise((resolve) => {
        setTimeout(() => {
             resolve({ success: true }); 
        }, 1500);
    });
};