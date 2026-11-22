/**
 * La lista con casillas de pasadores de "Exportar liquidación": helpers puros
 * del filtro de grupo y de los elegidos (los mismos que en la Polla).
 */

/** Valor del filtro "Sin grupo". */
export const NO_GROUP = 'none';

/**
 * Los ítems que pasan el filtro de grupo: `''` es "Todos los grupos" y
 * `NO_GROUP`, "Sin grupo". Sin `groupIdOf` no hay filtro.
 */
export const filterByGroup = <T>(
  items: T[],
  groupFilter: string,
  groupIdOf?: (item: T) => string | null
): T[] => {
  if (!groupFilter || !groupIdOf) return items;
  return items.filter((item) =>
    groupFilter === NO_GROUP ? !groupIdOf(item) : groupIdOf(item) === groupFilter
  );
};

/**
 * Sobre los que se actúa: los tildados que se ven con el filtro de grupo de
 * ahora. Un tildado de otro grupo queda tildado (vuelve si se saca el filtro)
 * pero no se exporta.
 */
export const pickedVisible = <T>(visible: T[], selected: Set<string>, idOf: (item: T) => string) =>
  visible.filter((item) => selected.has(idOf(item)));
