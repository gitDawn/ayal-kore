// Per-browser cache of the decoded snapshot, keyed by inventory version id,
// so returning visitors don't re-download the catalog. Best effort only:
// any failure (private mode, blocked storage) just means a normal download.
import type { Snapshot } from './inventory';

const DB = 'book-catalog';
const STORE = 'snapshots';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function readCached(versionId: string): Promise<Snapshot | null> {
  try {
    const db = await open();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(versionId);
      req.onsuccess = () => resolve((req.result as Snapshot) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function writeCached(versionId: string, s: Snapshot): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.clear(); // keep only the current version
      store.put(s, versionId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
}
