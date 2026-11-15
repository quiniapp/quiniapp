import { POLLA_LIQUIDATION_NO_GROUP } from '@helper/polla/types/game.type';

/**
 * La lista con casillas de pasadores (exportar o liquidar): helpers puros del
 * filtro de grupo y de los elegidos.
 */

/**
 * Los ítems que pasan el filtro de grupo: `''` es "Todos los grupos" y
 * `POLLA_LIQUIDATION_NO_GROUP`, "Sin grupo". Sin `groupIdOf` no hay filtro.
 */
export const filterByGroup = <T>(
  items: T[],
  groupFilter: string,
  groupIdOf?: (item: T) => string | null
): T[] => {
  if (!groupFilter || !groupIdOf) return items;
  return items.filter((item) =>
    groupFilter === POLLA_LIQUIDATION_NO_GROUP ? !groupIdOf(item) : groupIdOf(item) === groupFilter
  );
};

/**
 * Sobre los que se actúa: los tildados que se ven con el filtro de grupo de
 * ahora. Un tildado de otro grupo queda tildado (vuelve si se saca el filtro)
 * pero no se exporta ni se liquida.
 */
export const pickedVisible = <T>(visible: T[], selected: Set<string>, idOf: (item: T) => string) =>
  visible.filter((item) => selected.has(idOf(item)));
