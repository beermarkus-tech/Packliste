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
import { getDatabase } from './database.js';

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

// A trip is always a copy of the database's items at creation time — never a
// live reference. `checked` starts empty; a missing key just reads as unchecked.
// `sourceTemplateId` records that this trip came from the database, so Prep
// can offer "Update database from this trip" later — the field keeps its
// original name since existing trips in Firestore already use it.
export async function createTripFromDatabase({ name, date } = {}) {
  const database = await getDatabase();
  if (!database) throw new Error('Database not found');
  const items = (database.items || []).map((item) => ({
    itemId: item.itemId,
    bucketIds: [...item.bucketIds],
    quantity: item.quantity,
    checked: {},
    ...(item.comboSide ? { comboSide: item.comboSide } : {}),
  }));
  return createTrip({ name: name || database.name, date, sourceTemplateId: database.id, items });
}

// Starts a new trip as a fresh copy of an existing one: keeps bucket
// assignments, quantities and excluded state, but resets checked/packed
// progress since this is a new trip that hasn't been packed yet.
export async function createTripFromTrip(sourceTripId, { name, date } = {}) {
  const original = await getTrip(sourceTripId);
  if (!original) throw new Error('Trip not found');
  return createTrip({
    name: name || `${original.name} (Copy)`,
    date: date ?? null,
    items: (original.items || []).map((item) => ({
      ...item,
      bucketIds: [...item.bucketIds],
      checked: {},
    })),
  });
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
