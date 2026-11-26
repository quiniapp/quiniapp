# Fechas explícitas, pasador del jugador y juego en el parte diario

Fecha: 2026-11-24 · Rama: `feat/fechas-hoy-pasador-juego` (desde `develop`)

## Intención

Tres pedidos del usuario:

1. Los inputs de fecha de QuiniApp y Polla tienen que mostrar siempre una fecha (hoy, salvo la Cta Cte de QuiniApp) y esa fecha tiene que llegar explícita al backend. Hoy varios inputs muestran "Seleccionar Fecha" y los hooks o el backend completan con hoy por detrás.
2. En la lista de Usuarios de Polla, cada jugador muestra de qué pasador es. Se concatena al mostrar y no se guarda en el nombre. Lo ven todos los roles menos el pasador y el jugador.
3. El PDF del parte diario dice de qué juego es.

## Decisiones del usuario

- Cta Cte de QuiniApp sin fecha en la URL: el input arranca en la **fecha de la última liquidación**, no en hoy.
- Para obtener esa fecha, un **endpoint nuevo y liviano** (enfoque A).
- "Actualizar" y "Liquidar" actúan **sobre la fecha del input**. Antes, sin fecha, el backend calculaba y liquidaba hoy aunque la tabla mostrara otra fecha.
- El filtro "Cargadas desde/hasta" de Polla (Jugadas y Administrar jugadas) **queda como está**: vacío = todos los días.
- Formato del pasador: **solo el código**, `7 · Pedro Gómez (10-938)`.

## Enfoques considerados (fecha de la última liquidación)

- **A. Endpoint `latest-date` (elegido).** Devuelve una fila usando un índice. El front escribe la fecha en la URL y recién ahí pide la tabla. El front deja de llamar al GET sin fecha, que trae todas las fechas sin LIMIT.
- B. Sin cambios en el backend: seguir pidiendo sin fecha y tomar `data[0].date`. Queda el pedido sin límite y hay un segundo pedido.
- C. Cambiar el GET sin fecha para que devuelva solo el último día. Cambia un contrato que ya existe y la URL se completa recién cuando llegan los datos.

## Diseño

### 1. Fechas

**QuiniApp (`web/`)**
- `SelectDayToSearch`: `selectedDay` pasa a ser obligatorio (`string`). Así el compilador marca cualquier llamada sin fecha, y se va el texto "Seleccionar Fecha". El calendario se configura en modo `required` para que, al tocar el día elegido, no quede vacío. `onDayChange` recibe siempre un `string`.
- Llamadas que hoy no pasan fecha:
  - Jugadas (`header-play-and-hits`): `date ?? hoy`. La URL ya se completa con hoy.
  - Resultados: `selectedDate`, que ya arranca en hoy.
  - Tickets (`terminal-ticket`): `date ?? hoy`. El provider ya pone hoy en la URL al montar.
  - Realizar Jugadas y los modales de impresión ya pasan la fecha.
- Cuenta Corriente: la página de superiores (`current-account/index.tsx` + `FilterSection` + `SettlementPayrollTable` + `GenerateLiquitationModal`) y la del pasador (`CurrentAcoountByUserTable`). Si la URL no trae `date`:
  - se pide `latest-date` y se escribe `date` en la URL con `replace`;
  - si no hay ninguna liquidación, se escribe hoy;
  - las consultas de la tabla corren solo cuando hay fecha;
  - "Actualizar", "Liquidar" y los exportes usan la fecha de la URL, que ahora siempre está.

**API (`api/`)**
- `GET /api/private/current_account/latest-date` → `{ data: { date: 'YYYY-MM-DD' | null } }`. Se registra antes de `/:id`.
  - Superiores: la fecha más reciente de `current_accounts` de la organización, que es la misma que hoy muestra la pantalla (primera fila del orden descendente).
  - Pasador: su última fila con `is_liquidated = true`, que es la misma que hoy devuelve el camino por usuario sin fecha.
  - `LIMIT 1` en la base.
  - Índice: el caso del pasador usa `(organization_id, user_id, date DESC)`. El de la organización se verifica con `EXPLAIN (ANALYZE, BUFFERS)`. Si no entra bien, se hace una migración nueva con `(organization_id, date DESC)` que reemplace a `idx_current_accounts_organization_id`, porque esta última es su prefijo.
- El GET sin fecha no cambia de contrato. Solo deja de usarlo el front.

**Polla (`polla-web/`)**
- Edición nueva: inicio, fin y cierre de carga arrancan en hoy. El inicio de carga ya lo hacía.
- Sin cambios: el filtro "Cargadas desde/hasta" y la "foto" del PDF de tickets, que arranca en el último día sorteado. El resto de los inputs ya arranca en hoy.

### 2. Pasador del jugador en Usuarios (Polla)

- **API, `PollaUserRepository.getAll`.** El embebido del pasador ya existe (`parent:parent_polla_user_id(disabled)`). Se amplía a `parent:parent_polla_user_id(disabled, number, group:polla_group_id(number))`. Con eso se devuelve `cashier_code` (`pollaCashierCode(grupo, número)`, o `null` si no es jugador). No hay consultas extra ni cambios de esquema.
- **Helper.** `IPollaUserEntityFront` suma `cashier_code?: string | null`.
- **Front, `features/users/index.tsx`.** Fila de un jugador con `cashier_code`, mirada por un rol distinto de CASHIER o PLAYER: `7 · Pedro Gómez (10-938)`. Va igual en la tabla y en las tarjetas del celular.

### 3. Juego en el PDF del parte diario

- **Polla.** El título del PDF lleva el juego, con la misma lógica que ya usa el nombre del archivo (`pollaDailyReportName`):
  - `Polla semanal · Parte diario` para la edición regular;
  - `Polla plus · Parte diario` para la especial;
  - `Polla · Parte diario` para el historial por días, que mezcla ediciones;
  - en el parte de grupos, `… · Parte diario de grupos`.
  - Se extrae `pollaProductName(special?)` en `lib/exportNames.ts` para no duplicar la lógica.
- **QuiniApp.** `exportDiarioPDF`: `Quiniela · Parte diario`.
- Los otros reportes (resumen, cobros y pagos, liquidación) no cambian.

## Fuera de alcance

- Guardar el pasador en el nombre del jugador.
- Buscar jugadores por código de pasador.
- Cambiar el filtro de día de carga de Polla.
- Cambiar el contrato del GET sin fecha de la Cta Cte de QuiniApp.

## Queda para quien implemente

- Mirar la doc actual de react-day-picker (`required` en modo single) con Context7.
- Tests: Vitest de web (`SelectDayToSearch`, la elección de la fecha inicial de Cta Cte) y de polla-web (`pollaProductName` / títulos, código del pasador).
- CHANGELOGs de web, api, helper y polla-web.
