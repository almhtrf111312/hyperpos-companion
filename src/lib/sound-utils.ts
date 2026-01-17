// Sound utilities for HyperPOS
// Plays sounds based on user settings

const SETTINGS_KEY = 'hyperpos_settings_v1';

// Extended Window interface for WebKit AudioContext
interface ExtendedWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

/**
 * Check if sound effects are enabled in settings
 */
function isSoundEnabled(): boolean {
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    // Default to true if not set
    return settings.notificationSettings?.sound !== false;
  } catch {
    return true;
  }
}

/**
 * Play a tone using Web Audio API
 */
function playTone(frequency: number, duration: number, volume: number = 0.3): void {
  try {
    const extWindow = window as ExtendedWindow;
    const AudioContextClass = window.AudioContext || extWindow.webkitAudioContext;
    if (!AudioContextClass) return;
    
    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  } catch (e) {
    console.log('Audio playback failed:', e);
  }
}

/**
 * Play beep sound for barcode scan
 */
export function playBeep(): void {
  if (!isSoundEnabled()) return;
  playTone(1800, 0.15, 0.3);
}

/**
 * Play sound when adding product to cart
 */
export function playAddToCart(): void {
  if (!isSoundEnabled()) return;
  playTone(800, 0.1, 0.2);
}

/**
 * Play success sound for completed sale
 */
export function playSaleComplete(): void {
  if (!isSoundEnabled()) return;
  // Two-tone success sound
  playTone(800, 0.15, 0.25);
  setTimeout(() => playTone(1200, 0.2, 0.25), 150);
}

/**
 * Play sound when recording a debt
 */
export function playDebtRecorded(): void {
  if (!isSoundEnabled()) return;
  playTone(600, 0.2, 0.2);
}

/**
 * Play error/warning sound
 */
export function playError(): void {
  if (!isSoundEnabled()) return;
  playTone(300, 0.25, 0.3);
}
