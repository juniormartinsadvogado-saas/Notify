
import { db, storage } from './firebase';
import { 
  collection, doc, setDoc, deleteDoc, 
  query, where, getDocs 
} from 'firebase/firestore';
import { 
  ref, uploadBytes, getDownloadURL, deleteObject 
} from 'firebase/storage';
import { NotificationItem, EvidenceItem, NotificationStatus } from '../types';
import { getUserProfile } from './userService'; // Necessário para montar dados expostos

// Alterado para 'notificacoes' conforme especificação
const NOTIFICATIONS_COLLECTION = 'notificacoes';

// --- HELPERS ---

const getMediaType = (mimeType: string): 'fotos' | 'videos' | 'documentos' => {
    if (mimeType.startsWith('image/')) return 'fotos';
    if (mimeType.startsWith('video/')) return 'videos';
    return 'documentos';
};

// --- FASE 2: UPLOAD PDF ---

export const uploadSignedPdf = async (notificationId: string, pdfBlob: Blob): Promise<string> => {
    try {
        // Caminho Especificado: /notificacoes_pdfs/$ID_notificacao.pdf
        const storagePath = `notificacoes_pdfs/${notificationId}.pdf`;
        const storageRef = ref(storage, storagePath);

        await uploadBytes(storageRef, pdfBlob);
        const downloadUrl = await getDownloadURL(storageRef);
        return downloadUrl;
    } catch (error: any) {
        console.error("Erro crítico no upload do PDF:", error);
        throw new Error("Falha ao salvar o documento assinado. Tente novamente.");
    }
};

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
        throw new Error("Falha ao salvar arquivo de evidência.");
    }
};

export const deleteEvidence = async (storagePath: string) => {
    if (!storagePath) return;
    try {
        const storageRef = ref(storage, storagePath);
        await deleteObject(storageRef);
        return true;
    } catch (error) {
        return false;
    }
};

// --- FASE 2: SALVAR METADADOS (FIRESTORE) ---

export const saveNotification = async (notification: NotificationItem) => {
    try {
        // Recupera dados atuais do notificante para criar o snapshot de 'dados expostos'
        const notificanteProfile = await getUserProfile(notification.notificante_uid);
        
        // Garante que temos os campos obrigatórios conforme regras
        const notificationData: NotificationItem = {
            ...notification,
            notificante_dados_expostos: {
                nome: notificanteProfile?.name || notification.notificante_dados_expostos.nome,
                email: notificanteProfile?.email || notification.notificante_dados_expostos.email,
                telefone: notificanteProfile?.phone || notification.notificante_dados_expostos.telefone,
                foto_url: notificanteProfile?.photoUrl || notification.notificante_dados_expostos.foto_url
            },
            notificante_cpf: notificanteProfile?.cpf || notification.notificante_cpf,
            // Garante que o CPF do destinatário esteja no array para permitir leitura pelas regras de segurança
            notificados_cpfs: notification.notificados_cpfs
        };

        const docRef = doc(db, NOTIFICATIONS_COLLECTION, notification.id);
        const dataToSave = JSON.parse(JSON.stringify(notificationData));
        
        await setDoc(docRef, dataToSave);
    } catch (error: any) {
        console.error("Erro ao salvar notificação:", error);
        if (error.code === 'permission-denied') {
             throw new Error("Permissão negada. Verifique se você está logado.");
        }
        throw error;
    }
};

export const deleteNotification = async (notification: NotificationItem) => {
    try {
        if (notification.evidences && notification.evidences.length > 0) {
            await Promise.all(notification.evidences.map(ev => deleteEvidence(ev.storagePath)));
        }
        // Tenta apagar PDF principal
        const pdfRef = ref(storage, `notificacoes_pdfs/${notification.id}.pdf`);
        await deleteObject(pdfRef).catch(() => {});

        await deleteDoc(doc(db, NOTIFICATIONS_COLLECTION, notification.id));
    } catch (error) {
        console.error("Erro ao excluir notificação:", error);
        throw error;
    }
};

// --- LEITURA (Queries Ajustadas) ---

export const getNotificationsBySender = async (senderUid: string): Promise<NotificationItem[]> => {
    try {
        // Query pelo campo 'notificante_uid' conforme schema novo
        const q = query(
            collection(db, NOTIFICATIONS_COLLECTION),
            where("notificante_uid", "==", senderUid)
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
        const cleanCpf = cpf.replace(/\D/g, '');
        
        // Query de array-contains no campo 'notificados_cpfs'
        const q = query(
            collection(db, NOTIFICATIONS_COLLECTION),
            where("notificados_cpfs", "array-contains", cleanCpf)
        );

        const querySnapshot = await getDocs(q);
        const items: NotificationItem[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data() as NotificationItem;
            // Filtra rascunhos para o destinatário
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

// --- FASE 3: ATUALIZAÇÃO PÓS-PAGAMENTO ---
// Nota: Em produção, isso seria feito via Cloud Function (Admin SDK), 
// pois as regras de segurança bloqueiam 'update' do cliente.
// Para simulação local funcionar sem backend real, mantemos aqui, 
// mas sabendo que as regras 'allow update: if false' quebrariam isso se ativadas estritamente agora.
// Para este demo funcionar, você precisaria temporariamente permitir update nas regras OU usar o backend.
export const confirmPayment = async (notificationId: string) => {
    // ATENÇÃO: Se as regras 'allow update: if false' estiverem ativas, isso falhará no cliente.
    // Solução Mock: Chamada API Backend que usa Admin SDK.
    try {
        const docRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
        // Tenta update direto (pode falhar com regras estritas)
        await setDoc(docRef, { status: NotificationStatus.SENT }, { merge: true });
    } catch (error) {
        console.error("Erro ao confirmar pagamento (Client-Side Blocked?):", error);
        // Em um cenário real, aqui chamaríamos fetch('/api/confirm-payment')
        throw error;
    }
};
