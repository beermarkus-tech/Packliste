import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase.js';

const templatesRef = collection(db, 'templates');

export function watchTemplates(callback) {
  return onSnapshot(templatesRef, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function getTemplate(id) {
  const snap = await getDoc(doc(db, 'templates', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createTemplate({ name, items = [] }) {
  const ref = await addDoc(templatesRef, { name, items });
  return ref.id;
}

export async function duplicateTemplate(id, { name } = {}) {
  const original = await getTemplate(id);
  if (!original) throw new Error('Template not found');
  return createTemplate({
    name: name || `${original.name} (Copy)`,
    items: (original.items || []).map((item) => ({ ...item, bucketIds: [...item.bucketIds] })),
  });
}

export async function renameTemplate(id, name) {
  await updateDoc(doc(db, 'templates', id), { name });
}

export async function deleteTemplate(id) {
  await deleteDoc(doc(db, 'templates', id));
}

export async function updateTemplateItems(id, items) {
  await updateDoc(doc(db, 'templates', id), { items });
}
