import { useState, type FormEvent } from 'react'
import { ChevronDown, KeyRound, Leaf, Loader2, Mail, MapPinned, Truck } from 'lucide-react'
import {
  authErrorMessage,
  enterAsCitizen,
  registerWithPassword,
  resetPassword,
  signInWithGoogle,
  signInWithPassword,
} from '../lib/authMethods'

type Busy = null | 'citizen' | 'google' | 'password' | 'reset'

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

export default function LoginPage() {
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [showDriver, setShowDriver] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function run(kind: Exclude<Busy, null>, action: () => Promise<unknown>) {
    setBusy(kind)
    setError(null)
    setInfo(null)
    try {
      await action()
    } catch (e) {
      setError(authErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  function onPasswordSubmit(e: FormEvent) {
    e.preventDefault()
    run('password', () => (mode === 'login' ? signInWithPassword(email, password) : registerWithPassword(email, password)))
  }

  function onReset() {
    if (!email.trim()) {
      setError('Escribe tu correo arriba para enviarte el enlace de recuperación.')
      return
    }
    run('reset', async () => {
      await resetPassword(email)
      setInfo('Te enviamos un correo para restablecer la contraseña.')
    })
  }

  const spinner = <Loader2 className="h-4 w-4 animate-spin" />

  return (
    <div className="flex min-h-full items-center justify-center bg-eco-50 p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-6 shadow-lg sm:p-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="rounded-full bg-eco-500/15 p-3">
            <Leaf className="h-8 w-8 text-eco-700" />
          </div>
          <h1 className="text-2xl font-bold text-eco-900">EcoRuta Colombia</h1>
          <p className="text-sm text-slate-600">
            Mira en tiempo real los camiones de recolección de tu ciudad y reporta acumulación de residuos.
          </p>
        </div>

        {/* Acceso principal: ciudadano anónimo, sin correo ni espera */}
        <button
          onClick={() => run('citizen', enterAsCitizen)}
          disabled={busy !== null}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-eco-600 py-3.5 text-base font-semibold text-white shadow hover:bg-eco-700 disabled:opacity-60"
        >
          {busy === 'citizen' ? spinner : <MapPinned className="h-5 w-5" />}
          Entrar como Ciudadano (Acceso rápido)
        </button>
        <p className="-mt-3 text-center text-xs text-slate-500">Sin registro ni correo. Entras directo al mapa.</p>

        {/* Acceso para conductores y operadores */}
        <div className="rounded-xl border border-slate-200">
          <button
            onClick={() => setShowDriver((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700"
            aria-expanded={showDriver}
          >
            <span className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-eco-700" /> Acceso para Conductores / Operadores
            </span>
            <ChevronDown className={`h-4 w-4 transition ${showDriver ? 'rotate-180' : ''}`} />
          </button>

          {showDriver && (
            <div className="space-y-4 border-t border-slate-200 p-4">
              <button
                onClick={() => run('google', signInWithGoogle)}
                disabled={busy !== null}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white py-2.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {busy === 'google' ? spinner : <GoogleLogo />}
                Continuar con Google
              </button>

              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="h-px flex-1 bg-slate-200" /> o con correo y contraseña <span className="h-px flex-1 bg-slate-200" />
              </div>

              <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-medium">
                {(['login', 'register'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`rounded-md py-1.5 ${mode === m ? 'bg-white shadow text-eco-800' : 'text-slate-500'}`}
                  >
                    {m === 'login' ? 'Ingresar' : 'Crear cuenta'}
                  </button>
                ))}
              </div>

              <form onSubmit={onPasswordSubmit} className="space-y-3">
                <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 focus-within:border-eco-600">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="w-full py-2 outline-none"
                  />
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 focus-within:border-eco-600">
                  <KeyRound className="h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'login' ? 'Contraseña' : 'Contraseña (mínimo 6 caracteres)'}
                    className="w-full py-2 outline-none"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy !== null}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 py-2.5 font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
                >
                  {busy === 'password' && spinner}
                  {mode === 'login' ? 'Ingresar' : 'Crear cuenta de conductor'}
                </button>
                {mode === 'login' && (
                  <button type="button" onClick={onReset} className="w-full text-center text-xs text-slate-500 underline">
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </form>
            </div>
          )}
        </div>

        {info && <p className="rounded-lg bg-eco-50 p-3 text-sm text-eco-900">{info}</p>}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </div>
    </div>
  )
}
