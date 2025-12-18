import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCWZr--hVBfs3MyOYntQIA4ZN7yQg2Oags",
  authDomain: "blog-e86ef.firebaseapp.com",
  projectId: "blog-e86ef",
  storageBucket: "blog-e86ef.firebasestorage.app",
  messagingSenderId: "738452254555",
  appId: "1:738452254555:web:daaf47e0ef5eaded35b47e",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, provider, db, storage };
