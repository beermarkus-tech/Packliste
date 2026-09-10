import { collection, doc, addDoc, updateDoc, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase.js';

// The single, permanent item database — one document holding every catalog
// item's preset bucket assignment. Trips can be created as a copy of it, but
// it isn't a trip itself and has no packing/exclude state of its own. It
// still lives in the "templates" collection (a holdover from when there used
// to be several of these); the app now only ever expects one document there.
const templatesRef = collection(db, 'templates');

export function watchDatabase(callback) {
  return onSnapshot(templatesRef, (snap) => {
    const first = snap.docs[0];
    callback(first ? { id: first.id, ...first.data() } : null);
  });
}

export async function getDatabase() {
  const snap = await getDocs(templatesRef);
  const first = snap.docs[0];
  return first ? { id: first.id, ...first.data() } : null;
}

// Bootstraps an empty database document. Only needed the first time the app
// is used, before any database exists yet.
export async function createDatabase() {
  const ref = await addDoc(templatesRef, { name: 'Database', items: [] });
  return ref.id;
}

export async function updateDatabaseItems(id, items) {
  await updateDoc(doc(db, 'templates', id), { items });
}
