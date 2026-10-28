import { IPollaGroupEntityFront } from '@helper/polla/types/catalog.type';

/** `2 · Zona norte`: el número del grupo encabeza el de sus pasadores y sus tickets. */
export const groupLabel = (group?: Pick<IPollaGroupEntityFront, 'number' | 'name'> | null) =>
  group ? `${group.number} · ${group.name}` : 'Sin grupo';
