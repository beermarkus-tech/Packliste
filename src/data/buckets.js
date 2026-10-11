import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, orderBy, onSnapshot, writeBatch } from 'firebase/firestore';
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
export async function createBucket({ name, icon }) {
  const snap = await getDocs(bucketsQuery);
  const maxOrder = snap.docs.reduce((max, d) => Math.max(max, d.data().order || 0), 0);
  const ref = await addDoc(bucketsRef, { name, icon, order: maxOrder + 1 });
  return ref.id;
}

export async function renameBucket(id, name) {
  await updateDoc(doc(db, 'buckets', id), { name });
}

// At most one bucket is the "last minute" list — marking one clears the flag
// on every other bucket in the same batch, so there's never a moment with two.
// Pass null to clear it everywhere.
export async function setLastMinuteBucket(id) {
  const snap = await getDocs(bucketsRef);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    const shouldBe = d.id === id;
    if (!!d.data().lastMinute !== shouldBe) batch.update(d.ref, { lastMinute: shouldBe });
  });
  await batch.commit();
}

// Existing item entries referencing this bucket's id just become harmless
// orphaned bucketIds elsewhere in this app — same pattern as deleting a
// catalog item (see catalog.js).
export async function deleteBucket(id) {
  await deleteDoc(doc(db, 'buckets', id));
}
