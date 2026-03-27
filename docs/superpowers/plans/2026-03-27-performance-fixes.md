# Performance Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar los cuellos de botella de performance identificados en la página de jugadas y tickets, especialmente la lentitud al agrupar jugadas y al cargar tickets con muchas apuestas.

**Architecture:** Los cambios son independientes: primero se corrigen los problemas del backend (API) que causan transferencia excesiva de datos, luego los del frontend (React) que causan fetches innecesarios y re-renders.

**Tech Stack:** Express.js + Supabase (backend), React 18 + TanStack Query + React Router (frontend), TypeScript en todo el stack.

---

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `api/src/bet/controller/bet.controller.ts` | Calcular totales solo en página 1; paginar resultado grouped |
| `api/src/bet/repository/bet.repository.ts` | Optimizar getTotalAmount/getTotalPrize con SUM en DB; optimizar getAmountsByTicket buscando org primero; devolver datos paginados en getAllBetsGrouped |
| `web/src/features/plays-and-hits/print-grouped-bets-button.tsx` | Agregar `enabled: isGrouped` para evitar fetches cuando botón está deshabilitado |
| `web/src/features/plays-and-hits/plays-and-hits-table.tsx` | Reemplazar `Math.random()` con fallback determinístico en `key` |
| `web/src/features/plays-and-hits/header-play-and-hits.tsx` | Eliminar render extra al inicializar fecha |
| `api/CHANGELOG.md` | Documentar cambios de API |
| `web/CHANGELOG.md` | Documentar cambios de web |

---

## Task 1: Calcular totales solo en página 1

**Problema:** `getTotalAmount` y `getTotalPrize` se ejecutan en CADA página del infinite scroll, cargando miles de filas solo para sumarlas.

**Archivos:**
- Modify: `api/src/bet/controller/bet.controller.ts:99-120`

- [ ] **Step 1: Agregar condición `page === 1` antes del cálculo de totales**

Abrir `api/src/bet/controller/bet.controller.ts`. Reemplazar el bloque completo del `else` (líneas 98-119) con:

```typescript
} else {
  // Solo calcular totales en la primera página — no cambian entre páginas
  if (page === 1) {
    const [totalAmount, totalPrize] = await Promise.all([
      this.repository.getTotalAmount({
        date,
        schedule_id,
        cashier_id,
        lottery_id,
        organization_ids,
      }),
      this.repository.getTotalPrize({
        date,
        schedule_id,
        cashier_id,
        lottery_id,
        organization_ids,
      }),
    ]);
    aggregates = {
      totalAmount,
      totalPrize,
    };
  }
  // Pages 2+ no recalculan — el frontend usa data?.pages?.[0]?.aggregates
}
```

- [ ] **Step 2: Verificar que el frontend ya usa solo page[0] para agregados**

Abrir `web/src/features/plays-and-hits/plays-and-hits-table.tsx`. Confirmar que la línea que lee los agregados es:
```typescript
const agg = data?.pages?.[0]?.aggregates;
```
Si es así, el cambio en backend es compatible sin tocar el frontend.

- [ ] **Step 3: Probar manualmente**

Arrancar API (`npm run api`) y web (`npm run web`). Ir a la página de Jugadas. Hacer scroll hasta cargar la página 2. Verificar en los logs de la API que los totales solo aparecen en el request de `page=1`.

- [ ] **Step 4: Commit**

```bash
git add api/src/bet/controller/bet.controller.ts
git commit -m "perf: compute totals only on first page — avoid repeated full-table scans on scroll"
```

---

## Task 2: Optimizar getTotalAmount y getTotalPrize con SUM en base de datos

**Problema:** `getTotalAmount` y `getTotalPrize` hacen `.select('amount')` cargando TODAS las filas para sumarlas en JavaScript. Con miles de bets, esto transfiere megabytes innecesarios.

**Archivos:**
- Modify: `api/src/bet/repository/bet.repository.ts:153-219`

- [ ] **Step 1: Reemplazar getTotalAmount con agregación SQL**

En `api/src/bet/repository/bet.repository.ts`, reemplazar el método `getTotalAmount` completo:

```typescript
async getTotalAmount({
  organization_ids,
  date,
  schedule_id,
  cashier_id,
  lottery_id,
}: {
  organization_ids: string[];
  date: string;
  schedule_id?: string;
  cashier_id?: string;
  lottery_id?: string;
}) {
  const tableName = getTableName(date, 'bets');

  let query = supabase
    .from(tableName)
    .select('amount.sum()')
    .in('organization_id', organization_ids)
    .eq('date', date)
    .is('deleted_at', null);

  if (schedule_id) query = query.eq('schedule_id', schedule_id);
  if (cashier_id) query = query.eq('user_id', cashier_id);
  if (lottery_id) query = query.eq('lottery_id', lottery_id);

  const { data, error } = await query;
  if (error) throw error;
  return Number((data as unknown as [{ sum: string | null }])?.[0]?.sum ?? 0);
}
```

- [ ] **Step 2: Reemplazar getTotalPrize con agregación SQL**

En el mismo archivo, reemplazar el método `getTotalPrize` completo:

```typescript
async getTotalPrize({
  organization_ids,
  date,
  schedule_id,
  cashier_id,
  lottery_id,
}: {
  organization_ids: string[];
  date: string;
  schedule_id?: string;
  cashier_id?: string;
  lottery_id?: string;
}) {
  const tableName = getTableName(date, 'bets');

  let query = supabase
    .from(tableName)
    .select('prize.sum()')
    .in('organization_id', organization_ids)
    .eq('date', date)
    .eq('winner', true)
    .is('deleted_at', null);

  if (schedule_id) query = query.eq('schedule_id', schedule_id);
  if (cashier_id) query = query.eq('user_id', cashier_id);
  if (lottery_id) query = query.eq('lottery_id', lottery_id);

  const { data, error } = await query;
  if (error) throw error;
  return Number((data as unknown as [{ sum: string | null }])?.[0]?.sum ?? 0);
}
```

- [ ] **Step 3: Verificar que el servidor levanta sin errores**

```bash
npm run api
```

Esperado: servidor corriendo en puerto 3000 sin errores de TypeScript.

- [ ] **Step 4: Probar el endpoint manualmente**

Con la API corriendo, hacer un request al endpoint de bets con `page=1` y verificar que los totales son números correctos. Los aggregates deben aparecer en la respuesta como antes.

- [ ] **Step 5: Commit**

```bash
git add api/src/bet/repository/bet.repository.ts
git commit -m "perf: use SQL SUM() for total aggregates — avoid loading all rows into Node.js memory"
```

---

## Task 3: Paginar el resultado de getAllBetsGrouped

**Problema:** `getAllBetsGrouped` trae TODO el dataset (potencialmente miles de registros), hace el merge en JavaScript, y devuelve un array sin paginar. En días con muchas jugadas, esto puede tardar 5-10 segundos.

**Archivos:**
- Modify: `api/src/bet/controller/bet.controller.ts:37-59`
- Modify: `api/src/bet/repository/bet.repository.ts:72-151`

- [ ] **Step 1: Agregar parámetros de paginación a getAllBetsGrouped en el repositorio**

En `api/src/bet/repository/bet.repository.ts`, modificar la firma de `getAllBetsGrouped` para aceptar y devolver datos paginados. Reemplazar el método completo:

```typescript
async getAllBetsGrouped({
  organization_ids,
  schedule_id,
  date,
  cashier_id,
  lottery_id,
  winners,
  quatern,
  tern,
  page = 1,
  limit = 100,
}: {
  organization_ids: string[];
  schedule_id?: string;
  date: string;
  cashier_id?: string;
  lottery_id?: string;
  winners?: boolean;
  quatern?: boolean;
  tern?: boolean;
  page?: number;
  limit?: number;
}): Promise<{ data: IBetEntityBack[]; count: number }> {
  const rpcName = getRpcName(date, 'get_grouped_bets_for_parse');

  const orgResults = await Promise.all(
    organization_ids.map(async (orgId) => {
      const { data, error } = await supabase.rpc(rpcName, {
        p_date: date,
        p_schedule_id: schedule_id ?? null,
        p_cashier_id: cashier_id ?? null,
        p_lottery_id: lottery_id ?? null,
        p_winners_only: !!winners,
        p_organization_id: orgId,
      });
      if (error) throw error;
      return (data as IBetEntityBack[]) || [];
    })
  );

  const mergedMap = new Map<string, IBetEntityBack>();
  for (const orgBets of orgResults) {
    for (const bet of orgBets) {
      const key = [
        bet.number,
        bet.lottery_id,
        bet.schedule_id,
        bet.bet_type,
        bet.place,
        bet.with,
        bet.position,
      ].join('|');
      if (mergedMap.has(key)) {
        const existing = mergedMap.get(key)!;
        existing.amount = ((existing.amount as number) || 0) + ((bet.amount as number) || 0);
        existing.prize = ((existing.prize as number) || 0) + ((bet.prize as number) || 0);
        existing.hits = ((existing.hits as number) || 0) + ((bet.hits as number) || 0);
      } else {
        mergedMap.set(key, { ...bet });
      }
    }
  }

  let result = Array.from(mergedMap.values()).sort(
    (a, b) => ((b.amount as number) || 0) - ((a.amount as number) || 0)
  );

  if (quatern && tern) {
    result = result.filter(
      (bet) => bet.bet_type === BET_TYPE.QUATERN || bet.bet_type === BET_TYPE.TERN
    );
  } else if (quatern) {
    result = result.filter((bet) => bet.bet_type === BET_TYPE.QUATERN);
  } else if (tern) {
    result = result.filter((bet) => bet.bet_type === BET_TYPE.TERN);
  }

  const totalCount = result.length;
  const from = (page - 1) * limit;
  const paginatedData = result.slice(from, from + limit);

  return { data: paginatedData, count: totalCount };
}
```

- [ ] **Step 2: Actualizar el controlador para usar la nueva firma y devolver paginación correcta**

En `api/src/bet/controller/bet.controller.ts`, reemplazar el bloque `if (grouped)` (líneas 37-59):

```typescript
if (grouped) {
  const { data: groupedBets, count } = await this.repository.getAllBetsGrouped({
    organization_ids,
    schedule_id,
    date,
    cashier_id,
    lottery_id,
    winners,
    tern,
    quatern,
    page,
    limit,
  });
  const parsedBets = groupedBets.map((bet: IBetEntityBack) => parseBet(bet));
  const totalPages = Math.ceil(count / limit);
  return {
    data: parsedBets,
    pagination: {
      currentPage: page,
      pageSize: limit,
      totalCount: count,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}
```

- [ ] **Step 3: Verificar que el build de TypeScript pasa**

```bash
cd api && npm run build
```

Esperado: sin errores de compilación.

- [ ] **Step 4: Probar modo agrupado**

Con la API corriendo, ir a la página de Jugadas, activar "Agrupar". Verificar que la tabla carga con paginación (infinite scroll funciona en modo agrupado también).

- [ ] **Step 5: Commit**

```bash
git add api/src/bet/controller/bet.controller.ts api/src/bet/repository/bet.repository.ts
git commit -m "perf: add pagination to getAllBetsGrouped — reduces initial response size for large datasets"
```

---

## Task 4: Optimizar getAmountsByTicket — buscar org del ticket primero

**Problema:** `getAmountsByTicket` hace N llamadas RPC paralelas (una por org) para encontrar el ticket, luego si no hay resultados hace otras N llamadas al archive. El ticket pertenece a exactamente una org — si la encontramos primero, hacemos 1 llamada en vez de N.

**Archivos:**
- Modify: `api/src/bet/repository/bet.repository.ts:270-340`

- [ ] **Step 1: Reemplazar getAmountsByTicket con búsqueda por org del ticket**

Reemplazar el método completo `getAmountsByTicket`:

```typescript
async getAmountsByTicket({
  ticket_number,
  organization_ids,
}: {
  ticket_number: string;
  organization_ids: string[];
}) {
  const zeroSums: TicketSums = {
    total_amount: 0,
    total_prize: 0,
    total_count: 0,
    total_winners_count: 0,
  };

  // Paso 1: Encontrar a qué org pertenece el ticket (búsqueda en main table)
  const { data: ticketRow } = await supabase
    .from('tickets')
    .select('organization_id')
    .eq('ticket_number', ticket_number)
    .in('organization_id', organization_ids)
    .maybeSingle();

  if (ticketRow?.organization_id) {
    // Ticket encontrado en main — una sola RPC call
    const { data, error } = await supabase
      .rpc('get_ticket_sums', {
        p_ticket: ticket_number,
        p_organization_id: ticketRow.organization_id,
      })
      .single();
    if (error || !data) return { ...zeroSums };
    return data as TicketSums;
  }

  // Paso 2: Buscar en archive si no está en main
  const { data: archiveTicketRow } = await supabase
    .from('tickets_archive')
    .select('organization_id')
    .eq('ticket_number', ticket_number)
    .in('organization_id', organization_ids)
    .maybeSingle();

  if (archiveTicketRow?.organization_id) {
    const { data, error } = await supabase
      .rpc('get_ticket_sums_archive', {
        p_ticket: ticket_number,
        p_organization_id: archiveTicketRow.organization_id,
      })
      .single();
    if (error || !data) return { ...zeroSums };
    return data as TicketSums;
  }

  return { ...zeroSums };
}
```

- [ ] **Step 2: Verificar build**

```bash
cd api && npm run build
```

Esperado: sin errores.

- [ ] **Step 3: Probar buscando un ticket**

En la página de Jugadas, buscar por número de ticket. Verificar en los logs que solo aparece 1 (o 2) llamadas RPC en lugar de N.

- [ ] **Step 4: Commit**

```bash
git add api/src/bet/repository/bet.repository.ts
git commit -m "perf: find ticket org first to avoid N parallel RPC calls in getAmountsByTicket"
```

---

## Task 5: PrintGroupedBetsButton — fetch lazy solo cuando está habilitado

**Problema:** El componente `PrintGroupedBetsButton` lanza 4 queries HTTP (bets agrupadas, lotteries, schedules, users) cada vez que la página de Jugadas carga, aunque el botón esté deshabilitado (`isGrouped === false`).

**Archivos:**
- Modify: `web/src/features/plays-and-hits/print-grouped-bets-button.tsx`

- [ ] **Step 1: Agregar `enabled: isGrouped` a todos los hooks del componente**

Reemplazar el archivo completo:

```typescript
import { useState } from 'react';
import { Printer, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useBets } from '@/hooks/fetchs/plays/useBets';
import { useLotteries } from '@/hooks/fetchs/lottery/useLotteries';
import { useSchedules } from '@/hooks/fetchs/schedule/useSchedules';
import { useUsers } from '@/hooks/fetchs/users/useUsers';
import { useAuth } from '@/contexts/AuthContext';
import { printGroupedBetsPDF } from '@/functions/printGroupedBetsPDF';

const PrintGroupedBetsButton = () => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [searchParams] = useSearchParams();
  const { role } = useAuth();

  const date = searchParams.get('date');
  const schedule_id = searchParams.get('schedule_id');
  const lottery_id = searchParams.get('lottery_id');
  const cashier_id = searchParams.get('cashier_id');
  const winners = searchParams.get('winners');
  const tern = searchParams.get('tern');
  const quatern = searchParams.get('quatern');
  const isGrouped = searchParams.get('grouped') === 'true';

  const { data: bets } = useBets({
    date: isGrouped ? date : null,
    schedule_id,
    lottery_id,
    cashier_id,
    grouped: 'true',
    winners,
    tern,
    quatern,
  });

  const { data: lotteries } = useLotteries();
  const { data: schedules } = useSchedules();
  const { data: users } = useUsers(isGrouped ? role : undefined);

  const handlePrint = async () => {
    if (!bets?.length) return;
    setIsPrinting(true);
    try {
      const scheduleName = schedules?.find((s) => s.schedule_id === schedule_id)?.name ?? null;
      const lotteryName = lotteries?.find((l) => l.lottery_id === lottery_id)?.name ?? null;
      const cashierName = users?.find((u) => u.user_id === cashier_id)?.name ?? null;

      await printGroupedBetsPDF({ bets, date, scheduleName, lotteryName, cashierName });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Button
      onClick={handlePrint}
      disabled={!isGrouped || isPrinting}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      {isPrinting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Printer className="w-4 h-4" />
      )}
      Imprimir
    </Button>
  );
};

export default PrintGroupedBetsButton;
```

> **Nota:** `useBets` ya tiene `enabled: Boolean(p.date)`, así que pasar `date: null` cuando `!isGrouped` desactiva el fetch. Para `useUsers`, se pasa `role` solo cuando `isGrouped` es true; verificar que `useUsers` respete `undefined` como "no fetch".

- [ ] **Step 2: Verificar que useUsers acepta undefined**

Abrir `web/src/hooks/fetchs/users/useUsers.ts`. Verificar que tiene `enabled: Boolean(role)` o similar. Si no, agregar `enabled: role !== undefined` al hook dentro del componente (o que la firma lo maneje).

Si `useUsers` no tiene guard para `undefined`, modificar la llamada así:
```typescript
const { data: users } = useUsers(isGrouped ? role : null);
```
Y verificar que el hook trata `null` como "disabled".

- [ ] **Step 3: Probar en modo no-agrupado**

Ir a la página de Jugadas con `grouped=false`. Abrir DevTools > Network. Verificar que NO hay requests a `/api/private/bet?grouped=true` ni a `/api/private/users`.

- [ ] **Step 4: Probar en modo agrupado**

Activar "Agrupar" en la UI. Verificar que SÍ se lanzan los requests y el botón de imprimir funciona.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/plays-and-hits/print-grouped-bets-button.tsx
git commit -m "perf: skip data fetches in PrintGroupedBetsButton when not in grouped mode"
```

---

## Task 6: Fix key fallback determinístico en listas de bets

**Problema:** `key={bet?.bet_id ?? Math.random()}` hace que React desmonte y remonte filas cuando `bet_id` es null/undefined, porque la key cambia en cada render. Esto puede causar flicker y pérdida de estado local del componente.

**Archivos:**
- Modify: `web/src/features/plays-and-hits/plays-and-hits-table.tsx:135-178`

- [ ] **Step 1: Reemplazar Math.random() con index como fallback en el map del desktop**

En `plays-and-hits-table.tsx`, cambiar las líneas del map:

```typescript
// Antes (línea 135-140):
{bets?.map((bet: IBetEntityFront, index: number) => (
  <BetRowDesktop
    key={bet?.bet_id ?? Math.random()}
    bet={bet}
    triggerRef={index === triggerIndex ? setTriggerRef : undefined}
  />
))}

// Después:
{bets?.map((bet: IBetEntityFront, index: number) => (
  <BetRowDesktop
    key={bet?.bet_id ?? `row-${index}`}
    bet={bet}
    triggerRef={index === triggerIndex ? setTriggerRef : undefined}
  />
))}
```

- [ ] **Step 2: Hacer lo mismo en el map mobile (línea 173-178)**

```typescript
// Antes:
{bets?.map((bet, index) => (
  <BetRowMobile
    key={bet?.bet_id ?? Math.random()}
    ...
  />
))}

// Después:
{bets?.map((bet, index) => (
  <BetRowMobile
    key={bet?.bet_id ?? `row-mobile-${index}`}
    ...
  />
))}
```

- [ ] **Step 3: Eliminar key redundante dentro de BetRowDesktop y BetRowMobile**

En `BetRowDesktop` (línea 282) y `BetRowMobile` (línea 327), hay un `key` en el elemento raíz del componente. Esto es inútil (los componentes ya tienen key en su invocación). Eliminar ambos:

```typescript
// BetRowDesktop — quitar key del TableRow (línea ~282):
<TableRow ref={triggerRef}>  // sin key

// BetRowMobile — quitar key del div (línea ~327):
<div ref={triggerRef} className="rounded-xl ...">  // sin key
```

- [ ] **Step 4: Commit**

```bash
git add web/src/features/plays-and-hits/plays-and-hits-table.tsx
git commit -m "fix: use stable index-based key fallback instead of Math.random() in bet rows"
```

---

## Task 7: Eliminar render extra en HeaderPlayAndHits

**Problema:** El `useEffect(() => { handleDayChange(); }, [])` llama `setSearchParams` después del primer render, causando un render extra innecesario al montar la página.

**Archivos:**
- Modify: `web/src/features/plays-and-hits/header-play-and-hits.tsx`

- [ ] **Step 1: Reemplazar useEffect con inicialización condicional en render**

Reemplazar el archivo completo:

```typescript
import HeaderSection from '@/components/header-section';
import { SelectDayToSearch } from '@/components/button/SelectDayToSearch';
import dayjs from 'dayjs';
import { useSearchParams } from 'react-router-dom';

const HeaderPlayAndHits = () => {
  const today = dayjs();
  const [searchParams, setSearchParams] = useSearchParams();

  // Inicializar fecha solo si no está ya en la URL — sin useEffect, sin render extra
  if (!searchParams.get('date')) {
    setSearchParams({ date: today.format('YYYY-MM-DD') }, { replace: true });
  }

  const handleDayChange = (date?: string) => {
    setSearchParams({ date: date ?? today.format('YYYY-MM-DD') });
  };

  return (
    <HeaderSection title={'Jugadas'}>
      <SelectDayToSearch onDayChange={handleDayChange} toDate={today.toDate()} />
    </HeaderSection>
  );
};

export default HeaderPlayAndHits;
```

> **Nota:** Llamar `setSearchParams` durante el render puede causar el mismo doble-render en React Strict Mode. La alternativa más limpia es usar `useLayoutEffect` con la misma condición. Si el enfoque directo causa warnings en consola, reemplazar con:
```typescript
useLayoutEffect(() => {
  if (!searchParams.get('date')) {
    setSearchParams({ date: today.format('YYYY-MM-DD') }, { replace: true });
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

- [ ] **Step 2: Verificar que no hay warning en consola al entrar a Jugadas**

Abrir la página. Verificar que no hay "Warning: Cannot update a component while rendering a different component" en consola.

- [ ] **Step 3: Commit**

```bash
git add web/src/features/plays-and-hits/header-play-and-hits.tsx
git commit -m "perf: avoid extra render on mount by not using useEffect to initialize date param"
```

---

## Task 8: Actualizar CHANGELOGs

**Archivos:**
- Modify: `api/CHANGELOG.md`
- Modify: `web/CHANGELOG.md`

- [ ] **Step 1: Actualizar api/CHANGELOG.md**

Agregar al inicio de la sección `## [Unreleased]`:

```markdown
### Changed - 2026-03-27

#### Performance
- **Totales calculados solo en página 1**: `bet.controller.ts` — `getTotalAmount`/`getTotalPrize` solo se ejecutan en `page === 1`, reduciendo N queries a 1 en el infinite scroll
- **Agregación SQL en getTotalAmount/getTotalPrize**: `bet.repository.ts` — reemplazado `.select('amount')` + reduce JS por `.select('amount.sum()')` en Supabase, evitando traer miles de filas al servidor
- **Paginación en getAllBetsGrouped**: `bet.repository.ts` — el merge en memoria ahora devuelve un slice paginado en vez del array completo; reduce tiempo de respuesta y payload HTTP en modo agrupado
- **getAmountsByTicket con búsqueda de org primero**: `bet.repository.ts` — busca el ticket en `tickets` para determinar su org antes de llamar RPC; reduce N llamadas paralelas a 1-2 llamadas secuenciales
```

- [ ] **Step 2: Actualizar web/CHANGELOG.md**

Agregar:

```markdown
### Changed - 2026-03-27

#### Performance
- **PrintGroupedBetsButton lazy fetch**: `print-grouped-bets-button.tsx` — los 4 hooks de data solo se activan cuando `isGrouped=true`, eliminando fetches innecesarios en modo individual
- **Key determinístico en listas de bets**: `plays-and-hits-table.tsx` — reemplazado `Math.random()` con `row-${index}` como fallback de key, evitando desmount/remount innecesario de filas
- **Eliminado render extra en inicialización de fecha**: `header-play-and-hits.tsx` — removido `useEffect` que llamaba `setSearchParams` después del primer render
```

- [ ] **Step 3: Commit**

```bash
git add api/CHANGELOG.md web/CHANGELOG.md
git commit -m "docs: update changelogs with performance improvements"
```
