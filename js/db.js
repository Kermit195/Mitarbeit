// IndexedDB: ein einfacher Schlüssel-Wert-Speicher.
// Inhalt: „meta“ (Salt, Iterationen – nicht geheim) und „data“ (verschlüsselter Datenstand).

const DB_NAME = 'mitarbeit';
const STORE = 'kv';
let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

export async function get(key) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Mehrere Werte in einer Transaktion schreiben (alles oder nichts)
export async function setMany(obj) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const st = tx.objectStore(STORE);
    for (const [k, v] of Object.entries(obj)) st.put(v, k);
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

export const set = (key, value) => setMany({ [key]: value });

export async function clearAll() {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}
