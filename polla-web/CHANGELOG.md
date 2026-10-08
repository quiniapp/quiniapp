# Changelog

All notable changes to the Polla Web workspace are documented in this file.

## [Unreleased]

### Changed - 2026-10-08 (Resultados como QuiniApp)

- **`features/results`**, con la lógica de `web/src/features/results`:
  - Enter pasa siempre a la caja siguiente, también con la caja vacía. Una cifra se completa con cero.
  - En la última caja, Enter guarda si están los 20; si falta alguno, vuelve a la primera vacía.
  - "Guardar resultados" queda deshabilitado hasta tener quiniela, turno y los 20 números. Debajo de la grilla se muestra cuántos van cargados.
  - Un resultado ya cargado se trae a la grilla para editarlo y se guarda como corrección.
  - Guardar no calcula nada: los aciertos y ganadores se calculan con el botón **Generar ganadores** (antes "Procesar aciertos"), que también actualiza la cuenta corriente.

### Changed - 2026-10-06 (Resultados de 2 cifras)

- **`features/results`**: se cargan las 2 cifras que se comparan con las jugadas. Enter pasa a la caja siguiente y en la última guarda. Una cifra sola se completa con cero (7 → 07) al apretar Enter o al salir de la caja. Una caja vacía no avanza y queda marcada.

### Fixed - 2026-10-06

- **`features/editions`**: la confirmación de borrado avisa que se anulan las jugadas de la edición. Al borrar se refrescan jugadas, ventas y cuenta corriente.

### Changed - 2026-10-06 (Segunda tanda del cliente)

#### Roles y versión
- Los tipos de usuario se muestran en español (`POLLA_USER_TYPE_LABEL`) en Usuarios y en el header. El header muestra el nombre y, abajo, el rol del usuario logueado (Dueño, Capitalista, Superadministrador, Administrador, Pasador o Jugador).
- **Versión** como en QuiniApp: `vite.config.ts` define `__COMMIT_DATE__` (la fecha del último commit, declarada en `src/vite-env.d.ts`) y se muestra en el header, el menú mobile y el login.

#### Usuarios
- Solo el pasador crea jugadores: los demás roles ya no tienen la opción "Jugador" ni el select de pasador.
- El número se pide para pasadores y jugadores. Apellido en el alta.
- **`EditUserDialog`**: editar nombre, apellido, usuario, número, grupo, comisión (no la del propio pasador) y deshabilitado. Los deshabilitados se listan para poder volver a habilitarlos.
- **`components/ResetPasswordDialog`**: blanquear la contraseña. Es temporal: el usuario la cambia al entrar.
- El OWNER tiene que elegir una organización antes de dar de alta usuarios.
- Se saca todo lo de créditos: columna, diálogo, saldo del header, `features/my-bets` y sus hooks y rutas.

#### Organizaciones (como QuiniApp)
- Alta de la organización con su capitalista (nombre, apellido, usuario, contraseña, email, teléfono). La tabla muestra el capitalista y tiene las acciones Trabajar acá, Editar, Blanquear contraseña y Eliminar.

#### Cargar jugada
- **`TargetUserByNumber`**: "Cargar a nombre de" se busca por número y muestra "Nombre · jugador de Pasador" o "No existe". Para ADMIN+ es obligatorio; para el pasador es opcional (vacío = a su nombre) y solo encuentra a sus jugadores. Enter pasa a los números.
- El jugador tiene "Repetir última jugada": `RepeatBetDialog` en modo `last` trae su última jugada y deja elegir la edición vigente. ADMIN+ y pasador siguen con "Repetir ticket".

#### Jugadas
- Pasador y jugador eligen entre "Mis jugadas" (por defecto; para el pasador, las suyas y las de sus jugadores) y "Jugando" (todas las del capitalista). Las ajenas llevan el badge "Jugando".
- Eliminar depende de `can_delete`: el pasador da de baja en el día lo que no le pagaron. `/mis-jugadas` redirige a `/jugadas?mine=1`.

#### Ventas del día
- **`features/sales`** (`/ventas`, staff): boletas vendidas y recaudado del día. Superadmin y admin ven además el desglose por grupo; el pasador ve lo suyo.

#### Resultados
- Como en la quiniela: 4 cifras exactas y Enter avanza solo con las 4 (con menos, la caja queda marcada). Dos columnas, 1–10 y 11–20, con el número de posición.
- Pasador y jugador ven las 2 últimas cifras.

#### Cuenta corriente (como QuiniApp, sin Arrastre ni Deje)
- **Admin+**:
  - Botones: Exportar diario, Exportar liquidación, Exportar cobros y pagos, Resumen cuenta corriente, Exportar subtotales, Generar liquidación y Actualizar.
  - Filtros: fecha, grupo y nº de pasador.
  - Planilla: Liquidar · Número · Nombre · Pase · Aciertos · Reclamos · Subtotal · Saldo anterior · Cobros · Pagos · Total · Grupo, con total general del día. En mobile, tarjetas.
- **Diálogos**:
  - `LiquidateCashierDialog`: reclamos, gastos, saldo anterior, cobro y pago, más los tickets del día y las ganadoras.
  - `GenerateLiquidationDialog`: reclamos, cobros y pagos de todos; después liquida el día.
  - `ReportDialog`: cobros y pagos, resumen y subtotales, por día o rango, con grupo, gastos guardados y porcentaje.
- **Pasador**: `CashierAccountView` con su liquidación del día, los tickets y las ganadoras, y "Imprimir liquidación".
- **PDFs** en `functions/current-account/`, adaptados de QuiniApp sin Arrastre ni Deje: planilla diaria, resumen por período, liquidaciones (una página por pasador, en un solo PDF) y tickets térmicos de cobros y pagos y de subtotales.
- Dependencia nueva `jspdf-autotable` (^5.0.2, la misma que `web/`).

### Added - 2026-10-05 (ESLint)

#### Config de ESLint propia
Hasta ahora `npm run lint` no analizaba nada: ESLint 9 tomaba la config de la raíz, que solo cubre `api/` y `helper/`, y daba todos los archivos por ignorados.
- **`eslint.config.js`** (flat config): `@eslint/js` recommended, `typescript-eslint` recommended, `react-hooks` recommended, `react-refresh/only-export-components` (con excepción para `buttonVariants`/`badgeVariants` de shadcn), `@typescript-eslint/no-unused-vars` que ignora `_*`, y `eslint-config-prettier` al final.
- **Dependencias de dev**: `eslint`, `@eslint/js`, `typescript-eslint` (fijado en 8.34.0, la versión que ya usa `web/`, para no mover las versiones compartidas del monorepo), `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals` y `eslint-config-prettier`.
- **Scripts**: `lint` y `lint:fix` pasan a `eslint src`. El glob entre comillas simples no funcionaba en Windows (`cmd` las toma literales).
- **Ajustes para dejar el lint en cero**:
  - Se borran los `eslint-disable no-unused-vars`, que con `typescript-eslint` ya no hacen falta, y los de `react/no-array-index-key`, una regla de un plugin que el proyecto no usa.
  - `buildURL` del `apiClient` tipa `params` como `unknown` en vez de `any`.
  - `editionList` de Jugadas va en `useMemo`, porque se recreaba en cada render y disparaba el efecto.
  - Los helpers de casilleros pasan a `lib/betNumbers.ts` y `lib/pollaNumbers.ts`, para que los archivos de componentes solo exporten componentes (Fast Refresh).

### Changed - 2026-10-05 (Ajustes del cliente)

#### Carga de números como en Resultados de QuiniApp
- **`components/PollaNumberBoxes.tsx`**:
  - Se escribe el número y **Enter** pasa a la caja siguiente; ya no salta solo al completar 2 cifras.
  - Una cifra se completa con cero (`5` pasa a `05`) con Enter o al salir de la caja.
  - Enter en la última caja dispara `onSubmit` (carga la jugada o guarda la edición).
  - Se permiten **números repetidos**.
  - Expone `focusFirst()` para volver a la primera caja después de cargar.
- **`features/results`**:
  - Enter pasa al siguiente resultado y en el último guarda.
  - Al elegir fecha, quiniela y turno con un resultado ya cargado, se completa y se guarda como corrección (`PUT`). El botón "Corregir" de la tabla lleva a ese modo.
  - Si un reproceso anula al ganador y reabre la edición, avisa que hay que procesar los días siguientes.

#### Repetir ticket
- **`features/make-bet/RepeatBetDialog.tsx`**: se busca el ticket por número, se ven sus 10 números y se elige la edición donde cargarlos. Los números pasan al formulario para revisarlos antes de cargar. Hook `useBetToRepeat`.

#### Liquidación sin deje
- **`features/current-account`**: se sacan las columnas Arrastre y Recargo, y "Liquidar día" ya no manda `leave`.
- **`features/users`**: se saca el recargo (fee plus) del alta de pasadores y de la tabla.

#### Tema claro y oscuro con alto contraste
- **`styles/index.css` y `tailwind.config.ts`**:
  - Los tokens pasan a canales HSL con `hsl(var(--x) / <alpha-value>)`. Antes `--primary` era hex en un tema y canales en el otro, y `hsl(var(--primary))` se rompía.
  - Dos temas, claro y oscuro aclarado, con contraste AA (≥ 4.5:1) en todos los pares fondo/texto y ≥ 7:1 en el texto principal.
  - Los inputs tienen su propio par (`--input` / `--input-foreground`): son claros con texto casi negro en los dos temas.
  - Tokens nuevos `success`, `hit` (casillero acertado), `row-stripe`, `table-head` y `nav-active`.
  - `darkMode` pasa a `['selector', '[data-theme="dark"]']`: `dark:` sigue al tema elegido, no al del sistema operativo.
- **Componentes UI**: `Input`, `Label`, `CardTitle`, `Button` (outline/destructive/success), `Badge` (variante `success` nueva), `Select` y `Dialog` dejan los colores fijos (`text-white`, `bg-emerald-600`, `bg-red-700`) y usan tokens.
- **`lib/theme.ts`** + **`AuthProvider.setTheme`**: el tema se guarda en la DB (`PUT /auth/preferences`) y se aplica con `data-theme` en `<html>`. La copia en `localStorage` solo evita el parpadeo; `index.html` pinta el fondo del último tema antes de cargar el bundle (antes tenía `#151933` fijo).
- **`features/settings`** (ruta `/configuracion`, todos los roles): elección de tema con vista previa real de cada uno y acceso a Cambiar contraseña.

#### Aciertos marcados y privilegios por rol
- **`features/bets`**:
  - Tabla tipo planilla: Ticket · Coord (grupo) · Pasador · Cliente · Aciertos · un casillero por número (1…10) · Estado · Acciones. Los casilleros acertados van en amarillo con negrita, con la fecha del acierto en el tooltip.
  - En mobile se mantienen las tarjetas.
  - Orden por "Más aciertos" (predeterminado) o "Más recientes".
  - Pasador y jugador ven todas las jugadas con nombres y pueden filtrar "Solo mías" / "Mías y de mis jugadores".
  - Se imprime lo propio y se edita o borra lo que es de uno.
  - La cantidad de jugadas de la edición solo la ve admin+.
- **`components/BetNumbers.tsx`**: la marca es por casillero (`hit_dates`), no por número. Si el 32 se jugó 5 veces y salió 2, se marcan 2.
- **Rutas**: Resultados queda visible para todos los roles y en solo lectura para quien no es admin+. Configuración entra en el menú de todos.

### Added - 2026-09-28 (Frontend propio de la Polla)

#### Workspace nuevo `polla-web/`
App Vite + React independiente para el sistema de Polla, con su propio deploy. Comparte `helper/` con el resto del monorepo y pega contra el mismo backend, bajo `/api/polla`.

- **Infraestructura**: `vite.config.ts` (puerto 5174 para poder levantar QuiniApp y Polla a la vez, proxy `/api` → `localhost:3000`, alias `@` y `@helper`), `tailwind.config.ts` y `postcss.config.js` copiados de `web/` para mantener el mismo diseño, `vercel.json` + `api/api-proxy.ts` con el mismo patrón same-origin y failover (`POLLA_API_BASE_URL` / `POLLA_API_BASE_URL_BACKUP`, con fallback a las de QuiniApp).
- **Auth**: `AuthProvider` propio contra `/api/polla/auth` (cookies `polla_access_token`/`polla_refresh_token`), con revalidación periódica, refresh preventivo y manejo del evento `AUTH_EXPIRED` del `apiClient`. `ProtectedRoute` obliga a cambiar la contraseña temporal antes de usar la app.
- **`RoleRoute`**: el gateo de rol se hace también a nivel de ruta, no solo de menú — en QuiniApp cualquiera puede entrar por URL a una pantalla que el menú le esconde.
- **`src/routes/backend-routes.ts`** vive dentro de `src/`, alcanzable por el alias `@/`; en QuiniApp el archivo equivalente está fuera de `src/` y se importa con rutas relativas de cuatro niveles desde decenas de archivos.
- **Pantallas**:
  - `features/bets`: feed de jugadas de la edición con aciertos marcados número por número, buscador por ticket, filtro por pasador (ADMIN+), impresión del ticket, edición y baja de jugadas, y el panel de ganadores de la edición.
  - `features/my-bets`: vista del jugador con sus jugadas y su historial de créditos.
  - `features/make-bet`: carga de jugada con las 10 cajas de 2 cifras y salto automático; el jugador ve su saldo, ADMIN+ puede cargar a nombre de otro.
  - `features/editions`, `features/results` (carga de los 20 números + botón "Procesar aciertos"), `features/users` (ABM + carga/retiro de créditos con historial), `features/catalogs` (quinielas, turnos y grupos), `features/organizations` (OWNER) y `features/current-account` (pases, premios, comisión, arrastre y liquidación del día).
- **Componentes compartidos**: `PollaNumberBoxes` (movido desde `web/`), `BetNumbers`, `InfiniteList`, `PageHeader`/`EmptyState` y el kit shadcn que se usa.
- **Scroll infinito**: los endpoints son paginados y la UI acumula páginas con `useInfiniteQuery`, igual que QuiniApp. El feed de jugadas usa el cursor keyset (`next_cursor`) en vez de `page`: con offset, una jugada nueva cargada mientras alguien scrollea corre las filas y se repiten o se saltean. El centinela de `InfiniteList` dispara la página siguiente 300px antes del final.
- **Mobile (mínimo 320x480)**: el título de cada sección viaja en el `handle` de la ruta y lo pinta el header, así ninguna pantalla lo repite; el menú se abre encima con backdrop en vez de empujar el contenido; el feed de jugadas se muestra como tarjetas y recién desde `sm` como tabla; los anchos fijos de filtros pasan a `w-full sm:w-[…]`; el panel de los `Select` se limita al ancho disponible y las opciones largas envuelven (antes estiraban el panel y aparecía scroll horizontal).
- **`functions/makePollaTicket.ts`** (movido desde `web/`) y `functions/printPdf.ts`: ticket térmico de 58 mm con los 10 números en 2 columnas x 5 filas; imprime en desktop y comparte en mobile.
- **Data layer**: `useApiQuery`/`useApiMutation` sobre TanStack Query con `keepPreviousData` en las listas filtradas, `staleTime` alto en catálogos y debounce en el buscador de tickets.
