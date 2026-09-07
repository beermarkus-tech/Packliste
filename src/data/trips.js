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
import { getTemplate } from './templates.js';

const tripsRef = collection(db, 'trips');

export function watchTrips(callback) {
  return onSnapshot(tripsRef, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function getTrip(id) {
  const snap = await getDoc(doc(db, 'trips', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createTrip({ name, date = null, sourceTemplateId = null, items = [] }) {
  const ref = await addDoc(tripsRef, { name, date, sourceTemplateId, items });
  return ref.id;
}

// A trip is always a copy of the template's items at creation time — never a
// live reference. `checked` starts empty; a missing key just reads as unchecked.
export async function createTripFromTemplate(templateId, { name, date } = {}) {
  const template = await getTemplate(templateId);
  if (!template) throw new Error('Template not found');
  const items = (template.items || []).map((item) => ({
    itemId: item.itemId,
    bucketIds: [...item.bucketIds],
    quantity: item.quantity,
    checked: {},
  }));
  return createTrip({ name: name || template.name, date, sourceTemplateId: templateId, items });
}

export async function duplicateTrip(id, { name } = {}) {
  const original = await getTrip(id);
  if (!original) throw new Error('Trip not found');
  return createTrip({
    name: name || `${original.name} (Copy)`,
    date: original.date || null,
    sourceTemplateId: original.sourceTemplateId || null,
    items: (original.items || []).map((item) => ({
      ...item,
      bucketIds: [...item.bucketIds],
      checked: { ...item.checked },
    })),
  });
}

export async function renameTrip(id, name) {
  await updateDoc(doc(db, 'trips', id), { name });
}

export async function deleteTrip(id) {
  await deleteDoc(doc(db, 'trips', id));
}

export async function updateTripItems(id, items) {
  await updateDoc(doc(db, 'trips', id), { items });
}
