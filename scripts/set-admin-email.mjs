// Uso: node scripts/set-admin-email.mjs correo@dominio.com
// Escribe el correo del administrador en src/config/admin.ts y en firestore.rules.
import { readFileSync, writeFileSync } from 'node:fs'

const email = (process.argv[2] ?? '').trim().toLowerCase()
if (!/^[^\s@'"\\]+@[^\s@'"\\]+\.[^\s@'"\\]+$/.test(email)) {
  console.error(`[ERROR] Correo no válido: "${email}"`)
  process.exit(1)
}

const files = {
  'src/config/admin.ts': /export const ADMIN_EMAIL = '[^']*'/,
  'firestore.rules': /(function isAdminEmail\(\) \{\s*return [\s\S]*?== )'[^']*'/,
}

for (const [file, pattern] of Object.entries(files)) {
  const text = readFileSync(file, 'utf8')
  if (!pattern.test(text)) {
    console.error(`[ERROR] No se encontró dónde escribir el correo en ${file}`)
    process.exit(1)
  }
  const updated =
    file === 'firestore.rules'
      ? text.replace(pattern, `$1'${email}'`)
      : text.replace(pattern, `export const ADMIN_EMAIL = '${email}'`)
  writeFileSync(file, updated, 'utf8')
  console.log(`[OK] ${file} → ${email}`)
}
