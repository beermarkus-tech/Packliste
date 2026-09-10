import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { getCatalog } from './catalog.js';

// One-time migration, meant to run exactly once from Settings and then be
// deleted from the codebase: backfills a full catalog snapshot into every
// existing trip's localCatalog, same as every newly-created trip already
// gets. Without this, a trip created before that change only resolves its
// items via a live fallback to the shared catalog — meaning it stays
// vulnerable to a catalog rename changing what it shows, until this runs.
// Keeps each trip's existing localCatalog entries untouched (including any
// items already added locally) and only adds catalog items missing from it,
// so running this twice is harmless.
export async function migrateTripsToLocalCatalog() {
  const catalog = await getCatalog();
  const tripsSnap = await getDocs(collection(db, 'trips'));

  let tripsUpdated = 0;
  let itemsAdded = 0;

  for (const tripDoc of tripsSnap.docs) {
    const trip = tripDoc.data();
    const existingIds = new Set((trip.localCatalog || []).map((item) => item.id));
    const additions = catalog
      .filter((item) => !existingIds.has(item.id))
      .map(({ id, category, name, icon, defaultQuantity }) => ({ id, category, name, icon, defaultQuantity }));

    if (additions.length === 0) continue;

    const localCatalog = [...(trip.localCatalog || []), ...additions];
    await updateDoc(doc(db, 'trips', tripDoc.id), { localCatalog });
    tripsUpdated += 1;
    itemsAdded += additions.length;
  }

  return { tripCount: tripsSnap.docs.length, tripsUpdated, itemsAdded };
}
