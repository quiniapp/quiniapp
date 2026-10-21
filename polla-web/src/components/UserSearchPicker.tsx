import { KeyboardEvent, UIEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import {
  IPollaUserOption,
  POLLA_USER_TYPE,
  POLLA_USER_TYPE_LABEL,
} from '@helper/polla/types/user.type';
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

/** Tipos que se pueden alternar con `typeFilter`. */
const FILTERABLE_TYPES = [POLLA_USER_TYPE.CASHIER, POLLA_USER_TYPE.PLAYER];

interface UserSearchPickerProps {
  id: string;
  label: string;
  /** Tipos que se buscan (pasadores, jugadores o ambos). */
  userTypes: POLLA_USER_TYPE[];
  /**
   * Con esto aparece "Pasador | Jugador" junto al label y se busca solo en el
   * tipo elegido (en lugar de `userTypes`). Al cambiarlo se limpia el texto;
   * soltar al elegido le toca a la página, que también limpia sus filtros.
   */
  typeFilter?: {
    value: POLLA_USER_TYPE;
    onChange: (type: POLLA_USER_TYPE) => void;
  };
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
 * Desplegable de pasadores y jugadores: al hacer clic lista todos ordenados
 * por número (scroll infinito dentro del panel) y lo escrito refina la lista.
 * Con solo dígitos busca el número exacto (si hay uno solo, lo elige solo);
 * con letras busca en nombre, apellido y usuario. Se elige con clic o con ↑/↓
 * y Enter. Solo para ADMIN y superiores (`GET /user/search`).
 */
export const UserSearchPicker = ({
  id,
  label,
  userTypes,
  typeFilter,
  value,
  onChange,
  placeholder = 'Número o nombre',
  emptyHint,
  clearLabel,
  clearOnType = false,
  onEnter,
  className,
}: UserSearchPickerProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
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
    typeFilter ? [typeFilter.value] : userTypes,
    open || (dirty && typed !== '')
  );
  // Mientras llega una búsqueda nueva se sigue viendo la lista anterior
  // (`keepPrevious`); `ready` dice cuándo la lista es la de lo escrito.
  const { rows, totalCount } = flattenPages(data?.pages);
  const ready = !isFetching && (!dirty || debounced === typed);

  const optionId = useCallback((index: number) => `${id}-option-${index}`, [id]);

  // Si el elegido cambia desde afuera (p. ej. al recargar la página con un
  // filtro en la URL), el input muestra su número.
  useEffect(() => {
    if (!dirty) setText(value ? String(value.number) : '');
  }, [value?.polla_user_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setActive(0);
    setNavigated(false);
  }, [query, typeFilter?.value]);

  // Con ↑/↓ la fila activa queda a la vista; al llegar al final, ese scroll
  // pide la página siguiente (`handleScroll`).
  useEffect(() => {
    if (open && navigated) {
      document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
    }
  }, [open, navigated, active, optionId]);

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

  /** El chevron abre y cierra sin sacarle el foco al input. */
  const toggle = () => {
    if (open) {
      dismiss();
      return;
    }
    inputRef.current?.focus();
    setOpen(true);
  };

  const changeType = (type: POLLA_USER_TYPE) => {
    if (!typeFilter || type === typeFilter.value) return;
    setText('');
    setDirty(false);
    typeFilter.onChange(type);
    // Abierto con la lista del tipo nuevo.
    inputRef.current?.focus();
    setOpen(true);
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

  const noMatches = dirty && typed !== '' && ready && rows.length === 0;

  let status: { text: string; tone: 'muted' | 'ok' | 'error' } = {
    text: emptyHint ?? '',
    tone: 'muted',
  };
  if (dirty && typed) {
    if (!ready) status = { text: 'Buscando…', tone: 'muted' };
    else if (noMatches) status = { text: 'Revisá el número o el nombre', tone: 'error' };
    else status = { text: 'Elegí uno de la lista', tone: 'muted' };
  } else if (value) {
    status = { text: describePollaUser(value), tone: 'ok' };
  }

  const listId = `${id}-listbox`;
  const showPanel = open && (rows.length > 0 || !ready || noMatches);
  const showClear = Boolean(clearLabel && value);

  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      {typeFilter ? (
        <div className="flex items-end justify-between gap-2">
          <Label htmlFor={id}>{label}</Label>
          <div
            role="group"
            aria-label="Buscar entre"
            className="inline-flex rounded-md border bg-card p-0.5"
          >
            {FILTERABLE_TYPES.map((type) => {
              const selected = typeFilter.value === type;
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => changeType(type)}
                  className={cn(
                    'rounded px-2 py-0.5 text-xs font-medium transition-colors',
                    selected
                      ? 'bg-nav-active text-nav-active-foreground'
                      : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  {POLLA_USER_TYPE_LABEL[type]}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <Label htmlFor={id}>{label}</Label>
      )}
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          role="combobox"
          autoComplete="off"
          placeholder={placeholder}
          value={text}
          className={showClear ? 'pr-16' : 'pr-9'}
          onChange={(e) => handleChange(e.target.value.slice(0, 50))}
          onFocus={(e) => {
            setOpen(true);
            e.currentTarget.select();
          }}
          // El foco puede haber quedado en el input después de elegir: el clic
          // vuelve a abrir la lista.
          onClick={() => setOpen(true)}
          onBlur={dismiss}
          onKeyDown={handleKeyDown}
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && rows[active] ? optionId(active) : undefined}
          aria-invalid={status.tone === 'error'}
          aria-describedby={`${id}-status`}
        />

        <div className="absolute right-0.5 top-1/2 flex -translate-y-1/2 items-center">
          {showClear && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8"
              title={`Quitar (${clearLabel})`}
              aria-label={`Quitar y ver ${clearLabel?.toLowerCase()}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={clear}
            >
              <X />
            </Button>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 text-muted-foreground"
            tabIndex={-1}
            aria-label={showPanel ? 'Cerrar lista' : 'Abrir lista'}
            // Sin mousedown el input pierde el foco y el blur cerraría la lista.
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggle}
          >
            <ChevronDown className={cn('transition-transform', showPanel && 'rotate-180')} />
          </Button>
        </div>

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
              {noMatches
                ? 'No hay coincidencias'
                : !ready || isFetchingNextPage
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
