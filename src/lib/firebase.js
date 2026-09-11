import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Firebase web config values are not secret (see Firebase docs) — safe to
// commit. Access control is enforced by Firestore security rules and the
// Auth provider's authorized-domains list, not by hiding this object.
const firebaseConfig = {
  apiKey: 'AIzaSyD_-mALger3hU2_hsu1lA_nEMsBD0epSOo',
  authDomain: 'exercise-tracker-26120.firebaseapp.com',
  projectId: 'exercise-tracker-26120',
  storageBucket: 'exercise-tracker-26120.firebasestorage.app',
  messagingSenderId: '372462449667',
  appId: '1:372462449667:web:deb792917e23d4f02e0a36',
};

// Packliste reuses the exercise-tracker Firebase project but keeps its own
// separate Firestore database ("packliste") rather than the project's
// default one, so the two apps' data never mixes.
const DATABASE_ID = 'packliste';

// Named explicitly (not the default app) because this project's other app —
// Packliste-Stripe — is served from the same origin (beermarkus-tech.github.io,
// just a different path) and shares this exact Firebase config. Browser
// storage (including Firebase Auth's session persistence) is scoped by
// origin, not path, so without distinct app names the two apps would collide
// and share sign-in sessions.
export const app = initializeApp(firebaseConfig, 'packliste-main');

export const db = initializeFirestore(
  app,
  {
    localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }),
  },
  DATABASE_ID
);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
