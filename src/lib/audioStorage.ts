
export async function openAudioDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // We use a fixed version or try to detect it. 
    // To be safe and ensure the store exists, we can try to open it.
    const request = indexedDB.open('botta_e_risposta_audio', 2); // Bumped to 2 to ensure upgradeneeded runs if it was 1

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('audio_blobs')) {
        db.createObjectStore('audio_blobs');
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // Double check if store exists
      if (!db.objectStoreNames.contains('audio_blobs')) {
        db.close();
        // If it still doesn't exist, try one more time with a higher version
        const nextVersion = db.version + 1;
        const req2 = indexedDB.open('botta_e_risposta_audio', nextVersion);
        req2.onupgradeneeded = (e) => {
          const db2 = (e.target as IDBOpenDBRequest).result;
          if (!db2.objectStoreNames.contains('audio_blobs')) {
            db2.createObjectStore('audio_blobs');
          }
        };
        req2.onsuccess = () => resolve(req2.result);
        req2.onerror = () => reject(req2.error);
      } else {
        resolve(db);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Fallback for old database
async function getAudioFromOldDB(id: string): Promise<Blob | null> {
  const oldDBNames = ['battito_audio', 'battito_audio_v2', 'botta_e_risposta_audio_v1'];
  
  for (const dbName of oldDBNames) {
    const blob = await new Promise<Blob | null>((resolve) => {
      const request = indexedDB.open(dbName, 1);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('audio_blobs')) {
          db.close();
          resolve(null);
          return;
        }
        try {
          const transaction = db.transaction('audio_blobs', 'readonly');
          const store = transaction.objectStore('audio_blobs');
          const getReq = store.get(id);
          getReq.onsuccess = () => {
            db.close();
            resolve(getReq.result || null);
          };
          getReq.onerror = () => {
            db.close();
            resolve(null);
          };
        } catch (e) {
          db.close();
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
    
    if (blob) return blob;
  }
  
  return null;
}

export async function saveAudio(id: string, blob: Blob): Promise<void> {
  try {
    const db = await openAudioDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction('audio_blobs', 'readwrite');
        const store = transaction.objectStore('audio_blobs');
        const request = store.put(blob, id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (e) {
        reject(e);
      }
    });
  } catch (e) {
    console.error("Failed to save audio:", e);
    throw e;
  }
}

export async function getAudio(id: string): Promise<Blob | null> {
  try {
    const db = await openAudioDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction('audio_blobs', 'readonly');
        const store = transaction.objectStore('audio_blobs');
        const request = store.get(id);

        request.onsuccess = async () => {
          if (request.result) {
            resolve(request.result);
          } else {
            // Fallback to old database
            const oldBlob = await getAudioFromOldDB(id);
            if (oldBlob) {
              // Migrate it to the new DB
              await saveAudio(id, oldBlob).catch(console.error);
            }
            resolve(oldBlob);
          }
        };
        request.onerror = () => reject(request.error);
      } catch (e) {
        // If transaction fails because store is missing, return null instead of throwing "The object can not be found here"
        if (e instanceof Error && (e.name === 'NotFoundError' || e.message.includes('found'))) {
          resolve(null);
        } else {
          reject(e);
        }
      }
    });
  } catch (e) {
    console.error("Failed to get audio:", e);
    return null;
  }
}

export async function deleteAudio(id: string): Promise<void> {
  const db = await openAudioDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('audio_blobs', 'readwrite');
    const store = transaction.objectStore('audio_blobs');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearAllAudio(): Promise<void> {
  const db = await openAudioDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('audio_blobs', 'readwrite');
    const store = transaction.objectStore('audio_blobs');
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function countAudioFiles(): Promise<number> {
  try {
    const db = await openAudioDB();
    return new Promise((resolve) => {
      const transaction = db.transaction('audio_blobs', 'readonly');
      const store = transaction.objectStore('audio_blobs');
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(0);
    });
  } catch (e) {
    return 0;
  }
}

export async function getAllAudioKeys(): Promise<string[]> {
  try {
    const db = await openAudioDB();
    return new Promise((resolve) => {
      const transaction = db.transaction('audio_blobs', 'readonly');
      const store = transaction.objectStore('audio_blobs');
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => resolve([]);
    });
  } catch (e) {
    return [];
  }
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator !== 'undefined' && 'storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0
      };
    } catch (e) {
      console.error("Error getting storage estimate:", e);
      return null;
    }
  }
  return null;
}
