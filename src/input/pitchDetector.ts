import type { PitchClass } from '../engine/chordData.types';

/**
 * YIN pitch detection algorithm — pure function, no side effects.
 * Returns detected frequency and confidence, or null if no pitch found.
 *
 * Reference: de Cheveigné & Kawahara, "YIN, a fundamental frequency estimator
 * for speech and music" (2002).
 */
export function yinDetect(
  buffer: Float32Array,
  sampleRate: number,
): { frequency: number; confidence: number } | null {
  const halfLen = Math.floor(buffer.length / 2);
  const threshold = 0.1; // absolute threshold τ for CMNDF

  // Step 1 & 2: Difference function
  const diff = new Float32Array(halfLen);
  for (let tau = 0; tau < halfLen; tau++) {
    let sum = 0;
    for (let i = 0; i < halfLen; i++) {
      const delta = buffer[i] - buffer[i + tau];
      sum += delta * delta;
    }
    diff[tau] = sum;
  }

  // Step 3: Cumulative mean normalized difference function (CMNDF)
  const cmndf = new Float32Array(halfLen);
  cmndf[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < halfLen; tau++) {
    runningSum += diff[tau];
    cmndf[tau] = (diff[tau] * tau) / runningSum;
  }

  // Step 4: Absolute threshold — find first tau where CMNDF dips below threshold
  // Start at tau=2 to skip trivially small periods
  let tauEstimate = -1;
  for (let tau = 2; tau < halfLen; tau++) {
    if (cmndf[tau] < threshold) {
      // Walk to the local minimum
      while (tau + 1 < halfLen && cmndf[tau + 1] < cmndf[tau]) {
        tau++;
      }
      tauEstimate = tau;
      break;
    }
  }

  if (tauEstimate === -1) return null;

  // Step 5: Parabolic interpolation for sub-sample accuracy
  const t = tauEstimate;
  let betterTau = t;
  if (t > 0 && t < halfLen - 1) {
    const s0 = cmndf[t - 1];
    const s1 = cmndf[t];
    const s2 = cmndf[t + 1];
    const shift = (s0 - s2) / (2 * (s0 - 2 * s1 + s2));
    if (isFinite(shift)) {
      betterTau = t + shift;
    }
  }

  const frequency = sampleRate / betterTau;
  const confidence = 1 - cmndf[tauEstimate];

  // Sanity: reject frequencies outside musical range (20 Hz – 5000 Hz)
  if (frequency < 20 || frequency > 5000) return null;

  return { frequency, confidence };
}

/**
 * Convert a frequency (Hz) to a pitch class (0=C .. 11=B).
 * Uses standard 12-TET tuning with A4 = 440 Hz.
 */
export function frequencyToPitchClass(freq: number): PitchClass {
  const midiNote = Math.round(12 * Math.log2(freq / 440) + 69);
  return ((midiNote % 12 + 12) % 12) as PitchClass;
}

/**
 * Compute RMS energy of a signal buffer.
 * Used as a silence gate before running pitch detection.
 */
export function computeRMS(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}
