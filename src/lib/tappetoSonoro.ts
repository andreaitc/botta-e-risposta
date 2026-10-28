
export interface TappetoClip {
  id: string;
  language: string;
  blob: Blob;
  studioVolume?: number;
  studioTrimStart?: number;
  studioTrimEnd?: number;
  studioCrossfadeNext?: number;
}

export async function generateTappetoSonoro(
  clips: TappetoClip[],
  onProgress?: (percent: number, message: string) => void
): Promise<Blob> {
  const SAMPLE_RATE = 44100;
  const CROSSFADE_SECONDS = 3.0;
  const TARGET_DURATION = 13.0;
  const FADE_SAMPLES = Math.floor(CROSSFADE_SECONDS * SAMPLE_RATE);
  const TARGET_SAMPLES = Math.floor(TARGET_DURATION * SAMPLE_RATE);

  onProgress?.(0, "Carico le registrazioni...");

  // 1. Arrange clips. Use existing user sequence if they have manual customizations, otherwise shuffle.
  onProgress?.(10, "Ordino le clip...");
  
  const hasStudioCustomizations = clips.some(c => 
    c.studioVolume !== undefined || 
    c.studioTrimStart !== undefined || 
    c.studioTrimEnd !== undefined
  );

  let orderedClips = [...clips];
  if (!hasStudioCustomizations) {
    orderedClips.sort(() => Math.random() - 0.5);

    // Language constraint: no two consecutive clips with same language (only for random generation)
    for (let iter = 0; iter < 50; iter++) {
      let conflicts = false;
      for (let i = 0; i < orderedClips.length - 1; i++) {
        if (orderedClips[i].language === orderedClips[i + 1].language) {
          conflicts = true;
          let swapIdx = -1;
          for (let j = i + 2; j < orderedClips.length; j++) {
            if (orderedClips[j].language !== orderedClips[i].language) {
              swapIdx = j;
              break;
            }
          }
          if (swapIdx !== -1) {
            [orderedClips[i + 1], orderedClips[swapIdx]] = [orderedClips[swapIdx], orderedClips[i + 1]];
          }
        }
      }
      if (!conflicts) break;
    }
  }

  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE });
  
  const processedClips: Float32Array[] = [];

  for (let i = 0; i < orderedClips.length; i++) {
    const progress = 10 + (i / orderedClips.length) * 70;
    const config = orderedClips[i];
    onProgress?.(progress, `Analizzo clip ${i + 1} di ${orderedClips.length}...`);

    try {
      const arrayBuffer = await config.blob.arrayBuffer();
      if (arrayBuffer.byteLength === 0) {
        console.warn(`Clip ${config.id} is empty, skipping.`);
        continue;
      }

      let decodedBuffer: AudioBuffer;
      try {
        decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      } catch (decodeErr) {
        console.error(`Error decoding clip ${config.id}:`, decodeErr);
        continue;
      }
      
      const monoData = new Float32Array(decodedBuffer.length);
      for (let s = 0; s < decodedBuffer.length; s++) {
        let sum = 0;
        for (let c = 0; c < decodedBuffer.numberOfChannels; c++) {
          sum += decodedBuffer.getChannelData(c)[s];
        }
        monoData[s] = sum / decodedBuffer.numberOfChannels;
      }

      // Resample if needed
      let resampledData: Float32Array;
      if (decodedBuffer.sampleRate !== SAMPLE_RATE) {
        const ratio = decodedBuffer.sampleRate / SAMPLE_RATE;
        const newLen = Math.floor(decodedBuffer.length / ratio);
        resampledData = new Float32Array(newLen);
        for (let s = 0; s < newLen; s++) {
          const srcIdx = s * ratio;
          const i1 = Math.floor(srcIdx);
          const i2 = Math.min(i1 + 1, decodedBuffer.length - 1);
          const frac = srcIdx - i1;
          resampledData[s] = monoData[i1] * (1 - frac) + monoData[i2] * frac;
        }
      } else {
        resampledData = monoData;
      }

      const useStudioTrim = config.studioTrimStart !== undefined && config.studioTrimEnd !== undefined;
      let start = 0;
      let end = resampledData.length - 1;
      
      if (useStudioTrim) {
        start = Math.max(0, Math.floor(config.studioTrimStart! * SAMPLE_RATE));
        end = Math.min(resampledData.length - 1, Math.floor(config.studioTrimEnd! * SAMPLE_RATE));
      } else {
        // Trim silence (original logic)
        const threshold = 0.02;
        for (let s = 0; s < resampledData.length; s++) {
          if (Math.abs(resampledData[s]) > threshold) {
            start = Math.max(0, s - Math.floor(SAMPLE_RATE * 0.5));
            break;
          }
        }
        for (let s = resampledData.length - 1; s >= 0; s--) {
          if (Math.abs(resampledData[s]) > threshold) {
            end = Math.min(resampledData.length - 1, s + Math.floor(SAMPLE_RATE * 0.5));
            break;
          }
        }
      }

      let clipData = resampledData.slice(start, end + 1);
      
      // Pad or trim to exactly TARGET_SAMPLES (13 seconds) only if NOT using studio trim
      if (!useStudioTrim) {
        if (clipData.length < TARGET_SAMPLES) {
          const padded = new Float32Array(TARGET_SAMPLES);
          padded.set(clipData);
          clipData = padded;
        } else if (clipData.length > TARGET_SAMPLES) {
          clipData = clipData.slice(0, TARGET_SAMPLES);
        }
      }

      // Apply studio custom volume if it exists
      const clipVolume = config.studioVolume !== undefined ? config.studioVolume : 1.0;
      if (clipVolume !== 1.0) {
        for (let s = 0; s < clipData.length; s++) {
          clipData[s] *= clipVolume;
        }
      }

      processedClips.push(clipData);
    } catch (e) {
      console.error(`Error decoding clip ${config.id}:`, e);
    }
  }

  if (processedClips.length === 0) {
    await audioCtx.close();
    throw new Error("Nessun audio valido trovato.");
  }

  onProgress?.(85, "Monto il tappeto sonoro...");

  // Pre-calculate safe individual crossfade samples
  const fadeSamplesList: number[] = [];
  for (let i = 0; i < processedClips.length - 1; i++) {
    const config = orderedClips[i];
    const currentClip = processedClips[i];
    const nextClip = processedClips[i + 1];
    
    const specifiedCrossfade = config.studioCrossfadeNext !== undefined ? config.studioCrossfadeNext : (hasStudioCustomizations ? 2.0 : 3.0);
    const maxSafeCrossfadeSeconds = Math.min(currentClip.length, nextClip.length) / SAMPLE_RATE * 0.45; // up to 45% of either clip
    const safeCrossfadeSeconds = Math.min(specifiedCrossfade, maxSafeCrossfadeSeconds);
    fadeSamplesList.push(Math.floor(safeCrossfadeSeconds * SAMPLE_RATE));
  }

  // Calculate total samples based on individual fade sizes
  let totalSamples = 0;
  for (let i = 0; i < processedClips.length; i++) {
    if (i === 0) {
      totalSamples += processedClips[i].length;
    } else {
      totalSamples += processedClips[i].length - fadeSamplesList[i - 1];
    }
  }
  
  const outputBuffer = new Float32Array(totalSamples);
  let currentOffset = 0;

  for (let i = 0; i < processedClips.length; i++) {
    const clip = processedClips[i];
    const prevFadeSamples = i > 0 ? fadeSamplesList[i - 1] : 0;
    const nextFadeSamples = i < processedClips.length - 1 ? fadeSamplesList[i] : 0;
    
    for (let j = 0; j < clip.length; j++) {
      if (currentOffset + j >= outputBuffer.length) break;

      let gain = 1.0;
      // Fade in (if not first clip)
      if (i > 0 && j < prevFadeSamples) {
        gain = Math.sin((j / prevFadeSamples) * (Math.PI / 2));
      } 
      // Fade out (if not last clip)
      else if (i < processedClips.length - 1 && j >= clip.length - nextFadeSamples) {
        const fadeProgress = (clip.length - j) / nextFadeSamples;
        gain = Math.sin(fadeProgress * (Math.PI / 2));
      }

      outputBuffer[currentOffset + j] += clip[j] * gain;
    }
    
    currentOffset += clip.length - nextFadeSamples;
  }

  // Normalization
  onProgress?.(95, "Normalizzo l'audio...");
  let maxAmp = 0;
  for (let i = 0; i < outputBuffer.length; i++) {
    const abs = Math.abs(outputBuffer[i]);
    if (abs > maxAmp) maxAmp = abs;
  }

  if (maxAmp > 0) {
    const scale = 0.95 / maxAmp;
    for (let i = 0; i < outputBuffer.length; i++) {
      outputBuffer[i] *= scale;
    }
  }

  // WAV Encoding
  const wavBlob = encodeWAV(outputBuffer, SAMPLE_RATE);
  onProgress?.(100, "Completato!");
  
  await audioCtx.close();
  return wavBlob;
}

export async function convertBlobToWav(blob: Blob): Promise<Blob> {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    
    // Wrap decodeAudioData in a 2000ms timeout to prevent infinite hanging inside iframe/suspended contexts
    const audioBuffer = await Promise.race([
      audioCtx.decodeAudioData(arrayBuffer),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Timeout decodifica audio (2000ms reached)")), 2000);
      })
    ]);
    
    const monoData = new Float32Array(audioBuffer.length);
    for (let s = 0; s < audioBuffer.length; s++) {
      let sum = 0;
      for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
        sum += audioBuffer.getChannelData(c)[s];
      }
      monoData[s] = sum / audioBuffer.numberOfChannels;
    }
    
    // Normalize
    let max = 0;
    for (let i = 0; i < monoData.length; i++) {
      const abs = Math.abs(monoData[i]);
      if (abs > max) max = abs;
    }
    if (max > 0) {
      const scale = 0.95 / max;
      for (let i = 0; i < monoData.length; i++) {
        monoData[i] *= scale;
      }
    }
    
    return encodeWAV(monoData, audioBuffer.sampleRate);
  } finally {
    try {
      await audioCtx.close();
    } catch (closeError) {
      console.warn("Errore benigno chiusura AudioContext:", closeError);
    }
  }
}

export function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  floatTo16BitPCM(view, 44, samples);

  return new Blob([view], { type: 'audio/wav' });
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
