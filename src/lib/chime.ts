/**
 * Aviso sonoro suave generado con Web Audio API (sin archivos externos).
 * El AudioContext debe crearse tras un gesto del usuario (clic en "Activar aviso sonoro").
 */
let ctx: AudioContext | null = null

export function unlockAudio(): boolean {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return false
    ctx ??= new Ctor()
    if (ctx.state === 'suspended') void ctx.resume()
    return true
  } catch {
    return false
  }
}

/** Dos notas suaves (tipo campanita) de ~0,9 s en total. */
export function playChime() {
  if (!ctx) return
  const start = ctx.currentTime + 0.02
  const notes = [
    { freq: 659.25, at: 0 }, // Mi5
    { freq: 880, at: 0.28 }, // La5
  ]
  for (const n of notes) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = n.freq
    const t = start + n.at
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.65)
  }
}
