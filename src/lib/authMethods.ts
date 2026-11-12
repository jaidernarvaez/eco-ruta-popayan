import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { auth } from './firebase'

/** Ciudadano: acceso inmediato sin correo (no consume cuota de correos). */
export const enterAsCitizen = () => signInAnonymously(auth)

/** Conductor / operador: cuenta de Google. */
export function signInWithGoogle() {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  return signInWithPopup(auth, provider)
}

/** Conductor / operador: correo y contraseña tradicional. */
export const signInWithPassword = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email.trim(), password)

export const registerWithPassword = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email.trim(), password)

/** Único correo que se envía, y solo si el conductor lo pide explícitamente. */
export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email.trim())

/** Traduce los códigos de error de Firebase Auth a mensajes en español. */
export function authErrorMessage(e: unknown): string {
  const code = e instanceof FirebaseError ? e.code : ''
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'No existe una cuenta con ese correo. Usa «Crear cuenta».',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Usa «Ingresar».',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/invalid-email': 'El correo no es válido.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
    'auth/popup-closed-by-user': 'Se cerró la ventana de Google antes de terminar.',
    'auth/cancelled-popup-request': 'Se cerró la ventana de Google antes de terminar.',
    'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes.',
    'auth/operation-not-allowed':
      'Este método de acceso no está habilitado en Firebase (Authentication → Método de acceso).',
    'auth/admin-restricted-operation':
      'El acceso anónimo no está habilitado en Firebase (Authentication → Método de acceso → Anónimo).',
    'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase Authentication.',
    'auth/network-request-failed': 'Sin conexión. Revisa tu internet.',
  }
  return messages[code] ?? (e instanceof Error ? e.message : 'Ocurrió un error inesperado.')
}
