
import { db, storage } from './firebase';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { FileItem } from '../types';

// Alterado de 'users' para 'usuarios' conforme especificação
const USERS_COLLECTION = 'usuarios'; 

export interface UserData {
  uid: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
  photoUrl?: string;
  createdAt: string;
  subscriptionActive?: boolean;
  subscriptionPlan?: string;
  creditsTotal?: number;
  creditsUsed?: number;
  nextBillingDate?: string;
}

// --- FASE 1: CADASTRO E DADOS ---

export const createUserProfile = async (user: any, additionalData: { cpf: string; phone: string; photoUrl?: string }) => {
  const cleanCpf = additionalData.cpf ? additionalData.cpf.replace(/\D/g, '') : '';
  const cleanPhone = additionalData.phone ? additionalData.phone.replace(/\D/g, '') : '';

  const userData: UserData = {
      uid: user.uid,
      name: user.displayName || '',
      email: user.email || '',
      cpf: cleanCpf, // CRUCIAL: CPF usado para match nas regras de segurança
      phone: cleanPhone,
      photoUrl: additionalData.photoUrl || user.photoURL || '',
      createdAt: new Date().toISOString(),
      subscriptionActive: false,
      subscriptionPlan: 'Plano Gratuito',
      creditsTotal: 0,
      creditsUsed: 0
  };
  
  try {
    await setDoc(doc(db, USERS_COLLECTION, user.uid), userData);
  } catch (e) {
    console.error("Erro ao criar perfil no Firestore:", e);
  }

  return userData;
};

export const getUserProfile = async (uid: string): Promise<UserData | null> => {
  try {
    const docRef = doc(db, USERS_COLLECTION, uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as UserData;
    } else {
      return null;
    }
  } catch (e) {
    console.error("Erro ao buscar perfil:", e);
    return null;
  }
};

export const ensureUserProfile = async (user: any): Promise<UserData | null> => {
    let profile = await getUserProfile(user.uid);
    if (!profile) {
      profile = await createUserProfile(user, { cpf: '', phone: '' });
    }
    return profile;
};

export const updateUserProfile = async (uid: string, data: Partial<UserData>) => {
    try {
        const docRef = doc(db, USERS_COLLECTION, uid);
        const cleanData = { ...data };
        if (cleanData.cpf) cleanData.cpf = cleanData.cpf.replace(/\D/g, '');
        if (cleanData.phone) cleanData.phone = cleanData.phone.replace(/\D/g, '');

        await updateDoc(docRef, cleanData);
    } catch (e) {
        console.error("Erro ao atualizar perfil:", e);
        throw e;
    }
};

export const uploadUserPhoto = async (uid: string, file: File): Promise<string> => {
    try {
        // Alterado caminho conforme especificação: /fotos_perfil/$UID.jpg
        // Nota: A extensão real do arquivo pode variar, mantendo original para integridade
        const storageRef = ref(storage, `fotos_perfil/${uid}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        return url;
    } catch(e) {
        console.error("Erro ao enviar foto de perfil:", e);
        throw e;
    }
};

export const deleteFullUserAccount = async (user: any) => {
    try {
        await deleteDoc(doc(db, USERS_COLLECTION, user.uid));
        const photoRef = ref(storage, `fotos_perfil/${user.uid}`);
        await deleteObject(photoRef).catch(() => {});
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
};

// --- FILE MANAGER (Mantido auxiliar) ---

const FILES_COLLECTION = 'files';

export const uploadUserFile = async (uid: string, file: File, notes: string = ''): Promise<FileItem> => {
    try {
        const storagePath = `user_files/${uid}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, storagePath);
        
        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);

        const newFile: FileItem = {
            id: '', 
            name: file.name,
            type: file.type,
            size: file.size,
            url: downloadUrl,
            storagePath: storagePath,
            createdAt: new Date().toISOString(),
            userNotes: notes
        };

        const docRef = await addDoc(collection(db, FILES_COLLECTION), {
            ...newFile,
            uid: uid
        });

        return { ...newFile, id: docRef.id };

    } catch (error) {
        console.error("Erro ao fazer upload de arquivo:", error);
        throw error;
    }
};

export const getUserFiles = async (uid: string): Promise<FileItem[]> => {
    try {
        const q = query(collection(db, FILES_COLLECTION), where("uid", "==", uid));
        const querySnapshot = await getDocs(q);
        const files: FileItem[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            files.push({
                id: doc.id,
                name: data.name,
                type: data.type,
                size: data.size,
                url: data.url,
                storagePath: data.storagePath,
                createdAt: data.createdAt,
                userNotes: data.userNotes,
                aiSummary: data.aiSummary
            });
        });
        return files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
        return [];
    }
};

export const deleteUserFile = async (uid: string, fileId: string, storagePath: string) => {
    try {
        await deleteDoc(doc(db, FILES_COLLECTION, fileId));
        if (storagePath) {
             const storageRef = ref(storage, storagePath);
             await deleteObject(storageRef);
        }
        return true;
    } catch (error) {
        throw error;
    }
};

export const updateFileMetadata = async (uid: string, fileId: string, data: Partial<FileItem>) => {
    try {
        const docRef = doc(db, FILES_COLLECTION, fileId);
        await updateDoc(docRef, data);
        return true;
    } catch (error) {
        throw error;
    }
};
