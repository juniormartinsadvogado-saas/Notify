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

const USER_STORAGE_KEY = 'mock_users_profile';
const FILES_STORAGE_KEY = 'mock_user_files';

// --- MOCK PROFILE ---

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
  
  // Salva no localStorage mapeado por UID
  const allProfiles = JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || '{}');
  allProfiles[user.uid] = userData;
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(allProfiles));

  return userData;
};

export const getUserProfile = async (uid: string): Promise<UserData | null> => {
  const allProfiles = JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || '{}');
  return allProfiles[uid] || null;
};

export const ensureUserProfile = async (user: any): Promise<UserData | null> => {
    let profile = await getUserProfile(user.uid);
    if (!profile) {
      profile = await createUserProfile(user, { cpf: '', phone: '' });
    }
    return profile;
};

export const updateUserProfile = async (uid: string, data: Partial<UserData>) => {
    const allProfiles = JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || '{}');
    if (allProfiles[uid]) {
        allProfiles[uid] = { ...allProfiles[uid], ...data };
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(allProfiles));
    }
};

export const uploadUserPhoto = async (uid: string, file: File): Promise<string> => {
    await new Promise(r => setTimeout(r, 800));
    return URL.createObjectURL(file);
};

export const deleteFullUserAccount = async (user: any) => {
    const allProfiles = JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || '{}');
    delete allProfiles[user.uid];
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(allProfiles));
    return true;
};

// --- MOCK FILE MANAGER ---

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