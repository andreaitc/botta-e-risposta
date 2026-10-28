import { encodeWAV } from './tappetoSonoro';

export interface StudioTrack {
  id: string;
  blob: Blob | string;
  volume: number;
  startTime: number; // in seconds relative to the start of the mix
  duration: number;
  offset: number; // start point within the clip
  crossfadeNext: number; // crossfade duration to the next track
  fadeIn?: number; // initial fade in duration (for first track)
  fadeOut?: number; // final fade out duration (for last track)
}

export async function mixStudioTracks(
  tracks: StudioTrack[],
  musicTrack: { blob: Blob | string; volume: number } | null,
  exportStart: number,
  exportEnd: number,
  onProgress?: (percent: number, message: string) => void,
  signal?: AbortSignal
): Promise<Blob> {
  const SAMPLE_RATE = 44100;
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE });
  
  onProgress?.(10, "Preparazione tracce...");

  let decodedCount = 0;
  const decodedBuffers = await Promise.all(tracks.map(async (t) => {
    if (signal?.aborted) throw new Error('Aborted');
    let blob: Blob;
    if (typeof t.blob === 'string') {
      const response = await fetch(t.blob, { signal });
      blob = await response.blob();
    } else {
      blob = t.blob;
    }
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const decoded = await audioCtx.decodeAudioData(arrayBuffer);
      decodedCount++;
      if (!signal?.aborted) {
        const percent = 10 + Math.round((decodedCount / tracks.length) * 30);
        onProgress?.(percent, `Preparazione tracce (${decodedCount}/${tracks.length})...`);
      }
      return decoded;
    } catch (decodeErr) {
      if (signal?.aborted) throw new Error('Aborted');
      throw decodeErr;
    }
  }));

  if (signal?.aborted) {
    await audioCtx.close();
    throw new Error('Aborted');
  }

  // Rule 1: Calculate total duration based on voices
  // If we are in Phase 2, we usually have one voice track (the mix)
  // Let's find the end of the last voice track
  let lastVoiceEnd = 0;
  tracks.forEach((t, i) => {
    if (t.id !== 'music_track') {
      lastVoiceEnd = Math.max(lastVoiceEnd, t.startTime + t.duration);
    }
  });

  const voiceDuration = tracks.find(t => t.id === 'voices_mix')?.duration || (lastVoiceEnd > 0 ? lastVoiceEnd : 0);
  
  const isPhase2 = tracks.some(t => t.id === 'voices_mix') || tracks.some(t => t.id === 'music_track');
  const totalDuration = isPhase2 ? (voiceDuration + 4) : (exportEnd - exportStart);
  
  const totalSamples = Math.floor(totalDuration * SAMPLE_RATE);
  const outputBuffer = new Float32Array(totalSamples);

  onProgress?.(40, "Mixing in corso...");

  // Mix music track FIRST (Rule 2: Looping with 2s crossfade)
  const musicTrackIndex = tracks.findIndex(t => t.id === 'music_track');
  if (musicTrackIndex !== -1) {
    const musicConfig = tracks[musicTrackIndex];
    const musicBuffer = decodedBuffers[musicTrackIndex];
    const musicVolume = musicConfig.volume;
    const musicSamples = musicBuffer.length;
    const crossfadeSamples = 2 * SAMPLE_RATE; // 2s crossfade
    
    let currentSample = 0;
    while (currentSample < totalSamples) {
      const loopStart = currentSample;
      const loopEnd = Math.min(totalSamples, loopStart + musicSamples);
      
      for (let s = loopStart; s < loopEnd; s++) {
        const musicIdx = s - loopStart;
        if (musicIdx >= musicSamples) break;

        let sample = 0;
        for (let c = 0; c < musicBuffer.numberOfChannels; c++) {
          sample += musicBuffer.getChannelData(c)[musicIdx];
        }
        sample /= musicBuffer.numberOfChannels;

        // Apply crossfade if we are in the crossfade region
        let fadeVolume = 1.0;
        
        // Fade in if not the first loop
        if (loopStart > 0 && musicIdx < crossfadeSamples) {
          fadeVolume = musicIdx / crossfadeSamples;
        }
        
        // Fade out if not the last part of the total duration AND we are near the end of this loop
        if (loopEnd < totalSamples && (musicSamples - musicIdx) < crossfadeSamples) {
          fadeVolume = (musicSamples - musicIdx) / crossfadeSamples;
        }

        outputBuffer[s] += sample * musicVolume * fadeVolume;
      }
      
      if (loopEnd >= totalSamples) break;
      currentSample += (musicSamples - crossfadeSamples);
    }

    // Rule 1: Final 2s fade out of music
    const finalFadeSamples = 2 * SAMPLE_RATE;
    for (let s = totalSamples - finalFadeSamples; s < totalSamples; s++) {
      if (s < 0) continue;
      const fadeOutFactor = (totalSamples - s) / finalFadeSamples;
      outputBuffer[s] *= fadeOutFactor;
    }
  }

  // Mix voice tracks
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    if (track.id === 'music_track') continue; // Music already handled

    const buffer = decodedBuffers[i];
    const trackVolume = track.volume;
    
    // Rule 1: Voice starts at 2s in Phase 2
    const actualStartTime = isPhase2 && track.id === 'voices_mix' ? 2.0 : track.startTime;
    
    const outStart = Math.max(0, Math.floor((actualStartTime - exportStart) * SAMPLE_RATE));
    const outEnd = Math.min(totalSamples, Math.floor((actualStartTime + track.duration - exportStart) * SAMPLE_RATE));
    
    const clipOffsetSamples = Math.floor(track.offset * SAMPLE_RATE);
    
    // Crossfade durations
    const crossfadePrev = i > 0 ? tracks[i-1].crossfadeNext : (track.fadeIn || 0);
    const crossfadeNext = i < tracks.length - 1 ? track.crossfadeNext : (track.fadeOut || 0);
    
    const fadeInSamples = Math.floor(crossfadePrev * SAMPLE_RATE);
    const fadeOutSamples = Math.floor(crossfadeNext * SAMPLE_RATE);
    
    for (let s = outStart; s < outEnd; s++) {
      const clipIdx = clipOffsetSamples + (s - outStart);
      if (clipIdx >= buffer.length) break;

      let sample = 0;
      for (let c = 0; c < buffer.numberOfChannels; c++) {
        sample += buffer.getChannelData(c)[clipIdx];
      }
      sample /= buffer.numberOfChannels;

      // Apply Fades
      let fadeVolume = 1.0;
      
      // Fade In (at the start of the track)
      if (fadeInSamples > 0 && (s - outStart) < fadeInSamples) {
        fadeVolume = (s - outStart) / fadeInSamples;
      }
      
      // Fade Out (at the end of the track)
      const samplesFromEnd = (outEnd - s);
      if (fadeOutSamples > 0 && samplesFromEnd < fadeOutSamples) {
        fadeVolume = Math.min(fadeVolume, samplesFromEnd / fadeOutSamples);
      }

      outputBuffer[s] += sample * trackVolume * fadeVolume;
    }
  }

  // Normalization
  onProgress?.(90, "Finalizzazione...");
  let maxAmp = 0;
  for (let i = 0; i < outputBuffer.length; i++) {
    const abs = Math.abs(outputBuffer[i]);
    if (abs > maxAmp) maxAmp = abs;
  }

  if (maxAmp > 1.0) {
    const scale = 0.95 / maxAmp;
    for (let i = 0; i < outputBuffer.length; i++) {
      outputBuffer[i] *= scale;
    }
  }

  const wavBlob = encodeWAV(outputBuffer, SAMPLE_RATE);
  onProgress?.(100, "Completato!");
  
  await audioCtx.close();
  return wavBlob;
}
