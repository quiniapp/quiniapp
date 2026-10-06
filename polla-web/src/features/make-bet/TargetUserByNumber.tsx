import { useEffect } from 'react';
import { IPollaUserByNumber, POLLA_USER_TYPE } from '@helper/polla/types/user.type';
import { useUserByNumber } from '@/hooks/fetchs/usePollaData';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TargetUserByNumberProps {
  value: string;
  onChange: (value: string) => void;
  /** Se llama con el usuario encontrado, o `null` mientras no haya uno válido. */
  onResolved: (user: IPollaUserByNumber | null) => void;
  organizationId?: string | null;
  /** Texto cuando el campo queda vacío (p. ej. "vacío = a tu nombre"). */
  emptyHint: string;
  /** Enter con el usuario encontrado: pasar a los números. */
  onEnter?: () => void;
}

const describe = (user: IPollaUserByNumber) => {
  const fullName = `${user.name} ${user.last_name ?? ''}`.trim();
  return user.user_type === POLLA_USER_TYPE.PLAYER
    ? `${fullName} · jugador de ${user.cashier_name}`
    : `${fullName} · pasador`;
};

/**
 * "Cargar a nombre de": se escribe el número del pasador o del jugador y se
 * trae el usuario. El backend acota la búsqueda: ADMIN+ en su organización,
 * el pasador entre sus jugadores.
 */
export const TargetUserByNumber = ({
  value,
  onChange,
  onResolved,
  organizationId,
  emptyHint,
  onEnter,
}: TargetUserByNumberProps) => {
  const number = useDebouncedValue(value.trim(), 300);
  const { data: user, isFetching, isError } = useUserByNumber(number, organizationId);

  // Mientras el número escrito no coincide con el buscado, no hay destino válido.
  const resolved = !isFetching && number === value.trim() && user ? user : null;

  useEffect(() => {
    onResolved(resolved);
  }, [resolved?.polla_user_id]); // eslint-disable-line react-hooks/exhaustive-deps

  let status: { text: string; tone: 'muted' | 'ok' | 'error' } = { text: emptyHint, tone: 'muted' };
  if (value.trim()) {
    if (isFetching || number !== value.trim()) status = { text: 'Buscando…', tone: 'muted' };
    else if (resolved) status = { text: describe(resolved), tone: 'ok' };
    else if (isError)
      status = { text: 'No hay un pasador o jugador con ese número', tone: 'error' };
  }

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="target-user-number">Cargar a nombre de (número)</Label>
      <Input
        id="target-user-number"
        inputMode="numeric"
        autoComplete="off"
        placeholder="Nº de pasador o jugador"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 9))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && resolved) {
            e.preventDefault();
            onEnter?.();
          }
        }}
        aria-invalid={status.tone === 'error'}
        aria-describedby="target-user-status"
      />
      <p
        id="target-user-status"
        role="status"
        className={
          status.tone === 'error'
            ? 'text-xs text-destructive'
            : status.tone === 'ok'
              ? 'text-sm font-semibold text-foreground'
              : 'text-xs text-muted-foreground'
        }
      >
        {status.text}
      </p>
    </div>
  );
};
