import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Configuración web de Firebase del proyecto "ecoruta-popayan".
// Nota: estas claves web son públicas por diseño; la seguridad real
// se define con las reglas de Firestore y Authentication en la consola.
const firebaseConfig = {
  apiKey: 'AIzaSyBIWj5N4W-A3y4B2JpkkjuHyFPNLQHGp-o',
  authDomain: 'ecoruta-popayan.firebaseapp.com',
  projectId: 'ecoruta-popayan',
  storageBucket: 'ecoruta-popayan.firebasestorage.app',
  messagingSenderId: '596539138279',
  appId: '1:596539138279:web:7c2bd096d6ce23e575c242',
  measurementId: 'G-Y3QX0VEXGG',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
