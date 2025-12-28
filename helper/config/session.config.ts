/**
 * Configuración de sesión compartida entre frontend y backend
 *
 * IMPORTANTE: No modificar estos valores sin revisar:
 * - web/src/providers/AuthProvider.tsx
 * - api/src/auth/route/auth.route.ts
 * - api/src/config/session.config.ts
 *
 * ACTUALIZADO: Migración a sistema de sesiones JWT personalizado
 */

/**
 * Duración de la sesión en milisegundos (4 horas)
 * La sesión se extiende automáticamente con cada actividad del usuario
 * ACTUALIZADO: Cambió de 3 horas a 4 horas según requerimientos
 */
export const SESSION_DURATION_MS = 4 * 60 * 60 * 1000; // 4 horas

/**
 * Intervalo de validación periódica con el servidor (4 minutos)
 * Se verifica que la sesión siga siendo válida cada este tiempo
 */
export const VALIDATE_INTERVAL_MS = 4 * 60 * 1000; // 4 minutos

/**
 * Tiempo mínimo entre validaciones al volver a la pestaña (10 minutos)
 * Previene validaciones excesivas cuando el usuario cambia de pestaña frecuentemente
 */
export const VISIBILITY_MIN_GAP_MS = 10 * 60 * 1000; // 10 minutos

/**
 * Habilitar validación al volver a la pestaña/ventana
 */
export const VALIDATE_ON_VISIBILITY = true;

/**
 * Eventos del navegador que se consideran como "actividad del usuario"
 * Cualquiera de estos eventos reinicia el contador de inactividad
 */
export const USER_ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
] as const;

/**
 * Duración del refresh token en milisegundos (30 días)
 * Este token se usa para obtener nuevos access tokens
 */
export const REFRESH_TOKEN_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
