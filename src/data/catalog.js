import { collection, addDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase.js';

const catalogRef = collection(db, 'catalog');

export function watchCatalog(callback) {
  return onSnapshot(catalogRef, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// New catalog items appear immediately for every template/trip going
// forward — they are never retroactively added to existing ones, since
// each template/trip only stores entries for items it has assigned.
export async function createCatalogItem({ category, name, icon, defaultQuantity = 1 }) {
  const ref = await addDoc(catalogRef, { category, name, icon, defaultQuantity });
  return ref.id;
}
