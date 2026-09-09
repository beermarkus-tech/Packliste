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

export async function createTrip({
  name,
  date = null,
  sourceTemplateId = null,
  items = [],
  localCatalog = [],
}) {
  const ref = await addDoc(tripsRef, { name, date, sourceTemplateId, items, localCatalog });
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
// assignments, quantities, excluded state and any local-only catalog items,
// but resets checked/packed progress since this is a new trip that hasn't
// been packed yet.
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
    localCatalog: (original.localCatalog || []).map((item) => ({ ...item })),
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
    localCatalog: (original.localCatalog || []).map((item) => ({ ...item })),
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

// Local catalog items live inside the trip document itself (not the shared
// "catalog" collection), so they only ever appear in this trip and copies of
// it made via createTripFromTrip/duplicateTrip — never in the database or
// any other trip's Prep screen.
function generateLocalItemId() {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function addLocalCatalogItem(tripId, { category, name, icon, defaultQuantity = 1 }) {
  const trip = await getTrip(tripId);
  const item = { id: generateLocalItemId(), category, name, icon, defaultQuantity };
  const localCatalog = [...(trip?.localCatalog || []), item];
  await updateDoc(doc(db, 'trips', tripId), { localCatalog });
  return item.id;
}

export async function updateLocalCatalogItem(tripId, itemId, { category, name, icon }) {
  const trip = await getTrip(tripId);
  const localCatalog = (trip?.localCatalog || []).map((item) =>
    item.id === itemId ? { ...item, category, name, icon } : item
  );
  await updateDoc(doc(db, 'trips', tripId), { localCatalog });
}

// Also strips any item-entry referencing this local item, since it can no
// longer resolve to a catalog item once deleted.
export async function deleteLocalCatalogItem(tripId, itemId) {
  const trip = await getTrip(tripId);
  const localCatalog = (trip?.localCatalog || []).filter((item) => item.id !== itemId);
  const items = (trip?.items || []).filter((entry) => entry.itemId !== itemId);
  await updateDoc(doc(db, 'trips', tripId), { localCatalog, items });
}
