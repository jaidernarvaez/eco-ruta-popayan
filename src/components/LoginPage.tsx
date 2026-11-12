import { useState, type FormEvent } from 'react'
import { Leaf, Mail, Loader2, CheckCircle2 } from 'lucide-react'
import { sendMagicLink } from '../lib/magicLink'

export default function LoginPage({ linkError }: { linkError: string | null }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(linkError)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setState('sending')
    setError(null)
    try {
      await sendMagicLink(email.trim())
      setState('sent')
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : 'No se pudo enviar el enlace.')
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-eco-50 p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-lg">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="rounded-full bg-eco-500/15 p-3">
            <Leaf className="h-8 w-8 text-eco-700" />
          </div>
          <h1 className="text-2xl font-bold text-eco-900">EcoRuta Colombia</h1>
          <p className="text-sm text-slate-600">
            Recolección de residuos en tiempo real en las principales ciudades de Colombia. Ingresa con tu correo: te enviaremos un enlace mágico, sin contraseñas.
          </p>
        </div>

        {state === 'sent' ? (
          <div className="flex items-start gap-3 rounded-lg bg-eco-50 p-4 text-sm text-eco-900">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              Enviamos un enlace a <strong>{email}</strong>. Ábrelo en este mismo navegador para
              ingresar (revisa también la carpeta de spam).
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Correo electrónico
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-300 px-3 focus-within:border-eco-600">
                <Mail className="h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tucorreo@ejemplo.com"
                  className="w-full py-2 outline-none"
                />
              </div>
            </label>
            <button
              type="submit"
              disabled={state === 'sending'}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-eco-600 py-2.5 font-semibold text-white hover:bg-eco-700 disabled:opacity-60"
            >
              {state === 'sending' && <Loader2 className="h-4 w-4 animate-spin" />}
              Enviar enlace mágico
            </button>
          </form>
        )}

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </div>
    </div>
  )
}
