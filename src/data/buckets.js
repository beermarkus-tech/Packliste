import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase.js';

const bucketsRef = collection(db, 'buckets');
const bucketsQuery = query(bucketsRef, orderBy('order'));

export function watchBuckets(callback) {
  return onSnapshot(bucketsQuery, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// New buckets append to the end — order is just "current max + 1", no
// manual reordering support.
export async function createBucket({ name, icon, type }) {
  const snap = await getDocs(bucketsQuery);
  const maxOrder = snap.docs.reduce((max, d) => Math.max(max, d.data().order || 0), 0);
  const ref = await addDoc(bucketsRef, { name, icon, type, order: maxOrder + 1 });
  return ref.id;
}

export async function renameBucket(id, name) {
  await updateDoc(doc(db, 'buckets', id), { name });
}

// Existing item entries referencing this bucket's id just become harmless
// orphaned bucketIds elsewhere in this app — same pattern as deleting a
// catalog item (see catalog.js).
export async function deleteBucket(id) {
  await deleteDoc(doc(db, 'buckets', id));
}
