'use client';
import type { IrrigationEventRecord } from '@/lib/domain/irrigation-event-record';


function completionSignalStorageKey(event: IrrigationEventRecord) {
  const end = event.equipment.timerTheoreticalEndAt ?? 'without-end';
  return `irrigation:completion-signaled:${event.id}:${end}`;
}

export function wasCompletionAlreadySignaled(event: IrrigationEventRecord) {
  try {
    return window.localStorage.getItem(completionSignalStorageKey(event)) === '1';
  } catch {
    return false;
  }
}

export function rememberCompletionSignal(event: IrrigationEventRecord) {
  try {
    window.localStorage.setItem(completionSignalStorageKey(event), '1');
  } catch {
    // La déduplication reste assurée en mémoire si le stockage est indisponible.
  }
}

export function playCompletionTone() {
  try {
    const AudioContextClass = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    gain.gain.setValueAtTime(0.12, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.8);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.8);
  } catch {
    // Certains navigateurs mobiles bloquent le son en arrière-plan.
  }
}
