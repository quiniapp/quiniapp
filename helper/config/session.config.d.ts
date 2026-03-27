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
export declare const SESSION_DURATION_MS: number;
/**
 * Intervalo de validación periódica con el servidor (4 minutos)
 * Se verifica que la sesión siga siendo válida cada este tiempo
 */
export declare const VALIDATE_INTERVAL_MS: number;
/**
 * Tiempo mínimo entre validaciones al volver a la pestaña (10 minutos)
 * Previene validaciones excesivas cuando el usuario cambia de pestaña frecuentemente
 */
export declare const VISIBILITY_MIN_GAP_MS: number;
/**
 * Habilitar validación al volver a la pestaña/ventana
 */
export declare const VALIDATE_ON_VISIBILITY = true;
/**
 * Eventos del navegador que se consideran como "actividad del usuario"
 * Cualquiera de estos eventos reinicia el contador de inactividad
 */
export declare const USER_ACTIVITY_EVENTS: readonly [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
];
/**
 * Duración del refresh token en milisegundos (30 días)
 * Este token se usa para obtener nuevos access tokens
 */
export declare const REFRESH_TOKEN_DURATION_MS: number;
