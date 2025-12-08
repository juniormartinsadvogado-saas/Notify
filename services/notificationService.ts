import { NotificationItem, EvidenceItem, NotificationStatus } from '../types';

const STORAGE_KEY = 'mock_notifications';

// --- HELPERS ---
const getLocalData = (): NotificationItem[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
};

const saveLocalData = (data: NotificationItem[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

// --- MOCK STORAGE (Simulação de Upload) ---
export const uploadEvidence = async (notificationId: string, file: File): Promise<EvidenceItem> => {
    // Simula delay de rede
    await new Promise(r => setTimeout(r, 800));

    // Cria uma URL local temporária para visualização
    const objectUrl = URL.createObjectURL(file);

    return {
        id: `ev-${Date.now()}-${Math.random()}`,
        name: file.name,
        url: objectUrl,
        type: file.type.startsWith('image/') ? 'image' : 'document',
        storagePath: 'mock/path', // Caminho fictício
        createdAt: new Date().toISOString()
    };
};

export const deleteEvidence = async (storagePath: string) => {
    await new Promise(r => setTimeout(r, 300));
    return true;
};

export const uploadSignedPdf = async (notificationId: string, pdfBlob: Blob): Promise<string> => {
    await new Promise(r => setTimeout(r, 1000));
    return URL.createObjectURL(pdfBlob);
};

// --- MOCK FIRESTORE (Persistência Local) ---

export const saveNotification = async (notification: NotificationItem) => {
    await new Promise(r => setTimeout(r, 500));
    const items = getLocalData();
    const index = items.findIndex(i => i.id === notification.id);
    
    if (index >= 0) {
        items[index] = notification;
    } else {
        items.push(notification);
    }
    saveLocalData(items);
};

export const deleteNotification = async (notification: NotificationItem) => {
    await new Promise(r => setTimeout(r, 500));
    const items = getLocalData();
    const filtered = items.filter(i => i.id !== notification.id);
    saveLocalData(filtered);
};

export const getNotificationsBySender = async (senderUid: string): Promise<NotificationItem[]> => {
    await new Promise(r => setTimeout(r, 500));
    const items = getLocalData();
    // No mock, retornamos tudo ou filtramos pelo ID simulado
    return items.filter(i => i.senderUid === senderUid).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const getNotificationsByRecipientCpf = async (cpf: string): Promise<NotificationItem[]> => {
    await new Promise(r => setTimeout(r, 500));
    const items = getLocalData();
    // Filtra apenas as que não são rascunho/pendentes para o destinatário
    return items.filter(i => 
        i.recipientCpf === cpf && 
        i.status !== NotificationStatus.PENDING_PAYMENT &&
        i.status !== NotificationStatus.DRAFT
    );
};

export const confirmPayment = async (notificationId: string) => {
    await new Promise(r => setTimeout(r, 500));
    const items = getLocalData();
    const index = items.findIndex(i => i.id === notificationId);
    if (index >= 0) {
        items[index].status = NotificationStatus.SENT;
        saveLocalData(items);
    }
};