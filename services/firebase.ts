import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Tenta obter variáveis de ambiente de forma segura
const getEnv = (key: string) => {
  try {
    return (import.meta as any).env[key];
  } catch (e) {
    return undefined;
  }
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY') || 'mock-key',
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID')
};

let app;
let auth: any = {};
let db: any = {};
let storage: any = {};

try {
  // Só inicializa se houver config mínima válida
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== 'mock-key') {
     app = initializeApp(firebaseConfig);
     auth = getAuth(app);
     db = getFirestore(app);
     storage = getStorage(app);
  } else {
     console.warn("Firebase config missing. Running in full mock mode.");
  }
} catch (e) {
  console.warn("Error initializing Firebase, falling back to mock objects.", e);
}

export { auth, db, storage };
