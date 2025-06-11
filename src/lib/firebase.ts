
// src/lib/firebase.ts
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getAuth, type Auth } from 'firebase/auth'; // Added
// import { getAnalytics, type Analytics } from "firebase/analytics"; // Optional: if you want to use Analytics

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAFYiFpw9DeM8K8ho5pJo_3AMcXzr0Y61g",
  authDomain: "hsa-shield.firebaseapp.com",
  projectId: "hsa-shield",
  storageBucket: "hsa-shield.firebasestorage.app",
  messagingSenderId: "758024086878",
  appId: "1:758024086878:web:16114a1de14a6fd5381bcf"
};

let app: FirebaseApp;
let db: Firestore;
let storage: FirebaseStorage;
let auth: Auth; // Added
// let analytics: Analytics; // Optional

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  // analytics = getAnalytics(app); // Optional
} else {
  app = getApps()[0]!;
}

db = getFirestore(app);
storage = getStorage(app);
auth = getAuth(app); // Added

export { app, db, storage, auth }; // Added auth
