import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { slugify } from '../lib/slug.js';
import { seedBuckets, seedCatalog } from './seedData.js';

// Idempotent: only writes to a collection that is currently empty, so this
// is safe to trigger more than once (e.g. by re-clicking a "Seed" button).
export async function seedDatabase() {
  const results = { buckets: 'skipped (already has data)', catalog: 'skipped (already has data)' };

  const bucketsSnap = await getDocs(collection(db, 'buckets'));
  if (bucketsSnap.empty) {
    const batch = writeBatch(db);
    seedBuckets.forEach((bucket) => {
      const id = slugify(bucket.name);
      batch.set(doc(db, 'buckets', id), bucket);
    });
    await batch.commit();
    results.buckets = `seeded (${seedBuckets.length})`;
  }

  const catalogSnap = await getDocs(collection(db, 'catalog'));
  if (catalogSnap.empty) {
    const batch = writeBatch(db);
    seedCatalog.forEach((item) => {
      const id = `${slugify(item.category)}-${slugify(item.name)}`;
      batch.set(doc(db, 'catalog', id), item);
    });
    await batch.commit();
    results.catalog = `seeded (${seedCatalog.length})`;
  }

  return results;
}
