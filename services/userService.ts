import { db, storage } from './firebase';
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FileItem } from '../types';

export interface UserData {
  uid: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
  photoUrl?: string;
  createdAt: string;
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
      createdAt: new Date().toISOString()
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

// --- FILE MANAGER (Mantido local por enquanto ou pode expandir para Firestore Files collection futuramente) ---
// Para simplificar a transição, manteremos a lógica de arquivos simulada ou local, 
// já que o foco do pedido foi Auth e Profile.

const FILES_STORAGE_KEY = 'mock_user_files';

export const uploadUserFile = async (uid: string, file: File, notes: string = ''): Promise<FileItem> => {
    await new Promise(r => setTimeout(r, 800));
    
    const newFile: FileItem = {
        id: `file-${Date.now()}`,
        name: file.name,
        type: file.type,
        size: file.size,
        url: URL.createObjectURL(file), // Local URL
        storagePath: 'mock/path',
        createdAt: new Date().toISOString(),
        userNotes: notes
    };

    const allFiles = JSON.parse(localStorage.getItem(FILES_STORAGE_KEY) || '[]');
    allFiles.push({ ...newFile, uid }); // Adiciona UID para filtro
    localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(allFiles));

    return newFile;
};

export const getUserFiles = async (uid: string): Promise<FileItem[]> => {
    const allFiles = JSON.parse(localStorage.getItem(FILES_STORAGE_KEY) || '[]');
    return allFiles.filter((f: any) => f.uid === uid).sort((a: any,b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const deleteUserFile = async (uid: string, fileId: string, storagePath: string) => {
   const allFiles = JSON.parse(localStorage.getItem(FILES_STORAGE_KEY) || '[]');
   const filtered = allFiles.filter((f: FileItem) => f.id !== fileId);
   localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(filtered));
   return true;
};

export const updateFileMetadata = async (uid: string, fileId: string, data: Partial<FileItem>) => {
    const allFiles = JSON.parse(localStorage.getItem(FILES_STORAGE_KEY) || '[]');
    const index = allFiles.findIndex((f: FileItem) => f.id === fileId);
    if (index >= 0) {
        allFiles[index] = { ...allFiles[index], ...data };
        localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(allFiles));
    }
    return true;
};