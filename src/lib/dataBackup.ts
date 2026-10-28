import JSZip from 'jszip';
import { getAudio, saveAudio } from './audioStorage';

export interface BackupData {
  metadata: any[];
  audioFiles: { id: string; blob: Blob }[];
}

export async function createArchiveBackup(): Promise<Blob> {
  const zip = new JSZip();
  const metadataStr = localStorage.getItem('testimonies_archive');
  
  if (!metadataStr) {
    throw new Error("Nessuna testimonianza da salvare.");
  }

  const metadata = JSON.parse(metadataStr);
  zip.file("metadata.json", metadataStr);

  // Save Studio Global Settings & App settings
  const studioGlobals: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('studio_') || key === 'greeting_rotation_index')) {
      studioGlobals[key] = localStorage.getItem(key) || '';
    }
  }
  zip.file("studio_settings.json", JSON.stringify(studioGlobals));

  const audioFolder = zip.folder("audio");
  if (!audioFolder) throw new Error("Errore nella creazione della cartella audio nel ZIP");

  for (const item of metadata) {
    if (item.audioId) {
      const blob = await getAudio(item.audioId);
      if (blob) {
        audioFolder.file(`${item.audioId}`, blob);
      }
    }
  }

  return await zip.generateAsync({ type: "blob" });
}

export async function restoreArchiveBackup(file: File, overwrite: boolean): Promise<void> {
  const zip = await JSZip.loadAsync(file);
  
  const metadataFile = zip.file("metadata.json");
  if (!metadataFile) {
    throw new Error("File di backup non valido: metadata.json mancante.");
  }

  const metadataStr = await metadataFile.async("string");
  const importedMetadata = JSON.parse(metadataStr);

  const audioFolder = zip.folder("audio");
  if (audioFolder) {
    const audioFiles = audioFolder.filter((path) => !path.endsWith('/'));
    for (const audioFile of audioFiles) {
      const audioId = audioFile.name.replace('audio/', '');
      const blob = await audioFile.async("blob");
      await saveAudio(audioId, blob);
    }
  }

  // Restore Studio Global Settings ONLY IF overwrite is true
  if (overwrite) {
    // Clear current studio settings
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('studio_') || key === 'greeting_rotation_index')) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    const studioFile = zip.file("studio_settings.json");
    if (studioFile) {
      const studioGlobals = JSON.parse(await studioFile.async("string"));
      Object.entries(studioGlobals).forEach(([key, value]) => {
        localStorage.setItem(key, value as string);
      });
    }
  } else {
    // If MERGING, we RESET studio for ALL tracks (existing and new)
    // because the user says "si azzera tutta la parte di fase uno e fase due"
    // We also clear global studio settings
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('studio_')) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  }

  const currentMetadataStr = localStorage.getItem('testimonies_archive');
  let currentMetadata = currentMetadataStr ? JSON.parse(currentMetadataStr) : [];
  
  let finalMetadata: any[] = [];

  if (overwrite) {
    finalMetadata = importedMetadata;
  } else {
    // MERGE logic
    const mergedMetadata = [...currentMetadata];
    const existingIds = new Set(mergedMetadata.map((m: any) => m.id));

    for (const newItem of importedMetadata) {
      if (!existingIds.has(newItem.id)) {
        mergedMetadata.push(newItem);
      } else {
        const index = mergedMetadata.findIndex((m: any) => m.id === newItem.id);
        mergedMetadata[index] = newItem;
      }
    }
    
    // RESET Phase 1 parameters for all merged tracks if merging
    finalMetadata = mergedMetadata.map((item: any) => ({
      ...item,
      studioVolume: undefined,
      studioTrimStart: undefined,
      studioTrimEnd: undefined,
      studioCrossfadeNext: undefined
    }));
  }

  localStorage.setItem('testimonies_archive', JSON.stringify(finalMetadata));
}
