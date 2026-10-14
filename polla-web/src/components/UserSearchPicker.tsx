import { KeyboardEvent, UIEvent, useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { IPollaUserOption, POLLA_USER_TYPE } from '@helper/polla/types/user.type';
import { useUserSearch } from '@/hooks/fetchs/usePollaData';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { flattenPages } from '@/hooks/useApi';
import { cn } from '@/lib/utils';
import { describePollaUser, pollaUserFullName, pollaUserTypeLine } from '@/lib/pollaUsers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const isDigits = (text: string) => /^\d{1,9}$/.test(text);

/** Cerca del final del panel se pide la página siguiente. */
const LOAD_MORE_THRESHOLD_PX = 40;

interface UserSearchPickerProps {
  id: string;
  label: string;
  /** Tipos que se buscan (pasadores, jugadores o ambos). */
  userTypes: POLLA_USER_TYPE[];
  value: IPollaUserOption | null;
  onChange: (user: IPollaUserOption | null) => void;
  placeholder?: string;
  /** Texto debajo cuando no hay nadie elegido. */
  emptyHint?: string;
  /** Con esto aparece una ✕ para volver a "ninguno" (p. ej. "Todos"). */
  clearLabel?: string;
  /**
   * Escribir suelta al elegido. Lo usa Cargar jugada: mientras se escribe otro
   * número no hay destino, así no se carga a nombre del anterior.
   */
  clearOnType?: boolean;
  /** Enter con alguien elegido (p. ej. pasar a los números). */
  onEnter?: () => void;
  className?: string;
}

/**
 * Buscador de pasadores y jugadores: con solo dígitos busca el número exacto
 * (si hay uno solo, lo elige solo); con letras busca en nombre, apellido y
 * usuario; vacío lista todos para scrollear. Se elige con clic o con ↑/↓ y
 * Enter. Solo para ADMIN y superiores (`GET /user/search`).
 */
export const UserSearchPicker = ({
  id,
  label,
  userTypes,
  value,
  onChange,
  placeholder = 'Número o nombre',
  emptyHint,
  clearLabel,
  clearOnType = false,
  onEnter,
  className,
}: UserSearchPickerProps) => {
  const [text, setText] = useState(value ? String(value.number) : '');
  // `dirty`: lo escrito es una búsqueda y no el número del elegido.
  const [dirty, setDirty] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Con ↑/↓ se eligió una fila a propósito: Enter la toma aunque no se haya
  // escrito nada (si no, Enter con alguien elegido sigue de largo).
  const [navigated, setNavigated] = useState(false);

  const typed = text.trim();
  const debounced = useDebouncedValue(typed, 300);
  // Sin escribir nada se listan todos, así se puede scrollear hasta encontrarlo.
  const query = dirty ? debounced : '';

  const { data, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage } = useUserSearch(
    query,
    userTypes,
    open || (dirty && typed !== '')
  );
  const { rows, totalCount } = flattenPages(data?.pages);
  const ready = !isFetching && (!dirty || debounced === typed);

  // Si el elegido cambia desde afuera (p. ej. al recargar la página con un
  // filtro en la URL), el input muestra su número.
  useEffect(() => {
    if (!dirty) setText(value ? String(value.number) : '');
  }, [value?.polla_user_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setActive(0);
    setNavigated(false);
  }, [query]);

  const pick = useCallback(
    (user: IPollaUserOption) => {
      setText(String(user.number));
      setDirty(false);
      setOpen(false);
      setNavigated(false);
      if (user.polla_user_id !== value?.polla_user_id) onChange(user);
    },
    [onChange, value?.polla_user_id]
  );

  // Un número que corresponde a una sola persona se elige solo: el flujo rápido
  // de escribir el número y seguir con Enter.
  useEffect(() => {
    if (dirty && ready && isDigits(query) && rows.length === 1) pick(rows[0]);
  }, [dirty, ready, query, rows, pick]);

  const handleChange = (next: string) => {
    setText(next);
    setDirty(true);
    setOpen(true);
    if (clearOnType && value) onChange(null);
  };

  /** Esc o salir del campo: si quedó a medio buscar, vuelve el elegido. */
  const dismiss = () => {
    setOpen(false);
    if (dirty && value) {
      setText(String(value.number));
      setDirty(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      else {
        setActive((i) => Math.min(i + 1, Math.max(rows.length - 1, 0)));
        setNavigated(true);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
      setNavigated(true);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const choosing = open && ready && rows[active] && (dirty || navigated || !value);
      if (choosing) pick(rows[active]);
      else if (!dirty && value) onEnter?.();
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      dismiss();
    }
  };

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const panel = e.currentTarget;
    const nearEnd =
      panel.scrollTop + panel.clientHeight >= panel.scrollHeight - LOAD_MORE_THRESHOLD_PX;
    if (nearEnd && hasNextPage && !isFetchingNextPage) fetchNextPage();
  };

  const clear = () => {
    setText('');
    setDirty(false);
    onChange(null);
  };

  let status: { text: string; tone: 'muted' | 'ok' | 'error' } = {
    text: emptyHint ?? '',
    tone: 'muted',
  };
  if (dirty && typed) {
    if (!ready) status = { text: 'Buscando…', tone: 'muted' };
    else if (rows.length === 0) status = { text: 'No hay coincidencias', tone: 'error' };
    else status = { text: 'Elegí uno de la lista', tone: 'muted' };
  } else if (value) {
    status = { text: describePollaUser(value), tone: 'ok' };
  }

  const listId = `${id}-listbox`;
  const optionId = (index: number) => `${id}-option-${index}`;
  const showPanel = open && (rows.length > 0 || !ready);

  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          role="combobox"
          autoComplete="off"
          placeholder={placeholder}
          value={text}
          className={clearLabel && value ? 'pr-9' : undefined}
          onChange={(e) => handleChange(e.target.value.slice(0, 50))}
          onFocus={(e) => {
            setOpen(true);
            e.currentTarget.select();
          }}
          onBlur={dismiss}
          onKeyDown={handleKeyDown}
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && rows[active] ? optionId(active) : undefined}
          aria-invalid={status.tone === 'error'}
          aria-describedby={`${id}-status`}
        />

        {clearLabel && value && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="absolute right-0.5 top-1/2 size-8 -translate-y-1/2"
            title={`Quitar (${clearLabel})`}
            aria-label={`Quitar y ver ${clearLabel.toLowerCase()}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={clear}
          >
            <X />
          </Button>
        )}

        {showPanel && (
          <div
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[min(16rem,45vh)] overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
            onScroll={handleScroll}
          >
            <ul id={listId} role="listbox" aria-label={label}>
              {rows.map((user, index) => (
                <li
                  key={user.polla_user_id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  className={cn(
                    'cursor-pointer rounded-sm px-2 py-2 text-sm',
                    index === active && 'bg-primary text-primary-foreground'
                  )}
                  // mousedown no le saca el foco al input: el blur cerraría el
                  // panel antes del clic.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(user)}
                >
                  <div className="font-medium">
                    {user.number} · {pollaUserFullName(user)}
                  </div>
                  <div
                    className={cn(
                      'text-xs',
                      index === active ? 'opacity-90' : 'text-muted-foreground'
                    )}
                  >
                    {pollaUserTypeLine(user)}
                  </div>
                </li>
              ))}
            </ul>
            <div className="px-2 py-1 text-center text-xs text-muted-foreground">
              {!ready || isFetchingNextPage
                ? 'Cargando…'
                : totalCount > 0
                  ? `${rows.length} de ${totalCount}`
                  : null}
            </div>
          </div>
        )}
      </div>

      <p
        id={`${id}-status`}
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
