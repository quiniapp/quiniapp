import { POLLA_THEME } from '@helper/polla/types/user.type';

/**
 * Copia local del tema elegido. La fuente de verdad es la DB (viaja en el
 * usuario de sesión); esto solo evita el parpadeo al recargar y pinta el login
 * con el último tema usado en este navegador.
 */
const THEME_CACHE_KEY = 'polla_theme';

const isTheme = (value: unknown): value is POLLA_THEME =>
  value === POLLA_THEME.LIGHT || value === POLLA_THEME.DARK;

export const readCachedTheme = (): POLLA_THEME => {
  try {
    const cached = localStorage.getItem(THEME_CACHE_KEY);
    return isTheme(cached) ? cached : POLLA_THEME.LIGHT;
  } catch {
    return POLLA_THEME.LIGHT;
  }
};

export const applyTheme = (theme: POLLA_THEME) => {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_CACHE_KEY, theme);
  } catch {
    // Sin storage (modo privado, bloqueado): el tema igual queda aplicado.
  }
};
