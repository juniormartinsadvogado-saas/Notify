import { db, storage } from './firebase';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, addDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { FileItem } from '../types';

export interface UserData {
  uid: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
  photoUrl?: string;
  createdAt: string;
  // Campos de Assinatura adicionados ao perfil
  subscriptionActive?: boolean;
  subscriptionPlan?: string;
  creditsTotal?: number;
  creditsUsed?: number;
  nextBillingDate?: string;
}

// --- FIRESTORE PROFILE ---

export const createUserProfile = async (user: any, additionalData: { cpf: string; phone: string; photoUrl?: string }) => {
  const userData: UserData = {
      uid: user.uid,
      name: user.displayName || '',
      email: user.email || '',
      cpf: additionalData.cpf || '',
      phone: additionalData.phone || '',
      photoUrl: additionalData.photoUrl || user.photoURL || '',
      createdAt: new Date().toISOString(),
      subscriptionActive: false,
      subscriptionPlan: 'Plano Gratuito',
      creditsTotal: 0,
      creditsUsed: 0
  };
  
  try {
    await setDoc(doc(db, "users", user.uid), userData);
  } catch (e) {
    console.error("Erro ao criar perfil no Firestore:", e);
  }

  return userData;
};

export const getUserProfile = async (uid: string): Promise<UserData | null> => {
  try {
    const docRef = doc(db, "users", uid);
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
    // Se não existir perfil no Firestore (ex: login social ou erro anterior), cria um básico
    if (!profile) {
      profile = await createUserProfile(user, { cpf: '', phone: '' });
    }
    return profile;
};

export const updateUserProfile = async (uid: string, data: Partial<UserData>) => {
    try {
        const docRef = doc(db, "users", uid);
        await updateDoc(docRef, data);
    } catch (e) {
        console.error("Erro ao atualizar perfil:", e);
    }
};

export const uploadUserPhoto = async (uid: string, file: File): Promise<string> => {
    const storageRef = ref(storage, `profile_photos/${uid}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return url;
};

export const deleteFullUserAccount = async (user: any) => {
    try {
        await deleteDoc(doc(db, "users", user.uid));
        // Nota: A deleção do Auth deve ser chamada do client side (deleteUser)
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
};

// --- FILE MANAGER (AGORA NO FIREBASE) ---

const FILES_COLLECTION = 'files';

export const uploadUserFile = async (uid: string, file: File, notes: string = ''): Promise<FileItem> => {
    try {
        // 1. Upload do arquivo físico para o Storage
        const storagePath = `user_files/${uid}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, storagePath);
        
        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);

        // 2. Criação do metadado no Firestore
        const newFile: FileItem = {
            id: '', // Será preenchido após addDoc
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
            uid: uid // Vínculo com usuário
        });

        // Retorna o objeto completo com o ID gerado pelo Firestore
        return { ...newFile, id: docRef.id };

    } catch (error) {
        console.error("Erro ao fazer upload de arquivo:", error);
        throw error;
    }
};

export const getUserFiles = async (uid: string): Promise<FileItem[]> => {
    try {
        const q = query(
            collection(db, FILES_COLLECTION),
            where("uid", "==", uid)
        );
        
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
        console.error("Erro ao buscar arquivos:", error);
        return [];
    }
};

export const deleteUserFile = async (uid: string, fileId: string, storagePath: string) => {
    try {
        // 1. Deleta do Firestore
        await deleteDoc(doc(db, FILES_COLLECTION, fileId));

        // 2. Deleta do Storage
        if (storagePath && !storagePath.includes('mock')) {
             const storageRef = ref(storage, storagePath);
             await deleteObject(storageRef);
        }
        return true;
    } catch (error) {
        console.error("Erro ao deletar arquivo:", error);
        throw error;
    }
};

export const updateFileMetadata = async (uid: string, fileId: string, data: Partial<FileItem>) => {
    try {
        const docRef = doc(db, FILES_COLLECTION, fileId);
        await updateDoc(docRef, data);
        return true;
    } catch (error) {
        console.error("Erro ao atualizar metadados do arquivo:", error);
        throw error;
    }
};