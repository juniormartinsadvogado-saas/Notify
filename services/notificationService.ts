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
        // Caminho exato: notificacoes/{ID_da_Notificacao}/{Tipo_de_Mídia}/{Nome_do_Arquivo}
        const storagePath = `notificacoes/${notificationId}/${mediaType}/${file.name}`;
        const storageRef = ref(storage, storagePath);

        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);

        return {
            id: `ev-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            name: file.name,
            url: downloadUrl,
            type: mediaType === 'fotos' ? 'image' : mediaType === 'videos' ? 'video' : 'document',
            storagePath: storagePath,
            createdAt: new Date().toISOString()
        };
    } catch (error) {
        console.error("Erro no upload de evidência:", error);
        throw error;
    }
};

export const uploadSignedPdf = async (notificationId: string, pdfBlob: Blob): Promise<string> => {
    try {
        const fileName = `notificacao_assinada_${notificationId}.pdf`;
        // Caminho exato: notificacoes/{ID_da_Notificacao}/documentos/{Nome_do_Arquivo}
        const storagePath = `notificacoes/${notificationId}/documentos/${fileName}`;
        const storageRef = ref(storage, storagePath);

        await uploadBytes(storageRef, pdfBlob);
        const downloadUrl = await getDownloadURL(storageRef);
        return downloadUrl;
    } catch (error) {
        console.error("Erro no upload do PDF:", error);
        throw error;
    }
};

export const deleteEvidence = async (storagePath: string) => {
    if (!storagePath) return;
    try {
        const storageRef = ref(storage, storagePath);
        await deleteObject(storageRef);
        return true;
    } catch (error) {
        console.error("Erro ao deletar evidência:", error);
        // Não lança erro para não travar a UI se o arquivo já não existir
        return false;
    }
};

// --- FIRESTORE ACTIONS ---

export const saveNotification = async (notification: NotificationItem) => {
    try {
        // Salva/Atualiza o documento na coleção 'notificacoes' usando o ID da notificação
        const docRef = doc(db, NOTIFICATIONS_COLLECTION, notification.id);
        
        // Remove campos undefined para o Firestore não reclamar
        const dataToSave = JSON.parse(JSON.stringify(notification));
        
        await setDoc(docRef, dataToSave);
    } catch (error) {
        console.error("Erro ao salvar notificação:", error);
        throw error;
    }
};

export const deleteNotification = async (notification: NotificationItem) => {
    try {
        // 1. Deletar arquivos do Storage
        if (notification.evidences && notification.evidences.length > 0) {
            await Promise.all(notification.evidences.map(ev => deleteEvidence(ev.storagePath)));
        }
        
        // 2. Deletar documento do Firestore
        await deleteDoc(doc(db, NOTIFICATIONS_COLLECTION, notification.id));
    } catch (error) {
        console.error("Erro ao excluir notificação:", error);
        throw error;
    }
};

// CONSULTA PARA O CRIADOR (REMETENTE)
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
        
        // Ordenação no cliente para evitar necessidade de índice composto imediato
        return items.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
        console.error("Erro ao buscar notificações enviadas:", error);
        return [];
    }
};

// CONSULTA PARA O NOTIFICADO (DESTINATÁRIO) - CRUCIAL 3.1
export const getNotificationsByRecipientCpf = async (cpf: string): Promise<NotificationItem[]> => {
    try {
        // O CPF deve ser exato (apenas números, conforme salvo)
        const q = query(
            collection(db, NOTIFICATIONS_COLLECTION),
            where("recipientCpf", "==", cpf)
        );

        const querySnapshot = await getDocs(q);
        const items: NotificationItem[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data() as NotificationItem;
            // Filtra rascunhos e pendentes, pois o destinatário só deve ver o que foi "Enviado"
            // A menos que a regra de negócio permita ver 'Pendente'
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
        // Atualiza apenas o status
        await setDoc(docRef, { status: NotificationStatus.SENT }, { merge: true });
    } catch (error) {
        console.error("Erro ao confirmar pagamento:", error);
        throw error;
    }
};