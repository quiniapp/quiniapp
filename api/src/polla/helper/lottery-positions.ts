import { supabase } from '@database/db.connection';
import { throwIfPollaError } from './polla-errors';

export interface PollaLotteryPosition {
  position: number;
  /** "1 - Nacional". */
  label: string;
}

/**
 * R28: posición (1..N, la que define cada organización) y etiqueta de las
 * quinielas de esas organizaciones (`polla_lottery_positions`). Una quiniela
 * borrada no tiene posición.
 */
export const getLotteryPositions = async (
  organizationIds: string[]
): Promise<Map<string, PollaLotteryPosition>> => {
  const positions = new Map<string, PollaLotteryPosition>();
  const uniqueIds = [...new Set(organizationIds.filter(Boolean))];

  await Promise.all(
    uniqueIds.map(async (organizationId) => {
      const { data, error } = await supabase.rpc('polla_lottery_positions', {
        p_organization_id: organizationId,
      });
      throwIfPollaError(error);
      for (const row of (data ?? []) as {
        polla_lottery_id: string;
        position: number;
        label: string;
      }[]) {
        positions.set(row.polla_lottery_id, { position: row.position, label: row.label });
      }
    })
  );

  return positions;
};

/**
 * Suma `lottery_position` y `lottery_label` a filas que tienen quiniela (por
 * ejemplo, resultados), sin tocar el resto del contrato. Sin posición (quiniela
 * borrada), `null` y la etiqueta queda vacía.
 */
export const withLotteryPositions = async <
  T extends { polla_lottery_id: string; polla_organization_id: string },
>(
  rows: T[]
): Promise<(T & { lottery_position: number | null; lottery_label: string | null })[]> => {
  const positions = await getLotteryPositions(rows.map((row) => row.polla_organization_id));
  return rows.map((row) => {
    const position = positions.get(row.polla_lottery_id);
    return {
      ...row,
      lottery_position: position?.position ?? null,
      lottery_label: position?.label ?? null,
    };
  });
};
