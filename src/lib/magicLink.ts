import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
} from 'firebase/auth'
import { auth } from './firebase'

const EMAIL_KEY = 'ecoruta:emailForSignIn'

/** Paso 1: envía el enlace mágico al correo. */
export async function sendMagicLink(email: string) {
  await sendSignInLinkToEmail(auth, email, {
    url: window.location.origin + '/',
    handleCodeInApp: true,
  })
  window.localStorage.setItem(EMAIL_KEY, email)
}

/** Paso 2: si la URL actual es un enlace mágico, completa el inicio de sesión. */
export async function completeMagicLinkIfPresent(): Promise<boolean> {
  const href = window.location.href
  if (!isSignInWithEmailLink(auth, href)) return false

  let email = window.localStorage.getItem(EMAIL_KEY)
  if (!email) {
    // El enlace se abrió en otro navegador o dispositivo
    email = window.prompt('Confirma tu correo para terminar de iniciar sesión') ?? ''
  }
  if (!email) return false

  await signInWithEmailLink(auth, email, href)
  window.localStorage.removeItem(EMAIL_KEY)
  // Limpia los parámetros del enlace de la barra de direcciones
  window.history.replaceState(null, '', window.location.origin + '/')
  return true
}
