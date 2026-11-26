# Fechas explícitas, pasador del jugador y juego en el parte diario: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los inputs de fecha de QuiniApp y Polla muestren siempre una fecha que llegue explícita al backend, que la lista de Usuarios de Polla muestre el código del pasador de cada jugador y que el PDF del parte diario diga de qué juego es.

**Architecture:**
- **QuiniApp, selector de fecha:** `SelectDayToSearch` pasa a exigir `selectedDay`, así el compilador marca cualquier pantalla sin fecha.
- **QuiniApp, Cta Cte:** resuelve la fecha inicial con un endpoint nuevo, `GET /current_account/latest-date`, la escribe en la URL y solo después muestra la página.
- **Polla, Usuarios:** el código del pasador se arma en la API, a partir del embebido que ya existe, y el front decide por rol si lo muestra.
- **PDF del parte diario:** los títulos salen de un helper que también usa el nombre del archivo.

**Tech Stack:** Express 5 + Supabase JS (api), React 19 + TanStack Query v5 + react-day-picker v10 (web), React 19 + jsPDF (polla-web), Vitest 5, TypeScript 6.

**Spec:** `docs/superpowers/specs/2026-11-24-fechas-hoy-pasador-juego-design.md`

## Global Constraints

- Rama `feat/fechas-hoy-pasador-juego`, que sale de `develop`. El PR va contra `develop`.
- Antes de usar una librería, consultar su doc actual con Context7, como pide CLAUDE.md.
- Formato del pasador en la lista de Usuarios: `7 · Pedro Gómez (10-938)`, solo si quien mira no es CASHIER ni PLAYER. En la base no se guarda nada.
- Títulos del PDF, con `·` (U+00B7) porque es Latin-1 y jsPDF lo dibuja con sus fuentes estándar:
  - `Polla semanal · Parte diario`;
  - `Polla plus · Parte diario`;
  - `Polla · Parte diario`;
  - `<juego> · Parte diario de grupos`;
  - `Quiniela · Parte diario`.
- La Cta Cte de QuiniApp sin `date` en la URL arranca en la fecha de la última liquidación. Si nunca hubo, arranca en hoy. "Actualizar", "Liquidar" y los exportes usan la fecha de la URL.
- El GET `/current_account` sin fecha no cambia de contrato.
- El filtro "Cargadas desde/hasta" de Polla no se toca.
- Cada workspace tocado actualiza su `CHANGELOG.md` (web, api, helper, polla-web) con fecha 2026-11-24.
- Los tests de web viven en `web/src/__tests__/` y los de polla-web en `polla-web/src/__tests__/`. No se mezclan.
- Typecheck:
  - web: `npx tsc -p web/tsconfig.app.json --noEmit`;
  - polla-web: `npm run typecheck --workspace polla-web`;
  - api: `npx tsc -p api/tsconfig.json --noEmit`. No usar `npm run build` de api, porque deja `.js` en `helper/` que rompen Vite y Vitest.
- Si Vitest falla con "X is not a function" en un export nuevo de helper, hay `.js` viejos en `helper/`. Correr `npm run build --workspace=api` los regenera.

## Review Focus

1. **`latest-date` falla** (500 o red caída): la Cta Cte no puede quedar cargando para siempre. Tiene que arrancar en hoy. Lo cubre el test `error del endpoint → hoy` de la Task 2.
2. **La URL ya trae `date`** (link compartido, volver atrás): no se pide `latest-date` y se respeta la fecha. Test `la URL gana` de la Task 2.
3. **Jugador sin pasador o pasador sin número:** no aparece `()` vacío. Test `sin código no muestra nada` de la Task 4.
4. **Edición nueva creada después de las 21:00:** el cierre de carga queda hoy a las 21:00, antes de la apertura, que es ahora. La validación que ya existe lo frena y el usuario corrige. Verificarlo a mano en la Task 6: el formulario muestra el error y no rompe.
5. **Tocar el día ya elegido en el calendario de QuiniApp:** no puede dejar el input vacío (`required`). Verificarlo a mano en la Task 3.

---

### Task 1: API `GET /current_account/latest-date`

**Files:**
- Modify: `api/src/current-account/repository/current-account.repository.ts` (método nuevo, cerca de `getAllCurrentAccountNetworkHandler`)
- Modify: `api/src/current-account/controller/current-account.controller.ts` (handler nuevo, después de `getAllCurrentAccountNetworkHandler`)
- Modify: `api/src/current-account/route/current-account.route.ts:42-46` (ruta **antes** de `/:id`)
- Modify: `api/CHANGELOG.md`
- Opcional: `api/supabase/migrations/<timestamp>_current_accounts_org_date_idx.sql` (solo si lo pide el paso 4)

**Interfaces:**
- Produces: `GET /api/private/current_account/latest-date` → `200 { data: { date: string | null } }`, con `date` en formato `YYYY-MM-DD`.
- Produces (repository): `getLatestCurrentAccountDate(params: { organization_id: string; network: boolean; user_id?: string; liquidatedOnly?: boolean }): Promise<string | null>`
- Produces (controller): `getLatestCurrentAccountDateHandler(props: { user_type: USER_TYPE; user_id: string; organization_id: string }): Promise<string | null>`

- [ ] **Step 1: Repository.** `getLatestCurrentAccountDate`:
  - Toma los ids de organización: con `network`, de `this.getOrganizationNetworkIds(organization_id)`; si no, `[organization_id]`.
  - Consulta `supabase.from('current_accounts').select('date')`, filtrando la organización con `.eq` si hay un solo id y con `.in` si hay varios. Lleva `.eq('user_id', user_id)` si viene `user_id` y `.eq('is_liquidated', true)` si viene `liquidatedOnly`.
  - Ordena con `.order('date', { ascending: false })`, `.limit(1)` y `.maybeSingle()`.
  - Devuelve `data?.date ?? null`.
- [ ] **Step 2: Controller.** `getLatestCurrentAccountDateHandler` repite el alcance de `getAllCurrentAccountNetworkHandler` y de la vista del pasador:
  - CASHIER: `{ organization_id, network: false, user_id, liquidatedOnly: true }`, la misma fila que hoy devuelve `/:id` sin fecha.
  - CAPITALIST y OWNER: `network: true`.
  - El resto: `network: !(await new UserRepository().isSubOrganization(organization_id))`.
- [ ] **Step 3: Ruta.** `this.router.get('/latest-date', this.getLatestDateHandler)` va **antes** de `this.router.get('/:id', …)`. El handler toma la misma validación de `req.user` y la misma forma de error que `getAllCurrentAccountHandler`. Responde `{ data: { date } }`.
- [ ] **Step 4: Verificar el plan de consulta en local.**
  - Tomar un `organization_id` con filas: `docker exec supabase_db_api psql -U postgres -d postgres -c "select organization_id, count(*) from current_accounts group by 1 order by 2 desc limit 1;"`.
  - Correr `BEGIN; SET LOCAL enable_seqscan = off; EXPLAIN (ANALYZE, BUFFERS) SELECT date FROM current_accounts WHERE organization_id = '<org>' ORDER BY date DESC LIMIT 1; ROLLBACK;`.
  - Esperado: `Index Scan Backward` o `Index Only Scan` sobre `idx_current_accounts_date_org`, o sobre un índice que empiece por `organization_id`, **sin** nodo `Sort`.
  - Si aparece `Sort` debajo de `Limit`, crear la migración `<date +%Y%m%d%H%M%S>_current_accounts_org_date_idx.sql` con:
    - `CREATE INDEX IF NOT EXISTS idx_current_accounts_org_date ON current_accounts (organization_id, date DESC);`
    - `DROP INDEX IF EXISTS idx_current_accounts_organization_id;`, porque el índice nuevo lo cubre como prefijo.
  - Aplicarla en local (`npx supabase db push --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres` desde `api/`) y repetir el EXPLAIN.
- [ ] **Step 5: Typecheck.** Correr `npx tsc -p api/tsconfig.json --noEmit`. Esperado: sin errores.
- [ ] **Step 6: CHANGELOG** de api (Added - 2026-11-24): el endpoint, qué fecha devuelve cada rol, el porqué (la Cta Cte de QuiniApp lo usa para arrancar con la fecha explícita) y la migración, si la hubo.
- [ ] **Step 7: Commit.**

```bash
git add api/src/current-account api/CHANGELOG.md api/supabase/migrations
git commit -m "feat(api): GET /current_account/latest-date para la fecha inicial de Cta Cte"
```

---

### Task 2: QuiniApp, la Cta Cte arranca con la fecha de la última liquidación

**Files:**
- Create: `web/src/features/current-account/resolveDate.ts`
- Create: `web/src/hooks/fetchs/current-account/useGetCurrentAccountLatestDate.ts`
- Create: `web/src/features/current-account/useCurrentAccountDate.ts`
- Modify: `web/routes/routes.ts:52-60` (`current_account.latest_date`)
- Modify: `web/src/features/current-account/index.tsx` (`CurrentAccountContent`)
- Test: `web/src/__tests__/current-account-date.test.ts`

**Interfaces:**
- Consumes: `GET …/current_account/latest-date` (Task 1).
- Produces:
  - `resolveCurrentAccountDate(urlDate: string | null, latest: { status: 'pending' } | { status: 'error' } | { status: 'success'; date: string | null }, today: string): string | null`
  - `useCurrentAccountDate(): string | null`. Devuelve la fecha de la URL; mientras se resuelve, `null`.

- [ ] **Step 1: Test que falla.**

```ts
import { describe, expect, it } from 'vitest';
import { resolveCurrentAccountDate } from '@/features/current-account/resolveDate';

const TODAY = '2026-11-24';

describe('resolveCurrentAccountDate', () => {
  it('la URL gana', () => {
    expect(resolveCurrentAccountDate('2026-11-20', { status: 'pending' }, TODAY)).toBe('2026-11-20');
  });
  it('mientras carga, null', () => {
    expect(resolveCurrentAccountDate(null, { status: 'pending' }, TODAY)).toBeNull();
  });
  it('última liquidación', () => {
    expect(
      resolveCurrentAccountDate(null, { status: 'success', date: '2026-11-22' }, TODAY)
    ).toBe('2026-11-22');
  });
  it('sin liquidaciones → hoy', () => {
    expect(resolveCurrentAccountDate(null, { status: 'success', date: null }, TODAY)).toBe(TODAY);
  });
  it('error del endpoint → hoy', () => {
    expect(resolveCurrentAccountDate(null, { status: 'error' }, TODAY)).toBe(TODAY);
  });
});
```

- [ ] **Step 2: Correr el test y ver que falla.** `npm run test --workspace web -- current-account-date`. Esperado: FAIL porque el módulo no existe.
- [ ] **Step 3: Implementar `resolveCurrentAccountDate`** en `resolveDate.ts`.
- [ ] **Step 4: Correr el test y ver que pasa.** Mismo comando. Esperado: PASS (5 tests).
- [ ] **Step 5: Ruta y hook de fetch.**
  - Ruta: `latest_date: \`${PRIVATE}/current_account/latest-date\``.
  - `useGetCurrentAccountLatestDate(enabled: boolean)`: `useQuery<string | null>` con `queryKey: ['currentAccountLatestDate']`, `queryFn` con `fetchWithAuth` que lee `json.data.date ?? null`, `enabled`, `staleTime: 0` y `retry: 1`.
- [ ] **Step 6: `useCurrentAccountDate`.**
  - Lee `date` de `useSearchParams`.
  - Llama a `useGetCurrentAccountLatestDate(!date)` y arma el estado para `resolveCurrentAccountDate` a partir de `isPending`, `isError` y `data`, con hoy de `dayjs().format('YYYY-MM-DD')`.
  - En un `useEffect`, si no hay `date` en la URL y la fecha resuelta no es `null`, escribe la URL con `params.set('date', resolved)` y `setSearchParams(params, { replace: true })`, conservando los demás params.
  - Devuelve `date ?? null`, que es la fecha de la URL.
- [ ] **Step 7: `CurrentAccountContent`.** Llamar a `useCurrentAccountDate()` al principio, **antes** del `if (role === USER_TYPE.CASHIER)`. Mientras devuelva `null`, renderizar `<LoadingState />` (de `@/components/molecules/LoadingState`). Así la página de superiores, `FilterSection`, `SettlementPayrollTable`, `GenerateLiquitationModal` y `CurrentAcoountByUserTable` siempre leen `date` de la URL, y "Actualizar", "Liquidar" y los exportes la mandan.
- [ ] **Step 8: Typecheck y tests.** Correr `npx tsc -p web/tsconfig.app.json --noEmit` y `npm run test --workspace web`. Esperado: sin errores y todo en PASS.
- [ ] **Step 9: Commit.**

```bash
git add web/routes/routes.ts web/src/features/current-account web/src/hooks/fetchs/current-account web/src/__tests__/current-account-date.test.ts
git commit -m "feat(web): Cta Cte arranca con la fecha de la última liquidación en la URL"
```

---

### Task 3: QuiniApp, `SelectDayToSearch` siempre con fecha

**Files:**
- Modify: `web/src/components/button/SelectDayToSearch.tsx`
- Modify: `web/src/features/plays-and-hits/header-play-and-hits.tsx:30`
- Modify: `web/src/features/results/index.tsx:58-62`
- Modify: `web/src/features/terminal-ticket/form-header-filter.tsx:115-120` (más el destructuring del provider)
- Modify: `web/src/components/filter-section/index.tsx:37,55-60` (`date` pasa a `string`)
- Modify: `web/CHANGELOG.md` (incluye las Tasks 2, 3 y la parte web de la 5)

**Interfaces:**
- Produces: `SelectDayToSearch({ selectedDay: string; onDayChange: (date: string) => void; className?: string; toDate?: Date })`.

- [ ] **Step 1: Componente.**
  - `selectedDay` y `onDayChange` pasan a ser obligatorios y `onDayChange` recibe un `string`.
  - El estado interno sale. El `Date` se deriva de `selectedDay` con `dayjs(selectedDay).toDate()`.
  - Se borran las ramas de "Seleccionar Fecha" y "Fecha".
  - `<Calendar mode="single" required selected={…} onSelect={(d) => onDayChange(dayjs(d).format('YYYY-MM-DD'))} … />`. Con `required`, react-day-picker v10 tipa `onSelect` como `OnSelectHandler<Date>`.
- [ ] **Step 2: Typecheck para listar los llamados rotos.** Correr `npx tsc -p web/tsconfig.app.json --noEmit`. Esperado: errores en plays-and-hits, results, terminal-ticket y en los `onDayChange` que reciben `string | undefined`.
- [ ] **Step 3: Arreglar los llamados.**
  - **plays-and-hits:** `selectedDay={date ?? today.format('YYYY-MM-DD')}`.
  - **results:** `selectedDay={selectedDate}` y `onDayChange={setSelectedDate}`.
  - **terminal-ticket:** tomar `date` de `useTerminalTicket()` y pasar `selectedDay={date ?? dayjs().format('YYYY-MM-DD')}`. El provider ya escribe hoy en la URL al montar.
  - **filter-section:** `const date = searchParams.get('date') ?? dayjs().format('YYYY-MM-DD')`. Con la Task 2, en la Cta Cte la URL siempre la trae.
  - **Modales e `if (!newDate) return`:** simplificar a `(d) => setX(d)` donde el `string` lo permite.
- [ ] **Step 4: Typecheck, lint y tests.** Correr `npx tsc -p web/tsconfig.app.json --noEmit`, `npx eslint web/src/components/button/SelectDayToSearch.tsx web/src/features/plays-and-hits web/src/features/results/index.tsx web/src/features/terminal-ticket/form-header-filter.tsx web/src/components/filter-section/index.tsx` y `npm run test --workspace web`. Esperado: limpio y en PASS.
- [ ] **Step 5: Verificación manual (Review Focus 5).** Con `npm run web`, abrir Jugadas, Resultados y Tickets. Cada botón muestra la fecha de hoy. Al elegir otro día, la consulta se rehace con ese día. Al volver a tocar el día elegido, la fecha sigue ahí.
- [ ] **Step 6: CHANGELOG** de web (Changed - 2026-11-24):
  - el selector con fecha obligatoria y las 3 pantallas;
  - la Cta Cte con la fecha de la última liquidación y los botones sobre la fecha del input (Task 2);
  - `Quiniela · Parte diario` (Task 5).
- [ ] **Step 7: Commit.**

```bash
git add web/src web/CHANGELOG.md
git commit -m "feat(web): el selector de fecha siempre muestra y manda una fecha"
```

---

### Task 4: Polla, código del pasador en la lista de Usuarios

**Files:**
- Modify: `helper/polla/types/user.type.ts` (`IPollaUserEntityFront`)
- Modify: `api/src/polla/user/repository/polla-user.repository.ts:38-88` (`getAll`)
- Modify: `polla-web/src/lib/pollaUsers.ts` (helper nuevo)
- Modify: `polla-web/src/features/users/index.tsx:553-557,593-596`
- Modify: `helper/CHANGELOG.md`, `api/CHANGELOG.md`, `polla-web/CHANGELOG.md`
- Test: `polla-web/src/__tests__/users/list-cashier-code.test.ts`

**Interfaces:**
- Produces (helper): `IPollaUserEntityFront.cashier_code?: string | null`. Para un jugador es `{grupo}-{número}` de su pasador; en el resto, `null`.
- Produces (polla-web): `pollaListCashierCode(user: Pick<IPollaUserEntityFront, 'user_type' | 'cashier_code'>, viewerRole: POLLA_USER_TYPE | null | undefined): string | null`

- [ ] **Step 1: Test que falla.**

```ts
import { describe, expect, it } from 'vitest';
import { POLLA_USER_TYPE } from '@helper/polla/types/user.type';
import { pollaListCashierCode } from '@/lib/pollaUsers';

const player = { user_type: POLLA_USER_TYPE.PLAYER, cashier_code: '10-938' };

describe('pollaListCashierCode', () => {
  it('superiores ven el código del pasador del jugador', () => {
    for (const role of [
      POLLA_USER_TYPE.OWNER,
      POLLA_USER_TYPE.CAPITALIST,
      POLLA_USER_TYPE.SUPERADMIN,
      POLLA_USER_TYPE.ASSISTANT,
      POLLA_USER_TYPE.ADMIN,
    ]) {
      expect(pollaListCashierCode(player, role)).toBe('10-938');
    }
  });
  it('pasador, jugador o sin rol no lo ven', () => {
    expect(pollaListCashierCode(player, POLLA_USER_TYPE.CASHIER)).toBeNull();
    expect(pollaListCashierCode(player, POLLA_USER_TYPE.PLAYER)).toBeNull();
    expect(pollaListCashierCode(player, null)).toBeNull();
  });
  it('solo jugadores', () => {
    expect(
      pollaListCashierCode({ user_type: POLLA_USER_TYPE.CASHIER, cashier_code: '10-938' }, POLLA_USER_TYPE.OWNER)
    ).toBeNull();
  });
  it('sin código no muestra nada', () => {
    expect(pollaListCashierCode({ ...player, cashier_code: null }, POLLA_USER_TYPE.OWNER)).toBeNull();
    expect(pollaListCashierCode({ ...player, cashier_code: '' }, POLLA_USER_TYPE.OWNER)).toBeNull();
    expect(pollaListCashierCode({ user_type: POLLA_USER_TYPE.PLAYER }, POLLA_USER_TYPE.OWNER)).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y ver que falla.** `npm run test --workspace polla-web -- list-cashier-code`. Esperado: FAIL porque el export no existe.
- [ ] **Step 3: Tipo e helper.** Sumar `cashier_code?: string | null` a `IPollaUserEntityFront`, con un JSDoc corto. Implementar `pollaListCashierCode` en `pollaUsers.ts`.
- [ ] **Step 4: Correr el test y ver que pasa.** Mismo comando. Esperado: PASS (4 tests).
- [ ] **Step 5: API.** En `getAll`:
  - El select pasa a `` `${PUBLIC_COLUMNS}, parent:parent_polla_user_id(disabled, number), grp:polla_group_id(number)` ``. El grupo del jugador es el de su pasador, lo sincroniza la base, igual que en el buscador de la línea ~324.
  - El tipo de la fila suma `parent: { disabled: boolean; number: number | null } | null; grp: { number: number } | null`.
  - El map devuelve `cashier_code: user.user_type === POLLA_USER_TYPE.PLAYER && parent ? pollaCashierCode(grp?.number, parent.number) || null : null`, además de `cashier_disabled`. `pollaCashierCode` sale de `@helper/polla/types/user.type`.
- [ ] **Step 6: Front.** En las dos filas de `features/users/index.tsx` (tarjeta del celular y tabla):
  - Después de `{item.name} {item.last_name ?? ''}` va `` {cashierCode && ` (${cashierCode})`} ``, con `const cashierCode = pollaListCashierCode(item, role)`.
  - El nombre se arma con `` `${item.name} ${item.last_name ?? ''}`.trim() `` para que no quede un espacio antes del paréntesis.
  - Resultado: `7 · Pedro Gómez (10-938)`.
- [ ] **Step 7: Verificar en local.**
  - Levantar la API local y polla-web, como dice la memoria polla-local-testing.
  - Loguear `owner/Prueba123` y pedir `GET /api/polla/private/user?user_type=PLAYER` con el header `X-Requested-With: XMLHttpRequest`. Esperado: `jugg383438` con `cashier_code: "10-938"` y los pasadores con `cashier_code: null`.
  - En la pantalla Usuarios, como owner, se ve `N · Nombre (10-938)`. Como `pasg383438` (pasador), sin el paréntesis.
- [ ] **Step 8: Typecheck.** Correr `npm run typecheck --workspace polla-web` y `npx tsc -p api/tsconfig.json --noEmit`. Esperado: sin errores.
- [ ] **Step 9: CHANGELOGs:**
  - helper: el campo `cashier_code`;
  - api: el embebido ampliado en la lista de usuarios;
  - polla-web: el código del pasador en Usuarios, quién lo ve y que no se guarda.
- [ ] **Step 10: Commit.**

```bash
git add helper/polla/types/user.type.ts api/src/polla/user polla-web/src/lib/pollaUsers.ts polla-web/src/features/users/index.tsx polla-web/src/__tests__/users/list-cashier-code.test.ts helper/CHANGELOG.md api/CHANGELOG.md polla-web/CHANGELOG.md
git commit -m "feat(polla): código del pasador junto al jugador en Usuarios"
```

---

### Task 5: Juego en el título del PDF del parte diario

**Files:**
- Modify: `polla-web/src/lib/exportNames.ts`
- Modify: `polla-web/src/functions/current-account/groupDailyReportPDF.ts:102-151` (`title` obligatorio en los dos exports)
- Modify: `polla-web/src/features/current-account/edition/EditionReportDialog.tsx:248,334`
- Modify: `polla-web/src/features/current-account/history/DailyHistoryView.tsx:182`
- Modify: `polla-web/src/features/current-account/edition/GroupEditionAccounts.tsx:1346,1545`
- Modify: `web/src/functions/exportDiarioPDF.ts:40`
- Modify: `polla-web/CHANGELOG.md`
- Test: `polla-web/src/__tests__/current-account/export-names.test.ts` (sumar casos)

**Interfaces:**
- Produces:
  - `pollaProductName(special?: boolean): string`. Devuelve `'Polla semanal'`, `'Polla plus'` o `'Polla'`, y lo pasa a usar `pollaDailyReportName`.
  - `pollaDailyReportTitle(params: { special?: boolean; groups?: boolean }): string`
  - `downloadGroupDailyReportPDF({ …, title: string })` y `downloadGroupRangeReportPDF({ …, title: string })`.

- [ ] **Step 1: Test que falla** (en `export-names.test.ts`).

```ts
describe('pollaDailyReportTitle', () => {
  it('lleva el juego', () => {
    expect(pollaDailyReportTitle({ special: false })).toBe('Polla semanal · Parte diario');
    expect(pollaDailyReportTitle({ special: true })).toBe('Polla plus · Parte diario');
    expect(pollaDailyReportTitle({})).toBe('Polla · Parte diario');
    expect(pollaDailyReportTitle({ special: true, groups: true })).toBe(
      'Polla plus · Parte diario de grupos'
    );
    expect(pollaDailyReportTitle({ groups: true })).toBe('Polla · Parte diario de grupos');
  });
});
```

- [ ] **Step 2: Correr el test y ver que falla.** `npm run test --workspace polla-web -- export-names`. Esperado: FAIL porque `pollaDailyReportTitle` no existe.
- [ ] **Step 3: Implementar `pollaProductName` y `pollaDailyReportTitle`.** `pollaDailyReportName` pasa a usar `pollaProductName`. Sus tests no cambian.
- [ ] **Step 4: Correr el test y ver que pasa.** Mismo comando. Esperado: PASS, con los tests viejos incluidos.
- [ ] **Step 5: Usar los títulos.**
  - **EditionReportDialog:248:** `title: kind === 'summary' ? 'Resumen Cuenta Corriente' : pollaDailyReportTitle({ special })`.
  - **EditionReportDialog:334:** `title: pollaDailyReportTitle({})`.
  - **DailyHistoryView:182:** sumar `title: pollaDailyReportTitle({})`.
  - **GroupEditionAccounts:1545:** `title: pollaDailyReportTitle({ special: isPollaSpecialEdition(current.edition), groups: true })`.
  - **GroupEditionAccounts:1346:** `title: pollaDailyReportTitle({ groups: true })`.
  - **`groupDailyReportPDF.ts`:** los dos `header(doc, 'Parte diario de grupos', …)` pasan a `header(doc, params.title, …)`.
  - **`web/src/functions/exportDiarioPDF.ts:40`:** `doc.text('Quiniela · Parte diario', 14, 14)`.
- [ ] **Step 6: Typecheck y tests.** Correr `npm run typecheck --workspace polla-web`, `npm run test --workspace polla-web` y `npx tsc -p web/tsconfig.app.json --noEmit`. Esperado: sin errores y todo en PASS.
- [ ] **Step 7: Verificar el PDF.** Generar un parte diario de edición en local con el UA de iPhone y el `navigator.share` stubeado, como dice la memoria polla-local-testing. Renderizar la página 1 con pypdfium2. Esperado: el encabezado dice `Polla semanal · Parte diario` y el `·` se ve bien.
- [ ] **Step 8: CHANGELOG** de polla-web (Changed - 2026-11-24): los títulos con el juego. La parte de web va en la Task 3.
- [ ] **Step 9: Commit.**

```bash
git add polla-web/src/lib/exportNames.ts polla-web/src/functions/current-account polla-web/src/features/current-account polla-web/src/__tests__/current-account/export-names.test.ts web/src/functions/exportDiarioPDF.ts polla-web/CHANGELOG.md
git commit -m "feat(polla,web): el parte diario dice de qué juego es"
```

---

### Task 6: Polla, una edición nueva arranca con las fechas en hoy

**Files:**
- Modify: `polla-web/src/features/editions/index.tsx:236-240`
- Modify: `polla-web/CHANGELOG.md`

- [ ] **Step 1: Estado inicial.** El estado inicial de una edición nueva pasa a ser `{ ...emptyForm, start_date: today, end_date: today, load_start_date: today, load_start_time: dayjs().format('HH:mm'), load_limit_date: today }`, con `const today = todayIso()` dentro del inicializador.
- [ ] **Step 2: Typecheck.** Correr `npm run typecheck --workspace polla-web`. Esperado: sin errores.
- [ ] **Step 3: Verificación manual (Review Focus 4).** En Ediciones → Nueva, los cuatro inputs de fecha muestran hoy. Con la hora de apertura después de las 21:00, guardar muestra el error de validación que ya existe y no rompe.
- [ ] **Step 4: CHANGELOG** de polla-web (Changed - 2026-11-24).
- [ ] **Step 5: Commit.**

```bash
git add polla-web/src/features/editions/index.tsx polla-web/CHANGELOG.md
git commit -m "feat(polla): edición nueva con fechas en hoy"
```

---

### Cierre

- [ ] Correr `npm run test --workspace web`, `npm run test --workspace polla-web`, `npm run typecheck --workspace polla-web`, `npx tsc -p web/tsconfig.app.json --noEmit` y `npx tsc -p api/tsconfig.json --noEmit`. Todo verde.
- [ ] Commitear el diseño y el plan (`docs/superpowers/`).
- [ ] Pushear y abrir el PR contra `develop`, solo cuando el usuario lo pida.
