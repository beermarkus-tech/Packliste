import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase.js';

const bucketsQuery = query(collection(db, 'buckets'), orderBy('order'));

export function watchBuckets(callback) {
  return onSnapshot(bucketsQuery, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}
