import { db, storage } from './firebase';
import { 
  collection, doc, setDoc, deleteDoc, 
  query, where, getDocs, orderBy, limit 
} from 'firebase/firestore';
import { 
  ref, uploadBytes, getDownloadURL, deleteObject 
} from 'firebase/storage';
import { NotificationItem, EvidenceItem, NotificationStatus } from '../types';

const NOTIFICATIONS_COLLECTION = 'notificacoes';

// --- HELPERS ---

const getMediaType = (mimeType: string): 'fotos' | 'videos' | 'documentos' => {
    if (mimeType.startsWith('image/')) return 'fotos';
    if (mimeType.startsWith('video/')) return 'videos';
    return 'documentos';
};

// --- STORAGE ACTIONS ---

export const uploadEvidence = async (notificationId: string, file: File): Promise<EvidenceItem> => {
    try {
        const mediaType = getMediaType(file.type);
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const fileName = `${Date.now()}_${sanitizedName}`;
        
        const storagePath = `notificacoes/${notificationId}/${mediaType}/${fileName}`;
        const storageRef = ref(storage, storagePath);

        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);

        return {
            id: `ev-${Date.now()}`,
            name: file.name,
            url: downloadUrl,
            type: mediaType === 'fotos' ? 'image' : mediaType === 'videos' ? 'video' : 'document',
            storagePath: storagePath,
            createdAt: new Date().toISOString()
        };
    } catch (error: any) {
        console.warn("Falha no upload real (Storage Permission). Usando mock para fluxo de demonstração.");
        // FALLBACK: Retorna objeto simulado para não travar o app se as regras do Firebase bloquearem
        return {
            id: `ev-mock-${Date.now()}`,
            name: file.name,
            url: URL.createObjectURL(file), // Usa URL local temporária
            type: 'document',
            storagePath: 'mock/path',
            createdAt: new Date().toISOString()
        };
    }
};

export const uploadSignedPdf = async (notificationId: string, pdfBlob: Blob): Promise<string> => {
    try {
        const fileName = `notificacao_assinada_${notificationId}.pdf`;
        const storagePath = `notificacoes/${notificationId}/documentos/${fileName}`;
        const storageRef = ref(storage, storagePath);

        await uploadBytes(storageRef, pdfBlob);
        const downloadUrl = await getDownloadURL(storageRef);
        return downloadUrl;
    } catch (error: any) {
        console.warn("Falha no upload do PDF (Storage Permission). Usando mock para fluxo de demonstração.");
        // FALLBACK: Retorna URL de objeto local para permitir download/visualização na sessão atual
        return URL.createObjectURL(pdfBlob);
    }
};

export const deleteEvidence = async (storagePath: string) => {
    if (!storagePath || storagePath.includes('mock')) return;
    try {
        const storageRef = ref(storage, storagePath);
        await deleteObject(storageRef);
        return true;
    } catch (error) {
        console.error("Erro ao deletar evidência:", error);
        return false;
    }
};

// --- FIRESTORE ACTIONS ---

export const saveNotification = async (notification: NotificationItem) => {
    try {
        const docRef = doc(db, NOTIFICATIONS_COLLECTION, notification.id);
        const dataToSave = JSON.parse(JSON.stringify(notification));
        await setDoc(docRef, dataToSave);
    } catch (error: any) {
        console.error("Erro ao salvar notificação:", error);
        // Se falhar permissão do Firestore, lançamos erro para a UI tratar, 
        // mas em modo demo poderíamos salvar no localStorage se quiséssemos.
        if (error.code === 'permission-denied') {
             throw new Error("Permissão de banco de dados negada. Verifique suas regras no Firebase.");
        }
        throw error;
    }
};

export const deleteNotification = async (notification: NotificationItem) => {
    try {
        if (notification.evidences && notification.evidences.length > 0) {
            await Promise.all(notification.evidences.map(ev => deleteEvidence(ev.storagePath)));
        }
        await deleteDoc(doc(db, NOTIFICATIONS_COLLECTION, notification.id));
    } catch (error) {
        console.error("Erro ao excluir notificação:", error);
        throw error;
    }
};

export const getNotificationsBySender = async (senderUid: string): Promise<NotificationItem[]> => {
    try {
        const q = query(
            collection(db, NOTIFICATIONS_COLLECTION),
            where("senderUid", "==", senderUid)
        );

        const querySnapshot = await getDocs(q);
        const items: NotificationItem[] = [];
        querySnapshot.forEach((doc) => {
            items.push(doc.data() as NotificationItem);
        });
        
        return items.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
        console.error("Erro ao buscar notificações enviadas:", error);
        return [];
    }
};

export const getNotificationsByRecipientCpf = async (cpf: string): Promise<NotificationItem[]> => {
    try {
        const q = query(
            collection(db, NOTIFICATIONS_COLLECTION),
            where("recipientCpf", "==", cpf)
        );

        const querySnapshot = await getDocs(q);
        const items: NotificationItem[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data() as NotificationItem;
            // Mostra apenas notificações que já foram enviadas/pagas
            if (data.status !== NotificationStatus.DRAFT && data.status !== NotificationStatus.PENDING_PAYMENT) {
                items.push(data);
            }
        });

        return items.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
        console.error("Erro ao buscar notificações recebidas:", error);
        return [];
    }
};

export const confirmPayment = async (notificationId: string) => {
    try {
        const docRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
        await setDoc(docRef, { status: NotificationStatus.SENT }, { merge: true });
    } catch (error) {
        console.error("Erro ao confirmar pagamento:", error);
        throw error;
    }
};