import { IPollaEditionEntityFront } from '@helper/polla/types/game.type';
import { fmtMoney } from './format';

/**
 * Debajo del selector de edición, lo que el select no dice: el pozo (y el
 * sorpresa). La cantidad de jugadas es un total de admin: solo se muestra en
 * Administrar (`showCount`).
 */
export const EditionPool = ({
  edition,
  showCount = false,
}: {
  edition: IPollaEditionEntityFront | undefined;
  showCount?: boolean;
}) => {
  if (!edition) return null;

  return (
    <p className="text-xs text-muted-foreground">
      Pozo ${fmtMoney(edition.pool_amount)}
      {Number(edition.surprise_pool_amount ?? 0) > 0 && (
        <span className="font-semibold text-success">
          {` + sorpresa $${fmtMoney(edition.surprise_pool_amount)}`}
        </span>
      )}
      {showCount && edition.bets_count !== undefined && ` · ${edition.bets_count} jugadas`}
    </p>
  );
};
