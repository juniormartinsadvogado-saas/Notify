
import { db, storage, auth } from './firebase'; // Adicionado auth
import { 
  collection, doc, setDoc, deleteDoc, getDoc,
  query, where, getDocs 
} from 'firebase/firestore';
import { 
  ref, uploadBytes, getDownloadURL, deleteObject 
} from 'firebase/storage';
import { NotificationItem, EvidenceItem, NotificationStatus } from '../types';
import { getUserProfile } from './userService';

const NOTIFICATIONS_COLLECTION = 'notificacoes';

// --- HELPERS ---

const getMediaType = (mimeType: string): 'fotos' | 'videos' | 'documentos' => {
    if (mimeType.startsWith('image/')) return 'fotos';
    if (mimeType.startsWith('video/')) return 'videos';
    return 'documentos';
};

// --- FASE 2: UPLOAD PDF ---

export const uploadSignedPdf = async (notificationId: string, pdfBlob: Blob, documentHash: string): Promise<string> => {
    try {
        if (!auth.currentUser) throw new Error("Usuário não autenticado para upload.");

        // ALTERAÇÃO CRÍTICA: Nome do arquivo agora é o HASH
        const fileName = `${documentHash}.pdf`;
        const storagePath = `notificacoes/${notificationId}/${fileName}`;
        const storageRef = ref(storage, storagePath);

        // Adiciona metadados explícitos para garantir que o Storage aceite como PDF
        const metadata = {
            contentType: 'application/pdf',
            customMetadata: {
                'uid': auth.currentUser.uid,
                'notificationId': notificationId,
                'documentHash': documentHash
            }
        };

        console.log(`[STORAGE] Iniciando upload PDF para: ${storagePath}`);
        const snapshot = await uploadBytes(storageRef, pdfBlob, metadata);
        console.log('[STORAGE] Upload concluído, obtendo URL...');
        
        const downloadUrl = await getDownloadURL(snapshot.ref);
        return downloadUrl;
    } catch (error: any) {
        console.error("Erro crítico no upload do PDF:", error);
        throw new Error(`Falha no upload do documento (Storage): ${error.message}`);
    }
};

export const uploadEvidence = async (notificationId: string, file: File): Promise<EvidenceItem> => {
    try {
        if (!auth.currentUser) throw new Error("Usuário offline.");

        const mediaType = getMediaType(file.type);
        // Sanitiza nome do arquivo
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const fileName = `${Date.now()}_${sanitizedName}`;
        
        const storagePath = `notificacoes/${notificationId}/${mediaType}/${fileName}`;
        const storageRef = ref(storage, storagePath);

        console.log(`[STORAGE] Subindo evidência: ${storagePath}`);
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
    } catch (error: any) {
        console.error("Erro upload evidência:", error);
        throw new Error(`Falha ao salvar evidência ${file.name}: ${error.message}`);
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
        // GARANTIA DE SEGURANÇA: Usa o UID da sessão atual
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Sessão expirada. Faça login novamente.");

        const uid = currentUser.uid;

        // Tenta buscar perfil para preencher dados faltantes, mas não bloqueia
        let notificanteProfile = null;
        try {
            notificanteProfile = await getUserProfile(uid);
        } catch (e) {
            console.warn("Warn: Perfil não carregado no save:", e);
        }
        
        // Merge inteligente de dados
        const notificationData: NotificationItem = {
            ...notification,
            notificante_uid: uid, // Força o UID correto
            notificante_dados_expostos: {
                nome: notificanteProfile?.name || notification.notificante_dados_expostos.nome || '',
                email: notificanteProfile?.email || notification.notificante_dados_expostos.email || '',
                telefone: notificanteProfile?.phone || notification.notificante_dados_expostos.telefone || '',
                foto_url: notificanteProfile?.photoUrl || notification.notificante_dados_expostos.foto_url || ''
            },
            notificante_cpf: notificanteProfile?.cpf || notification.notificante_cpf || '',
            notificados_cpfs: notification.notificados_cpfs || []
        };

        const docRef = doc(db, NOTIFICATIONS_COLLECTION, notification.id);
        
        // Sanitização profunda para remover undefined
        const dataToSave = JSON.parse(JSON.stringify(notificationData));
        
        console.log(`[FIRESTORE] Salvando notificação ${notification.id}...`);
        await setDoc(docRef, dataToSave, { merge: true });
        console.log("[FIRESTORE] Salvo com sucesso.");
        
    } catch (error: any) {
        console.error("Erro ao salvar notificação:", error);
        if (error.code === 'permission-denied') {
             throw new Error("Permissão negada pelo banco de dados. Verifique se você está logado.");
        }
        throw new Error(error.message || "Erro ao sincronizar com o banco de dados.");
    }
};

export const deleteNotification = async (notification: NotificationItem) => {
    try {
        if (notification.evidences && notification.evidences.length > 0) {
            await Promise.all(notification.evidences.map(ev => deleteEvidence(ev.storagePath)));
        }
        // Tenta deletar PDF. Nota: Precisamos adivinhar o nome se for hash, 
        // ou confiar que notification.pdf_url ajuda a extrair o ref, mas o ideal é ter o path.
        // Aqui usamos um catch generico pois o nome mudou para hash.
        if (notification.documentHash) {
             const pdfRef = ref(storage, `notificacoes/${notification.id}/${notification.documentHash}.pdf`);
             await deleteObject(pdfRef).catch(() => {});
        } else {
             // Fallback legado
             const pdfRef = ref(storage, `notificacoes/${notification.id}/documento_assinado.pdf`);
             await deleteObject(pdfRef).catch(() => {});
        }

        await deleteDoc(doc(db, NOTIFICATIONS_COLLECTION, notification.id));
    } catch (error) {
        console.error("Erro ao excluir notificação:", error);
        throw error;
    }
};

// --- LEITURA ---

export const getNotificationById = async (notificationId: string): Promise<NotificationItem | null> => {
    try {
        const docRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as NotificationItem;
        }
        return null;
    } catch (error) {
        console.error("Erro ao buscar notificação única:", error);
        return null;
    }
};

export const getNotificationsBySender = async (senderUid: string): Promise<NotificationItem[]> => {
    try {
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
        
        const q = query(
            collection(db, NOTIFICATIONS_COLLECTION),
            where("notificados_cpfs", "array-contains", cleanCpf)
        );

        const querySnapshot = await getDocs(q);
        const items: NotificationItem[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data() as NotificationItem;
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
