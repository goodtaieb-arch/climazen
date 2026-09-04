/**
 * Alarme 1 h de pause repas (sur site, INT en cours).
 * Son préparé au geste « pause repas », notification + vibration à l’échéance.
 */

const FIRED_KEY = 'climazen_pause_repas_alarme_fired'

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!audioCtx) audioCtx = new AC()
  return audioCtx
}

export function preparerSonAlarmePauseRepas() {
  const ctx = getAudioContext()
  if (!ctx) return
  void ctx.resume()
}

export function jouerSonAlarmePauseRepas() {
  const ctx = getAudioContext()
  if (!ctx) return
  void ctx.resume()
  const now = ctx.currentTime
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, now + i * 0.35)
    gain.gain.exponentialRampToValueAtTime(0.12, now + i * 0.35 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.35 + 0.22)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now + i * 0.35)
    osc.stop(now + i * 0.35 + 0.24)
  }
}

export function demanderPermissionAlarmePauseRepas() {
  if (typeof Notification === 'undefined') return
  if (Notification.permission === 'default') {
    void Notification.requestPermission()
  }
}

export function notifierFinPauseRepas(opts?: { numero?: string }) {
  const title = 'Fin de pause repas'
  const body = opts?.numero
    ? `1 h écoulée — reprenez ${opts.numero} (Arrêter la pause).`
    : '1 h écoulée — arrêtez la pause pour reprendre l’INT.'
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body, tag: 'climazen-pause-repas', silent: false })
    }
  } catch {
    /* ignore */
  }
  try {
    navigator.vibrate?.([400, 160, 400, 160, 600])
  } catch {
    /* ignore */
  }
  jouerSonAlarmePauseRepas()
}

export function alarmePauseRepasDejaDeclenchee(startedAt: string): boolean {
  try {
    return localStorage.getItem(FIRED_KEY) === startedAt
  } catch {
    return false
  }
}

export function marquerAlarmePauseRepasDeclenchee(startedAt: string) {
  try {
    localStorage.setItem(FIRED_KEY, startedAt)
  } catch {
    /* ignore */
  }
}

export function resetAlarmePauseRepas() {
  try {
    localStorage.removeItem(FIRED_KEY)
  } catch {
    /* ignore */
  }
}
