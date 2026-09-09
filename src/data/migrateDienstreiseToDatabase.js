import { collection, doc, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.js';

// One-time migration, meant to run exactly once from Settings and then be
// deleted from the codebase: folds the old multi-template feature's
// "Dienstreise" template into the new single database, seeded with the
// "Hamburg and Rostock" trip's current bucket assignments, and removes any
// other leftover template documents so exactly one remains.
export async function migrateDienstreiseToDatabase() {
  const templatesSnap = await getDocs(collection(db, 'templates'));
  const templateDocs = templatesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const target = templateDocs.find((t) => (t.name || '').trim().toLowerCase() === 'dienstreise');
  if (!target) {
    throw new Error('No template named "Dienstreise" was found.');
  }

  const tripsSnap = await getDocs(collection(db, 'trips'));
  const tripDocs = tripsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const matches = tripDocs.filter((t) => {
    const name = (t.name || '').toLowerCase();
    return name.includes('hamburg') && name.includes('rostock');
  });
  if (matches.length === 0) {
    throw new Error('No trip matching "Hamburg" and "Rostock" was found.');
  }
  if (matches.length > 1) {
    throw new Error(
      `Found ${matches.length} trips matching "Hamburg" and "Rostock" (${matches.map((t) => t.name).join(', ')}) — expected exactly one.`
    );
  }
  const sourceTrip = matches[0];

  const items = (sourceTrip.items || []).map(({ itemId, bucketIds, quantity, comboSide }) => ({
    itemId,
    bucketIds: [...(bucketIds || [])],
    quantity,
    ...(comboSide ? { comboSide } : {}),
  }));

  await updateDoc(doc(db, 'templates', target.id), { name: 'Database', items });

  const others = templateDocs.filter((t) => t.id !== target.id);
  for (const other of others) {
    await deleteDoc(doc(db, 'templates', other.id));
  }

  return {
    sourceTripName: sourceTrip.name,
    itemCount: items.length,
    deletedOtherTemplates: others.length,
  };
}
