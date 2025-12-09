import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBI-WwHPWQuQ6pchhTREXGPJowlOHDpAQY",
  authDomain: "notify-jma.firebaseapp.com",
  projectId: "notify-jma",
  storageBucket: "notify-jma.firebasestorage.app",
  messagingSenderId: "1087756182176",
  appId: "1:1087756182176:web:ecb1506775d57a21635fc5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };