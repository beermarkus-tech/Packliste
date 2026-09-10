import { collection, addDoc, doc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase.js';

// A small collection of category names, kept separate from the catalog
// items themselves so a category can exist (and be deleted) even with no
// items in it yet. Catalog items still just carry a plain `category`
// string — this collection exists purely so "add category"/"delete
// category" have something concrete to act on.
const categoriesRef = collection(db, 'categories');

export function watchCategories(callback) {
  return onSnapshot(categoriesRef, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function createCategory(name) {
  const ref = await addDoc(categoriesRef, { name });
  return ref.id;
}

export async function deleteCategory(id) {
  await deleteDoc(doc(db, 'categories', id));
}
