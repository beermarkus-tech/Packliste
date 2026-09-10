import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from './firebase.js';

// UX-level check only. The real access boundary is the Firestore security
// rules, which restrict every read/write to this same email.
export const ALLOWED_EMAIL = 'beer.markus@gmail.com';

export function isAllowedUser(user) {
  return !!user && user.email === ALLOWED_EMAIL;
}

export function signIn() {
  return signInWithPopup(auth, googleProvider);
}

export function signOutUser() {
  return signOut(auth);
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}
