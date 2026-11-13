/**
 * Correo del ADMINISTRADOR de la flota.
 * Debe coincidir con el correo escrito en firestore.rules (función isAdminEmail).
 * El script `etapa7-admin-flota.bat` lo reemplaza automáticamente con
 * `node scripts/set-admin-email.mjs tu_correo@gmail.com`.
 *
 * Por seguridad solo cuenta si el correo está VERIFICADO (las cuentas de Google
 * lo están siempre). También es administrador quien tenga role == 'admin' en
 * users/{uid}, asignado a mano desde la consola de Firebase.
 */
export const ADMIN_EMAIL = 'jaidernarvaez@unicomfacauca.edu.co'.toLowerCase()

export const ADMIN_EMAIL_CONFIGURED = !ADMIN_EMAIL.startsWith('tu_correo_admin')
