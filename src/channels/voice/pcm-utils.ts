/**
 * Audio PCM utilities for 16-bit linear PCM conversion & calculations
 */

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

export function base64ToBuffer(base64: string): Buffer {
  return Buffer.from(base64, 'base64');
}

/**
 * Calculates Root-Mean-Square (RMS) audio energy from 16-bit PCM buffer
 * Useful for audio activity visualizers and silence detection
 */
export function calculatePcmRms(pcm16Buffer: Buffer | Int16Array): number {
  let int16s: Int16Array;
  if (Buffer.isBuffer(pcm16Buffer)) {
    int16s = new Int16Array(
      pcm16Buffer.buffer,
      pcm16Buffer.byteOffset,
      pcm16Buffer.byteLength / 2
    );
  } else {
    int16s = pcm16Buffer;
  }

  if (int16s.length === 0) return 0;

  let sumSquares = 0;
  for (let i = 0; i < int16s.length; i++) {
    const norm = int16s[i] / 32768.0;
    sumSquares += norm * norm;
  }

  const rms = Math.sqrt(sumSquares / int16s.length);
  return Math.min(1.0, rms * 3.0); // Boost for UI visualizer sensitivity
}

/**
 * Generates a simple sinusoidal test tone in 16-bit 24kHz PCM for simulation fallback
 */
export function generateTonePcm24k(frequencyHz: number, durationMs: number, sampleRate = 24000): Buffer {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const buffer = Buffer.alloc(numSamples * 2);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Apply smooth envelope to avoid audio clicks
    const envelope = Math.sin((Math.PI * i) / numSamples);
    const sample = Math.sin(2 * Math.PI * frequencyHz * t) * 0.4 * envelope;
    const int16Sample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    buffer.writeInt16LE(int16Sample, i * 2);
  }

  return buffer;
}
