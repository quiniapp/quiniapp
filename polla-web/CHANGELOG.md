# Changelog

All notable changes to the Polla Web workspace are documented in this file.

## [Unreleased]

### Added - 2026-11-18

- **Formato Imagen al exportar liquidaciones**: las liquidaciones de pasadores (Exportar liquidación por edición, una o varias, y en Historial por fechas) y de grupos ("Exportar liquidaciones") tienen un selector "Formato: PDF | Imagen".
  - En la computadora, un ZIP de PNG con las mismas carpetas que el de PDF.
  - En el celular, las imágenes salen sueltas por la hoja de compartir (nombre con la carpeta de la edición si se repite). Si el navegador pide un toque nuevo, el botón pasa a "Compartir" y reintenta sin volver a generarlas.
  - Al liquidar grupos se sigue bajando el ZIP de PDF, sin selector.
- Nuevos `lib/liquidationImageLines.ts` (renglones de la imagen), `functions/current-account/liquidationImage.ts` (canvas a PNG), `functions/shareFiles.ts` (portado de QuiniApp), `functions/current-account/liquidationDelivery.ts`, `dialogs/LiquidationFormat.tsx` y `looseFileNames` en `lib/liquidationZip.ts`. `exportLiquidationSlipsZip` y `exportGroupLiquidationsZip` pasan a `prepareLiquidationSlips` y `prepareGroupLiquidations` + `deliverLiquidation`.

### Changed - 2026-11-18 (liquidaciones de grupo en ZIP)

- **Liquidar grupos** (`GroupEditionAccounts.tsx`): al liquidar uno o varios grupos se baja un ZIP con un PDF A4 por grupo, en lugar del ticket de 58 mm.
  - ZIP `polla_liquidaciones_grupos_DD-MM-YYYY.zip` (`polla_plus_…` en una edición especial) con una carpeta raíz del mismo nombre y adentro `Grupo N - Nombre DD-MM-YYYY.pdf`, sin carpetas por grupo.
  - Una sola fecha para el ZIP, la raíz y los archivos: la de la liquidación más nueva de los grupos exportados.
  - La hoja deja pasadores, gastos del grupo (en negativo), total, % admin, total admin y total capitalista, siempre desde la liquidación guardada.
- **"Exportar liquidaciones"** en la pestaña Grupos: elige entre los grupos liquidados (los desactualizados se marcan) y baja el ZIP. `CashierPickDialog` suma la prop `listLabel`.
- **Imprimir de cada fila** de "Liquidaciones de grupo": baja la hoja A4 suelta (sin ZIP); la confirmación de desactualizada ahora dice "Descargar igual".
- Nuevos `lib/groupLiquidation.ts`, `functions/current-account/groupLiquidationPDF.ts` y, en `lib/liquidationZip.ts`, `groupLiquidationZipName` y `groupLiquidationFileName`.

### Removed - 2026-11-18

- Ticket de 58 mm de la liquidación de grupo por edición (`groupEditionTicketLines`, `printGroupEditionLiquidationTicket(s)` en `groupLiquidationTicket.ts`). El ticket del Historial por fechas sigue.

### Added - 2026-11-18 (repetir varios tickets con cargo)

- **Administrar jugadas** (`features/manage-bets/index.tsx`): se tildan tickets y "Repetir con cargo (N)" los carga todos juntos en la edición elegida, con Efectivo o Debe (R04).
  - Aparece para los roles que repiten cuando hay alguna edición con la carga abierta y su corte de repetir (`useEditions` con `loadable`, filtradas por `isPollaEditionRepeatable`), igual que "Repetir ticket" de Cargar jugada.
  - Con cargo se puede tildar cualquier ticket: la base saltea los que no se pueden repetir y se avisan uno por uno.
  - "Repetir sin cargo" (edición finalizada) sigue igual, pero toma solo los tildados que califican y dice cuántos son ("Repetir sin cargo (M)").
  - Al terminar se limpia la selección.
- **`RepeatBetDialog`** (`features/make-bet/RepeatBetDialog.tsx`): modo nuevo `picked`, con la lista de los tickets elegidos y "Cargar N tickets e imprimir". "Repetir ticket" de a uno en Cargar jugada no cambia.
- **`usePollaTicketPrinter`** (`features/bets/usePollaTicketPrinter.ts`): la impresión de los tickets recién cargados (un PDF; el Súper solo ve un aviso, R12) y la etiqueta de la edición destino salen de Cargar jugada para usarlas también en Administrar.

### Fixed - 2026-11-18

- **`RepeatBetDialog`**: con un título de edición largo, el diálogo se desbordaba a la derecha y cortaba el botón de cargar. Ahora el selector trunca el texto.

### Added - 2026-11-18 (parte diario de grupos)

- **"Parte diario"** en la pestaña Grupos (`GroupEditionAccounts.tsx`): PDF de la edición elegida (`downloadGroupDailyReportPDF` en `functions/current-account/groupDailyReportPDF.ts`).
  - Columnas Grupo, Total y $ Admin, con la fila Total y abajo el **Total capitalista**.
  - Encabezado con la edición y la fecha de liquidación (la última de sus grupos).
  - Entran solo los grupos liquidados, con lo guardado al liquidar. Los que tienen algo y no se liquidaron salen en un aviso ("Sin liquidar"), igual que los desactualizados. Los pasadores sin grupo no entran.
  - Nombre: `Polla semanal parte diario grupos DD-MM-YYYY`, o `Polla plus …` si es especial.
- **"Parte diario por rango"**: Desde y Hasta (hasta hoy, como máximo 62 días, Desde ≤ Hasta), por fecha de liquidación (`fetchGroupAccountsRange`).
  - Una fila por edición (Fecha liq., Edición, Total, $ Admin, Capitalista) con TOTAL.
  - Abajo, el "Resumen por grupo" con el Total capitalista.
  - Nombre: `Polla parte diario grupos DD-MM-YYYY al DD-MM-YYYY`.
- Los montos salen con hasta 2 decimales: lo del admin y del capitalista se paga al centavo.
- **Lógica pura** en `lib/groupDailyReport.ts`: `groupReportRows`, `groupReportTotals`, `groupReportDate`, `groupRangeByEdition`, `unliquidatedGroupNames` y `outdatedGroupNames`. Test en `__tests__/current-account/group-daily-report.test.ts`.

### Added - 2026-11-17 (% del admin, liquidar varios grupos y grupos en tabla)

- **% de ganancia del admin** (`features/groups/index.tsx`):
  - campo opcional al crear el grupo con su admin y al asignar un admin nuevo;
  - columna "% admin" en la lista (`10%` o "A mano");
  - "Editar grupo" cambia el nombre y el % del admin (`useUpdateAdminPercentage`, `PUT /user/:id`).
  - También se edita en "Editar usuario" de un admin (`EditUserDialog.tsx`), solo para superadmin, capitalista y dueño.
- **Liquidar un grupo** (`GroupEditionAccounts.tsx`, `LiquidateGroupDialog`): si el admin tiene %, el input viene con ese valor y deshabilitado, con la leyenda "Configurado en el admin del grupo"; si no, se escribe a mano como antes.
- **Liquidar varios grupos:**
  - casilla por grupo y "Seleccionar todos", que tilda los que se pueden liquidar y están sin liquidar o desactualizados (`groupsToSelectAll`). Los liquidados al día se tildan a mano;
  - "Liquidar seleccionados (N)" abre `LiquidateGroupsDialog`: una fila por grupo con su % (fijo o a mano), Admin y Capitalista, más los totales;
  - se liquidan todos juntos (`useLiquidateGroupEditions`) y sale un PDF con un ticket por grupo (`printGroupEditionLiquidationTickets` en `functions/current-account/groupLiquidationTicket.ts`).
- **Pestaña Grupos:**
  - en la computadora es una tabla (casilla, Grupo, % admin, Deja pasadores, Gastos, Total, Admin, Capitalista, Estado y acciones). Los gastos del grupo se cargan en un diálogo;
  - en el celular siguen las tarjetas, con casilla;
  - arriba, y en cada tarjeta, se ve la edición elegida: `Edición <título> · DD/MM/YYYY al DD/MM/YYYY[ · Carga abierta]`.
- **Helpers** (`lib/editionAccount.ts`): `groupLiquidatable`, `groupsToSelectAll` y `groupLiquidationPercentage` (el % del admin fijo o, si no tiene, el de la última liquidación a mano).
- **Test** `__tests__/current-account/group-batch.test.ts`: los helpers y los schemas del %.

### Fixed - 2026-11-17

- **Pestaña Grupos:** al cambiar de edición se veían un momento los grupos de la anterior (la consulta conserva los datos viejos mientras carga). Ahora se muestran solo los de la edición elegida (`polla_edition_id`), para no tildar ni liquidar sobre otra.

### Changed - 2026-11-17 (nombres del parte diario y ZIP con carpeta raíz y fechas)

Pedido del cliente del 17/11: los nombres llevan siempre fecha y el ZIP se descomprime en una sola carpeta.

- **Exportar diario** pasa a llamarse "parte diario". El título del PDF cambia de "Liquidación" a "Parte diario".
  - Una edición: `Polla semanal parte diario DD-MM-YYYY` si es regular, `Polla plus parte diario DD-MM-YYYY` si es especial (`isPollaSpecialEdition`).
  - Varias ediciones: `Polla parte diario DD-MM-YYYY al DD-MM-YYYY`.
  - Historial por fechas: `Polla parte diario DD-MM-YYYY`, o el rango.
  - Con filtro de grupo se suma `Grupo N - Nombre` antes de la fecha.
  - Nombres en `lib/exportNames.ts` (`pollaDailyReportName`, `groupFileLabel`). `downloadDailyAccountsPDF` y `downloadDailySummaryPDF` (`functions/current-account/accountTablePDF.ts`) aceptan `fileName`, y el segundo también `title`.
- **Fecha de una edición** (`editionLiquidationDate` en `lib/editionAccount.ts`): la de su última liquidación de pasadores; si no hay, la marca de liquidada; si tampoco, hoy.
- **ZIP de liquidaciones** (`lib/liquidationZip.ts`, `functions/current-account/liquidationSlipPDF.ts`):
  - El ZIP y su carpeta raíz se llaman igual: `polla_liquidaciones_DD-MM-YYYY` (`polla_plus_liquidaciones_…` en las especiales), `…_DD-MM-YYYY_al_DD-MM-YYYY` en un rango, con `_Grupo_N` o `_Sin_grupo` si hay filtro.
  - Adentro: `Grupo 1 - Leo DD-MM-YYYY/1-6 Laura DD-MM-YYYY.pdf` y `Sin grupo DD-MM-YYYY/`. Si ninguna hoja tiene grupo, los PDF van directo en la raíz.
  - La fecha es la de la liquidación de cada edición (en el historial, el día elegido o el "Hasta").
  - En "Varias ediciones" la carpeta de edición sigue siendo `AAAA-MM-DD <título>`, pero el título se corta en 24 caracteres (antes 40): con la raíz y las fechas, la ruta tiene que entrar en los 260 de Windows.
  - `LiquidationSlipSheet` suma `date`. Las rutas salen de `@helper/functions/liquidationZip`, compartido con QuiniApp.
- **Tests:** `__tests__/current-account/liquidation-zip.test.ts` (raíz, fechas, sin grupos, peor largo de ruta ≤ 185), `export-names.test.ts` (nombres y fecha de liquidación) y `__tests__/helper/quiniela-liquidation-zip.test.ts` (el ZIP de QuiniApp).

### Added - 2026-11-16 (editar cobros y pagos del historial por fecha)

- **Historial por fechas** (`features/current-account/history/DailyHistoryView.tsx`): en modo "Día" y para `POLLA_ACCOUNT_ROLES` (dueño, capitalista y superadmin), cada fila de la tabla y cada tarjeta del celular tiene un botón "Editar" (lápiz). En modo rango no aparece, porque las filas son acumulados.
- **`EditDayPaymentsDialog`** (`features/current-account/history/EditDayPaymentsDialog.tsx`): "Cobros del día" y "Pagos del día".
  - Precarga los montos **del día** (`dayPayments`), no los acumulados del período que muestra la tabla: precargar el acumulado y guardarlo duplicaría la plata de los otros días. Por eso recibe la fila cruda y no `periodView(row)`.
  - Si el día está liquidado avisa "Este día ya está liquidado", y siempre aclara "El saldo de los días siguientes de este pasador se recalcula."
  - Valida con `pollaCurrentAccountPaymentsSchema` antes de mandar; al guardar refresca el historial y muestra "Cobros y pagos actualizados".
  - Debajo de los montos muestra "Saldo del día: $antes → $después" y lo actualiza mientras se escribe. Con un monto inválido o vacío, el después queda en "—".
- **`dayPayments`** (`lib/accountPeriod.ts`, junto a `periodView`): cobros y pagos del día de una fila del historial.
- **`dayBalanceAfter`** (`lib/accountPeriod.ts`): saldo del día con los cobros y pagos nuevos, con la misma diferencia que la base (`total − (cobros nuevos − cobros del día) + (pagos nuevos − pagos del día)`), en centavos.
- **`useEditCurrentAccountPayments`** (`hooks/mutations/usePollaMutations.ts`): `PUT /current_account/:id`, invalida `polla-current-accounts`. Ruta nueva `BACKEND_ROUTES.currentAccount.byId`.
- **Test `__tests__/current-account/history-edit.test.ts`**: el esquema (0, decimales como 0,29, negativos, 3 decimales, vacíos, NaN y el máximo), `dayPayments` (usa el día y no el período) y `dayBalanceAfter` (cobro nuevo, pago nuevo y cobro editado).

### Changed - 2026-11-16 (pollas con la carga abierta en Pollas a liquidar)

- **Pollas a liquidar** (`features/current-account/edition/EditionAccountsView.tsx`): una polla que ya empezó aparece aunque la carga siga abierta, con el badge "Carga abierta" en su tarjeta (`EditionCard`). Así los cobros y pagos se cargan desde el primer día.
- **Detalle de la edición** (`EditionAccountDetail.tsx`): con la carga abierta, "Generar liquidación" queda deshabilitado y debajo dice "La carga todavía no cerró". Los exportes y los movimientos siguen igual.
- **Grupos** (`GroupEditionAccounts.tsx`): con la carga abierta, "Liquidar grupo" queda deshabilitado, con el mismo aviso. En el selector de edición, las de carga abierta dicen "· Carga abierta"; sigue arrancando en la más nueva.
- La base rechaza las dos liquidaciones con la carga abierta: la web no es el único control.
- **Reportes de "Varias ediciones"** (`EditionReportDialog.tsx`, `reportEditionsInRange` en `lib/editionAccount.ts`): las ediciones con la carga abierta no aparecen en la lista ni se exportan (liquidación, cobros y pagos, subtotales, diario y resumen), porque su cuenta todavía se mueve. "Una edición" sigue exportando la del detalle aunque tenga la carga abierta. Test en `__tests__/current-account/edition-account.test.ts`.

### Added - 2026-11-16

- Botón Actualizar en Cuenta corriente (`features/current-account/RefreshAccountButton.tsx`, `refresh.ts`): recarga las consultas de la cuenta que están en pantalla (pasadores, grupos, historial y la vista del pasador). Gira y se deshabilita mientras carga.

### Changed - 2026-11-15 (exportar liquidación en ZIP por carpetas)

- **Exportar liquidación** (`EditionReportDialog.tsx` en "Una edición" y "Varias ediciones", `DailyHistoryView.tsx`): en lugar de un PDF suelto por pasador, baja un solo ZIP (`exportLiquidationSlipsZip` en `liquidationSlipPDF.ts`). Reemplaza las descargas separadas de R01.
  - Carpetas: `Grupo N - Nombre/` (o `Sin grupo/`); con varias ediciones, `<edición>/Grupo N - Nombre/`. Las hojas repetidas llevan ` (2)`, ` (3)`.
  - Nombre del ZIP: `polla_Liquidaciones_<edición | desde_al_hasta | fecha>[_Grupo_N | _Sin_grupo].zip`.
  - En el celular se comparte (`shareFile` en `printPdf.ts`, `sharePdf` pasa por ahí); si se cancela no pasa nada y, si falla o no se puede compartir, se descarga.
  - Usa la dependencia `fflate`, cargada recién al exportar (`lib/liquidationZip.ts`). El ZIP va comprimido (nivel 6): el PDF de jsPDF sale sin comprimir.
  - Ajustes 2026-11-16:
    - Con varias ediciones, la carpeta de cada una es `YYYY-MM-DD <título>` (título cortado a 40 caracteres con `…`; `editionZipFolder`). Las carpetas no se repiten aunque difieran solo en mayúsculas.
    - Dentro del ZIP cada PDF se llama `{código} {nombre}.pdf` (`liquidationZipPdfName`), p. ej. `10-15 María José Fernández.pdf`.
    - En el historial por rango el ZIP se llama `polla_Liquidaciones_<desde>_al_<hasta>.zip`.
    - Si falla el exporte, el error se registra en consola además del aviso.
- **Historial del pasador** (`CashierAccountView.tsx`): sigue bajando su PDF suelto (`downloadLiquidationSlipPDF`).
- Se quita `downloadLiquidationSlipsPDF`.

### Changed - 2026-11-15 (modal al borrar grupo o usuario)

- **Grupos** (`features/groups/index.tsx`): borrar un grupo pide confirmación con un `ConfirmDialog` en lugar del aviso del navegador. Explica que:
  - se borran también su admin, sus pasadores y sus jugadores, y se les cierra la sesión;
  - solo se puede sin jugadas en ediciones en juego y con todo liquidado;
  - lo liquidado queda en el historial;
  - no se puede deshacer.
- **Usuarios** (`features/users/index.tsx`): borrar un usuario usa un `ConfirmDialog` en lugar de "¿Eliminar a X?". Explica:
  - que no va a poder entrar ni jugar y deja de aparecer en listas y buscadores;
  - si es pasador, que sus jugadores no se borran pero sin pasador no van a poder cargar;
  - si es admin, que su grupo queda sin admin;
  - que sus tickets y su cuenta quedan en el historial;
  - que no se puede deshacer, y que si es por un tiempo conviene deshabilitarlo.

### Added - 2026-11-15 (avisos en la cuenta del pasador)

- **Historial por fechas del pasador** (`CashierAccountView.tsx`): la descripción avisa que son liquidaciones por días anteriores al cambio, solo para consultar, y que ahora lo liquidan por edición. Es el mismo aviso que ve el staff.
- **Edición del pasador** (`CashierEditionAccounts.tsx`):
  - Si sus tickets cambiaron desde la liquidación (`differs`), arriba de la lista aparece: "Tus tickets cambiaron desde la liquidación…". El resumen es el de la liquidación y la lista muestra los tickets de hoy, así que pueden no sumar igual.
  - La lista de ediciones muestra "No se pudo cargar." con Reintentar si falla.

### Changed - 2026-11-15 (cuenta por edición en el celular)

- **Detalle de la edición** (`EditionAccountDetail.tsx`):
  - En el celular, una tarjeta por pasador, con pase, comisión, reclamos, subtotal, cobros, pagos, Debe y el estado. Tocarla abre sus movimientos.
  - Abajo va el total general. En la computadora sigue la tabla.
  - Si falla la consulta, "No se pudo cargar." con Reintentar.
  - `RowStatus` junta "Liquidado" y el aviso de cambios.
- **Generar liquidación** (`GenerateEditionLiquidationDialog.tsx`):
  - En el celular, una tarjeta por pasador: casilla, Debe recalculado, pase, comisión y subtotal, y las celdas de reclamos, cobros y pagos con lo que tenía.
  - La celda se comparte con la tabla (`amountInput`).

### Changed - 2026-11-15 (lista de ediciones, Grupos y exportes)

- **Cuenta corriente → Pasadores** (`EditionAccountsView.tsx`):
  - "Pollas a liquidar" se trae en una página (hasta 200).
  - "Liquidaciones realizadas" va con scroll infinito, de a 20 (`useDoneEditionAccounts`, `InfiniteList`).
  - Cada lista muestra "No se pudo cargar." con Reintentar si falla.
  - La tarjeta dice "X de Y pasadores liquidados", contando solo a quienes tienen movimiento, y el Debe separado: "Debe $X · Cobra $Y" (`owedSummary` en `format.ts`).
  - Al generar la liquidación, el detalle sigue abierto aunque la edición pase de una lista a la otra.
- **`useEditionAccountList`**: devuelve una página (`PollaPage`) y acepta `status`, `from`, `to`, `counts` y `limit`.
- **Grupos** (`GroupEditionAccounts.tsx`):
  - El selector de edición pide la lista sin contadores (las 200 más nuevas).
  - Los grupos llegan en una consulta.
  - La lista, los grupos y el historial muestran "No se pudo cargar." con Reintentar.
- **Reportes** (`EditionReportDialog.tsx`):
  - "Varias ediciones" pide al servidor las que empiezan en el rango, sin contadores.
  - Exportar liquidación tiene el filtro de grupo, opcional y con "Todos los grupos" por defecto, para una y para varias ediciones.
  - Con más de 60 ediciones, `fetchEditionTotals` parte el pedido en tandas de 60 (`chunk` en `lib/utils.ts`), en vez de pedir que elijas menos.
- **Tests** (`__tests__/current-account/edition-list.test.ts`): `owedSummary`, `queryErrorMessage` y `chunk`.

### Added - 2026-11-15 (aviso cuando falla una consulta)

- **`App.tsx`**: `QueryCache.onError` muestra un toast con el motivo cada vez que falla una consulta (después del reintento), en toda la app. No avisa la sesión vencida (401), que ya la maneja el `apiClient`. El id del toast evita apilar el mismo aviso.
- **`lib/queryErrors.ts`** (nuevo): `queryErrorMessage`, que da el motivo de la API, "No se pudo conectar con el servidor" sin respuesta, o `null` si es un 401.
- **`ErrorState`** (`components/PageHeader.tsx`): "No se pudo cargar." con el botón Reintentar, para usar en lugar del texto de "vacío" cuando la consulta falló.

### Changed - 2026-11-15 ("Generar liquidación" por edición)

- **Cuenta corriente → Pasadores → detalle de la edición** (`features/current-account/edition/EditionAccountDetail.tsx`):
  - "Generar liquidación" está al lado del buscador de Pasador y abre el modal con los pasadores del filtro.
  - Los exportes quedan en este orden: Exportar diario, Exportar liquidación, Exportar subtotales, Exportar cobros y pagos, Resumen cuenta corriente.
  - Se sacan "Liquidar" y "Marcar como liquidada"/"Desmarcar".
- **`GenerateEditionLiquidationDialog`** (nuevo):
  - Tabla con casilla y "Seleccionar todos". Vienen tildados los que tienen jugadas, borradas o movimientos.
  - Columnas: código y nombre, pase jugadas, borradas, pase, comisión, reclamos, subtotal, cobros, pagos y Debe.
  - En Reclamos, Cobros y Pagos se escribe lo que se suma hoy; al lado se ve lo que ya tenía.
  - El pase, la comisión, el subtotal y el Debe se recalculan al escribir, y abajo está el Debe de los tildados.
  - Un cobro o un pago negativo no deja generar.
  - Al generar, la edición pasa a "Liquidaciones realizadas". Las hojas se bajan con "Exportar liquidación".
  - Si las jugadas cambiaron, muestra las diferencias. Se puede seguir con la liquidación vieja o la nueva, o volver a la tabla sin perder lo escrito.
- **`lib/editionAccount.ts`**:
  - `withNewMovements`: la fila con los movimientos nuevos, con la fórmula de `polla_edition_account_base` y el redondeo de `ROUND`.
  - `parseAmount`: ahora compartido; `GroupEditionAccounts` lo importa de acá.
- **Hooks**: `useGenerateEditionLiquidation` y `BACKEND_ROUTES.editionAccount.generate`.
- **Removed**: `LiquidateEditionDialog.tsx`, `useLiquidateEditionAccounts`, `useSetEditionLiquidated` y las rutas `liquidate` y `liquidated` de `BACKEND_ROUTES`.
- **Tests** (`__tests__/current-account/generate-liquidation.test.ts`): `withNewMovements` (cobro, pago, reclamo positivo y negativo, redondeo), `parseAmount` y el esquema.

### Added - 2026-11-15 (habilitar y deshabilitar usuarios)

- **Usuarios** (`features/users/index.tsx`): en Acciones (tabla y tarjetas) hay un botón para deshabilitar (ícono de prohibido, pide confirmación) o habilitar (ícono de check, sin confirmación). La confirmación avisa que se le cierra la sesión y, si es pasador, que sus jugadores también quedan frenados. Los jugadores de un pasador deshabilitado muestran "Pasador deshabilitado".
- **`useSetUserDisabled`** (`hooks/mutations/usePollaMutations.ts`) y `BACKEND_ROUTES.user.disabled`.
- **Buscadores** (`lib/pollaUsers.ts`, `UserSearchPicker`): en los que filtran, los deshabilitados y los jugadores de un pasador deshabilitado aparecen con "deshabilitado" o "pasador deshabilitado" (`pollaUserBlockedText`). En los de cargar a nombre de otro no aparecen.
- **Repetir** (`lib/repeatReasons.ts`): motivo "su pasador está deshabilitado".
- **Tests** (`__tests__/users/user-disabled.test.ts`): la marca en los buscadores, el esquema y el motivo de repetir.

### Fixed - 2026-11-15 (cantidad de tickets en "Repetir sin cargo")

- **Repetir sin cargo** (`features/bets/FreeRepeatDialog.tsx`): después de cargar, la descripción del diálogo decía "0 tickets" porque la pantalla limpia la selección al terminar. El diálogo ahora guarda los tickets elegidos al abrirse y sigue mostrando cuántos eran.

### Changed - 2026-11-15 (cortesía: dueño, capitalista, superadmin y Súper)

- **Administrar jugadas** (`features/manage-bets/index.tsx`): con una edición finalizada, "Repetir sin cargo" aparece para dueño, capitalista, superadmin y el Súper (toda la organización); el admin de grupo ya no lo ve, pero sigue viendo "Cortesía en Edición X · ticket N". Se puede elegir cualquier ticket de la lista (al Súper le llega la versión pública de cada jugada).
- **Tests** (`__tests__/helper/access.test.ts`): `isPollaCourtesyRole`.

### Changed - 2026-11-15 (liquidación de grupos: total para el admin y para el capitalista)

**Por qué.** Al admin se le paga siempre el 100% de su comisión, y se lo transfiere el capitalista por afuera: "Pagado al admin" era esa misma plata y los ajustes no se usan.

- **Pestaña Grupos** (`features/current-account/edition/GroupEditionAccounts.tsx`):
  - "Base" pasa a "Total" en el modal, la tarjeta del grupo y la tabla "Liquidaciones de grupo".
  - El modal "Liquidar" deja solo el % del admin (sin "Ajustes" ni "Pagado al admin") y muestra "Total para el admin" (el 100% de la comisión) y "Total para el capitalista" (el total menos esa comisión).
  - La tarjeta y la tabla muestran los mismos dos totales en lugar de Comisión, Ajustes, Pagado y Total admin. Una liquidación vieja los tacha, como antes.
- **Ticket del grupo** (`functions/current-account/groupLiquidationTicket.ts`): `printGroupEditionLiquidationTicket` (renglones en `groupEditionTicketLines`) imprime TOTAL, % ADMIN, TOTAL ADMIN y TOTAL CAPITALISTA, sin base, ajustes ni pagado. Sin gastos ya no imprime "$-0". El del Historial por fechas (`printGroupLiquidationTicket`) no cambia y pierde la opción `periodText`, que ya no usa nadie.
- **`groupSplit(total, comisión)`** (`lib/editionAccount.ts`): cuánto es para el admin y cuánto para el capitalista, en centavos exactos.
- **Tests** (`edition-account-helpers.test.ts`): `groupSplit` y los renglones del ticket.

### Changed - 2026-11-15 (R30: dueño, capitalista, superadmin y Súper cargan hasta el sorteo)

- **Cargar jugada** (`features/make-bet/index.tsx`):
  - El aviso "vos podés cargar hasta el …" pasa del admin de grupo a dueño, capitalista, superadmin y Súper, y sale solo cuando su corte es distinto del cierre de carga.
  - "Repetir ticket" y su diálogo ofrecen solo las ediciones donde el usuario todavía repite (`isPollaEditionRepeatable`): entre el cierre y el sorteo dueño, capitalista y superadmin cargan, pero no repiten; el Súper sí repite. Sin ninguna, el botón no aparece.
- **Repetir de cortesía** (`features/bets/FreeRepeatDialog.tsx`): ofrece solo las ediciones donde todavía se puede repetir.
- **Tests** (`__tests__/helper/edition.test.ts`): `isPollaEditionRepeatable`.

### Changed - 2026-11-14 (la cuenta corriente se liquida por edición)

**Qué cambia.** Cuenta corriente deja de liquidarse por rango de días y pasa a liquidarse por edición. Lo liquidado por días queda para consultar.

- **Cuenta corriente (staff)**: pestañas "Pasadores" (por edición), "Grupos" (por edición) e "Historial por fechas" (lo de antes, solo lectura).
  - **Pasadores** (`features/current-account/edition/`): listas "Pollas a liquidar" y "Liquidaciones realizadas"; detalle por edición con movimientos "Cobro", "Pago" y "Reclamo" (fechas `DD/MM/YYYY`); liquidar con aviso de diferencias ("Continuar con el nuevo", "Continuar con el viejo", "Cancelar"); "Marcar como liquidada" y "Desmarcar".
    - **Eliminar un movimiento** (`MovementsDialog.tsx`) pide confirmación en un diálogo de la app con el tipo, el monto y la fecha.
    - **Liquidar** (`CashierPickDialog`): con un filtro de grupo en la lista, se liquida solo a los tildados que se ven, y el botón dice cuántos son. Un tildado de otro grupo sigue tildado (vuelve al sacar el filtro), pero no entra, y la lista lo avisa. "Exportar liquidación", que no tiene filtro, no cambia.
  - **Grupos** (`GroupEditionAccounts.tsx`): cuenta del grupo por edición. Si después de liquidar el grupo cambia lo que dejaron sus pasadores o los gastos de la edición, la tarjeta avisa "Cambió desde la liquidación del grupo" y tacha la Comisión y el Total guardados, y el historial marca esa liquidación. Reimprimir su ticket pide confirmación ("Imprimir igual"). Volver a liquidar lo limpia.
  - **Historial por fechas** (`history/DailyHistoryView.tsx`): la vista por días, sin acciones de escritura.
- **Vista del pasador**: "Por edición" e "Historial por fechas". Solo ve las ediciones donde ya lo liquidaron. Una cuenta en cero dice "Debe $0,00", nunca "Cobra $0,00" (también en el historial y en la hoja de liquidación; `owedWord` en `lib/editionAccount.ts`).
- **Reportes** (`EditionReportDialog.tsx`): de una edición o de varias. Exportar liquidación con varias ediciones descarga sin pedir la lista, con solo las hojas de los pasadores con movimiento de cada edición; con una sola, se elige como siempre.
  - **Varias ediciones, un renglón por edición:** cada renglón lleva el título de su edición, para distinguir dos que empiezan el mismo día (la regular y la especial). En el PDF (`downloadDailySummaryPDF`) la primera columna pasa a "Edición" con `DD/MM · título`; en los tickets de 58 mm (`printRangeTotalsTicket`, `printSubtotalsRangeTicket`) el título va en su propia línea arriba de los números, cortado a 32 caracteres. Sin título (Historial por fechas), salen como antes.
- **`components/ConfirmDialog.tsx`**: confirmación dentro de la app, sobre el `Dialog` de shadcn (no hay `AlertDialog` instalado), en lugar de `window.confirm`.
- **Tests** (`edition-account-helpers.test.ts`): renglones con título, cuenta del grupo vieja, filtro de grupo al liquidar y "Debe" en cero.
- **Gastos por edición** (`EditionExpensesEditor.tsx`): se cargan en cada edición. Los viejos por fecha se ven en el historial.
- **PDF y tickets**: se reusan mapeando la fila de edición a la forma de la fila de período (`lib/editionAccount.ts`).
- **Hooks y rutas**: nuevos en `usePollaData.ts`, `usePollaMutations.ts` y `routes/backend-routes.ts` (`/edition_account`).

- **Vista previa de la comisión del grupo (`lib/editionAccount.ts` `groupCommission`)**: el porcentaje se redondea a 2 decimales antes de calcular, igual que `ROUND(p_percentage, 2)` en SQL (12,345% de 220 da 27,17 y no 27,16).

### Removed - 2026-11-14 (la cuenta corriente se liquida por edición)

- `LiquidationDialogs.tsx` y las acciones de liquidar, recalcular y masivo por días, que dejaron de existir en la API. La cuenta del grupo por días ya no se liquida desde la pantalla.

### Changed - 2026-11-12 (R26, ajuste: mínimo de aciertos editable)

- **Ediciones → Editar**: "Edición especial" y "Mínimo de aciertos" se pueden cambiar con la edición empezada o con ganadores.
  - Si la edición ya terminó, primero pide confirmación porque se recalculan los ganadores y los premios.
  - Con ganadores, se mandan solo el nombre y el mínimo.
- **`useUpdateEdition`**: también refresca las jugadas y los premios.

### Added - 2026-11-11 (R28: orden de las quinielas)

- **Quinielas y turnos**: "Quinielas y su orden" arriba de todo, con el número de cada una y flechas para subir y bajar. El orden se guarda al tocar.
- **Dónde se ve:** tickets, listados, PDF y Resultados muestran "1 - Nacional" con el orden de la organización.
- **Tests** (`lottery-order.test.ts`).

### Changed - 2026-11-11 (R30: el cierre de carga rige para todos los roles)

- **Cargar jugada**:
  - Se saca el aviso "La edición ya está en juego…" y el "vos podés cargar hasta el (último día)" de superadmin y superiores: ya nadie carga con el sorteo en curso.
  - El admin de grupo sigue viendo hasta cuándo carga, que es la hora del sorteo.

### Added - 2026-11-11 (R29: inicio de carga)

- **Ediciones**:
  - El formulario suma "Inicio de carga (fecha)" e "Inicio de carga (hora)". Una edición nueva propone la fecha y hora actuales, y se pueden cambiar para crearla el jueves y que abra el sábado.
  - "Inicio" y "Fin" pasan a decir "Inicio de sorteo" y "Fin de sorteo".
  - La lista muestra la columna "Carga" con "Abre…" y "Cierra…"; en mobile, "Abre la carga" y "Cierre".
- **Cargar jugada**: si no hay ninguna edición abierta, avisa cuándo abre la carga de las próximas.
- **Tests** (`load-start.test.ts`): validación del inicio de carga en los schemas.

### Changed - 2026-11-11 (R33: cortesía una sola vez por ticket)

- **Administrar jugadas**:
  - En lugar del contador de repeticiones sin cargo, cada ticket con cortesía muestra "Cortesía en Edición X · ticket N".
  - Los tickets que ya tienen su cortesía y las cortesías mismas no se pueden elegir para "Repetir sin cargo". "Elegir los N de la lista" los saltea.
- **`FreeRepeatDialog`**: si un ticket ya tenía su cortesía, el resultado dice en qué edición y con qué ticket está, y que para cambiarla hay que borrarla y repetir.
- **`repeatReasons`**: textos de `POLLA_BET_ALREADY_COURTESY` y `POLLA_FREE_REPEAT_OF_COURTESY`.

### Added - 2026-11-11 (R24: PDF de un día puntual)

- **"Compartir PDF" → "Al cierre de un día de sorteo"**: una foto de la edición en un día elegido.
  - **Qué muestra:**
    - los tickets cargados hasta ese día;
    - los aciertos de los sorteos hasta ese día;
    - como ganadora, solo la que ganó ese día o antes; si no, sin premio.
  - **Orden:** por aciertos y, a igual cantidad, lo último cargado primero.
  - **Filtros:** los de Ganadoras y Aciertos se aplican sobre esa foto. Los demás filtros de la lista se respetan.
  - **Días:** se elige entre los días de sorteo que ya pasaron ("Día 1 · 02/11"…), así que también sirve para la polla que se carga y se sortea el mismo sábado.
  - **Dónde está:**
    - en Administrar jugadas, junto a las opciones de siempre (hoy, otra fecha, todas);
    - en Jugadas y en Resultados, que abren el diálogo apenas la edición empieza a sortearse ("Como están ahora" o "Al cierre de un día de sorteo"). Antes de eso, comparten como hasta ahora.
- **`lib/betsSnapshot.ts`**: `snapshotAtDay`, `filterSnapshot` y `pastDrawDays`, que son funciones puras.
- **`editionTicketsPDF.ts`**: con `snapshotDay`, dice "Ganadores al DD/MM/YYYY" o "Al DD/MM/YYYY todavía no había ganadores", y el archivo termina en `_al_DD-MM-YYYY`.
- **`ShareTicketsPdfButton.tsx`**: el diálogo pasa a ser `PdfChoiceDialog` (lista, días de carga o foto de un día). Para la foto pide toda la edición sin rango de carga: la API exige las dos puntas y como mucho 62 días.
- **Tests** (`__tests__/bets/snapshot.test.ts`, 13 casos):
  - carga posterior y del mismo día;
  - aciertos recortados al día;
  - ganadora antes y después de ganar;
  - orden por aciertos y "Más recientes";
  - filtros;
  - días de sorteo pasados.

### Changed - 2026-11-11 (R14: Eliminar impagos también para el staff)

- **Administrar jugadas**:
  - "Eliminar impagos" aparece también para el admin de grupo, el superadmin, el capitalista y el dueño.
  - Para habilitarse, el staff tiene que filtrar un pasador o un jugador, y borra solo lo de ese. El tooltip lo explica.
  - La confirmación muestra a quién se le borran los impagos.
  - El filtro "Impagos" pasa de casilla a switch.
- **`usePollaMutations`**: `UnpaidTarget` / `unpaidQuery` suman `cashier_polla_user_id`.

### Changed - 2026-11-11 (R19: admin en Premios)

- **Premios**: columna "Admin" entre Grupo y Pasador. En mobile, la tarjeta muestra "Grupo · Admin" en una línea y el pasador en la siguiente.

### Changed - 2026-11-06 (R21: el pasador ve los premios de sus jugadores)

- **Premios** también para el admin de grupo, el pasador y el jugador: el ítem del menú aparece para ellos y la API les da solo su alcance.
  - El texto de la pantalla cambia según el rol.
  - Solo superadmin+ tilda pagado.
  - El jugador no ve el filtro de pagados, la columna Pagado ni los totales de pagado.
- **Tests** (`access.test.ts`): la matriz con Premios para cada rol y `pollaPrizeScope`.

### Added - 2026-11-06 (R20: premio pagado / no pagado)

- **Premios** (`features/prizes/index.tsx`):
  - Columna **Pagado**. El dueño, el capitalista y el superadmin tildan la casilla, con una confirmación porque no se destilda. Tildado, muestra cuándo y quién lo marcó.
  - Filtro **Todos | No pagados | Pagados**.
  - Totales de la edición: ganadores, en premios, pagado y falta pagar.
- `useMarkPrizePaid` y la ruta `prize.paid`.

### Added - 2026-11-06 (R19: sección Premios)

- **Premios** (`features/prizes/index.tsx`, ruta `/premios`, ítem del menú debajo de Cuenta corriente): con la edición elegida (en la URL, como Jugadas), la cantidad de ganadores, el total en premios y cada ticket ganador con grupo, pasador, jugador o cliente, número de ticket, aciertos, día en que ganó y monto. Tarjetas en mobile y planilla con total en desktop.
- `usePrizes` y la ruta `prize.base`.

### Removed - 2026-11-06 (R18: premios fuera de la cuenta corriente)

- **Cuenta corriente** (planilla, vista del pasador, liquidar y generar liquidación): se saca la columna **Aciertos**, y del detalle del período, la tabla **Jugadas ganadoras** (`DayBetsTables`). Los textos ya no nombran los aciertos y avisan que los premios están en Premios.
- **PDFs**: la hoja de liquidación (`liquidationSlipPDF.ts`) ya no tiene Aciertos ni la tabla de jugadas ganadoras. El diario y el resumen (`pdf-shared.ts`, `accountTablePDF.ts`) tampoco tienen la columna. Subtotales y cobros y pagos no la tenían.
- `fetchWinnersByCashier` se borra, porque solo armaba la tabla de ganadoras de la hoja. Con eso se va el `limit: 200` que tenía.
- `computeAccountTotals` y `liquidationSlipAmounts` ya no suman premios. El test de las hojas contra la liquidación general sigue andando.

### Changed - 2026-11-05 (R12: sin impresión para el Súper)

- **Cargar jugada** (`features/make-bet/index.tsx`): cuando el Súper cierra un ticket (o repite), no se abre el diálogo de impresión ni el de compartir. Aparece un aviso con el número de ticket y el ticket queda en "Último ticket cargado". Lo puede reimprimir desde Administrar jugadas. Los demás roles no cambian.
- **Repetir ticket** (`RepeatBetDialog`, `prints`): para el Súper el botón dice "Cargar" en lugar de "Cargar e imprimir".

### Changed - 2026-11-05 (R11: el Súper solo carga y administra jugadas)

- **Rutas** (`routes/route.tsx`) y **menú** (`components/layout/AppLayout.tsx`): quién ve cada pantalla sale de `POLLA_PAGE_ROLES`, la misma matriz que usa la API. `routes/pages.ts` mapea cada pantalla a su ruta (`PAGE_PATH`, `homePath`).
- **El Súper** ve en el menú solo Cargar jugada, Administrar jugadas y Configuración. Jugadas, Mis jugadas, Resultados y Revisar ticket lo devuelven a Cargar jugada. Su etiqueta es "Súper".
- **Inicio por rol**: `/`, el login, el cambio de contraseña y las pantallas que no le tocan a un rol llevan a su inicio (`HomeRedirect`, `RoleRoute`): Jugadas, o Cargar jugada para el Súper. Antes iban siempre a Jugadas.
- **Tests** (`src/__tests__/helper/access.test.ts`): la matriz de permisos de cada rol, el inicio y que la API le niegue al Súper los endpoints de las pantallas que no ve.

### Changed - 2026-11-05 (R10: fecha, hora y estado del ticket para todos)

- **Listados** (`BetsList`, en Jugadas, Mis jugadas y Administrar jugadas): cada ticket muestra, para todos los roles, la fecha y hora reales de carga y el estado (**Jugando**, **Ganadora** con su fecha o **No ganó**). El pasador y el staff ven además **Debe**; el jugador no ve el pago. `useBetsEdition` devuelve `editionStatusOf` para saber si la edición terminó.
- **Cargar jugada**: debajo de "Cerrar ticket" aparece el último ticket cargado (o los repetidos), con número, fecha y hora, estado y, salvo para el jugador, Pagado o Debe.
- **Ticket impreso** (`makePollaTicket.ts`, `loadedAt`): imprime la hora de carga y no la de impresión, así una reimpresión dice la misma hora.
- `fmtDateTime` en `features/bets/format.ts`.
- **Tests** (`src/__tests__/helper/bet-status.test.ts`): estado de juego, etiquetas y los schemas de pago.

### Added - 2026-11-05 (R14: borrar tickets impagos de una vez)

- **Administrar jugadas** (`features/manage-bets/index.tsx`): botón **Eliminar impagos**, solo para el pasador. Borra sus tickets en Debe de la edición elegida o, si filtró un jugador, solo los de ese jugador.
  - Antes de borrar pide el resumen y confirma con la cantidad y el monto, y avisa si hay ganadoras en Debe, que no se borran.
  - Si cerró la carga o no hay impagos, lo dice y no borra nada.
- `useDeleteUnpaidBets`, `unpaidQuery` y las rutas `bet.unpaidSummary` y `bet.unpaid`.

### Added - 2026-11-05 (R13: marcar tickets en Debe como pagados)

- **Administrar jugadas** (`features/manage-bets/index.tsx`):
  - Filtro **Impagos** (`payment_status=OWED` en la URL).
  - Botón **Marcar como pago** en cada ticket en Debe que cobra el usuario (`can_mark_paid`), con confirmación porque no se puede deshacer.
  - Con un jugador filtrado: **Marcar todos sus impagos como pagos** en la edición.
- **Listado de jugadas** (`BetsList`): badge **Debe** en los tickets fiados. Solo lo ven el pasador y el staff, porque al jugador no le llega el estado.
- `useMarkBetsPaid` y la ruta `bet.payment`. `useApiMutation` acepta `patch`.

### Added - 2026-11-05 (R04: cerrar ticket con Efectivo o Debe)

- **Cargar jugada** (`features/make-bet/index.tsx`): el botón pasa a "Cerrar ticket" y abre `PaymentDialog` con **Efectivo** y **Debe**. Efectivo tiene el foco, así que Enter lo cierra pagado, como antes. El jugador no ve el diálogo: su ticket queda en Debe.
- **Repetir ticket** (`RepeatBetDialog`): el pasador y el staff eligen Efectivo o Debe para lo que repiten (`choosePayment`).
- **Ticket impreso** (`functions/makePollaTicket.ts`): `paymentStatus` imprime PAGADO o DEBE debajo del valor. No aparece en lo sin cargo ni en el ticket del jugador. La reimpresión de Administrar jugadas también lo lleva.
- **El jugador no imprime**: su ticket se descarga o se comparte como PDF (`sharePdf`), sin el diálogo de impresión.

### Added - 2026-11-05 (R23: elegir qué pasadores exportar; R01: nombre del archivo)

- **Exportar liquidación** (`features/current-account/index.tsx`): antes de descargar se abre `ExportLiquidationsDialog` (`dialogs/ExportLiquidationsDialog.tsx`), con la lista de pasadores, una casilla por cada uno, "Seleccionar todos (N de M)" y el total de cada uno. Se descarga un PDF por pasador elegido (descargas separadas, como hasta ahora).
- **Sin movimiento** (`hasAccountMovement` en `functions/current-account/liquidationSlipPDF.ts`): vienen sin tildar los que tienen en 0 el pase jugadas, las borradas, el pase, el saldo anterior, los cobros, los pagos y el total. Un premio, un reclamo o un gasto sin pase dejan el total distinto de 0, así que ese pasador viene tildado.
- **Nombre del archivo** (`liquidationFileName`): `polla_Exportar_Liquidacion_DD-MM-YYYY_<nombre>-<grupo>-<número>.pdf`. El número de pasador se repite entre grupos, por eso lleva el grupo. Se sacan los caracteres que no admite un nombre de archivo. También aplica a "Imprimir liquidación" del pasador.
- **Jugadas ganadoras de las hojas** (`fetchWinnersByCashier`, `features/current-account/fetchers.ts`): recorre todas las páginas del listado. Antes cortaba en 200 ganadores del período y alguna hoja podía quedar sin sus jugadas ganadoras. Las cuentas del día ya venían completas: con `date`, la API devuelve todas las filas.
- **`liquidationSlipAmounts`**: los montos que imprime la hoja salen de una función pura, la misma que usa el test.
- **Tests** (`src/__tests__/current-account/liquidation.test.ts`): qué cuenta como movimiento, el nombre del archivo, que las hojas por pasador sumen lo mismo que la liquidación general (`computeAccountTotals`) y que dejar afuera a los sin movimiento no cambie los totales.

### Added - 2026-11-05 (R26: polla especial con varios sorteos)

- **Ediciones** (`features/editions/index.tsx`):
  - Los selects de quiniela y turno se reemplazan por una grilla quiniela × turno (`DrawsGrid`): la regular marca un sorteo, la especial los que quiera (por ejemplo, las 5 de las 21 h).
  - Interruptor "Edición especial" con "Mínimo de aciertos" (8 por defecto). Apagado, la edición premia solo 10.
  - En el listado, la columna "Sorteos" muestra el nombre y todos los sorteos, con el badge "Especial" y la regla de premio.
- **Nombres de edición en toda la app** con `pollaEditionTitle` / `pollaEditionDrawLabels`: Cargar jugada (selector y, para la especial, "Juega con" + regla), Jugadas y Administrar (`useBetsEdition` devuelve `labelFor`, `titleFor` y `drawLabelsFor`), Ventas, Revisar ticket (título, regla y "Ganó el" en vez de "Completó") y Resultados.
- **Ticket impreso** (`functions/makePollaTicket.ts`): el nombre de la edición y un sorteo por línea (`editionName` y `drawLines` en lugar de `lotteryName`/`scheduleName`). La especial de un día dice "Juega: DD/MM".
- **PDF de tickets de la edición** (`functions/editionTicketsPDF.ts`, `ShareTicketsPdfButton`): reciben `title`. El título se parte en varias líneas si no entra y, en la especial, se agrega la regla de premio. El nombre del archivo se corta a 60 caracteres.
- **Resultados** (`features/results/index.tsx`): después de "Generar ganadores", aviso por edición con los sorteos que faltan y si los ganadores esperan, con el botón "Definir con lo cargado" (pide confirmación; es para un sorteo que no se hizo). Hooks `useDrawCatalogs` y `useDefineEditionDay`, ruta `result.define`.
- **Tests** (`src/__tests__/helper/edition.test.ts`): nombres y orden de los sorteos, título, especial y regla, y los schemas de alta y cambio.

### Changed - 2026-11-05 (R27: dos ediciones en la misma semana)

- **Ventas** (`features/sales/index.tsx`): "Del día" también pide la edición y muestra lo vendido ese día en esa edición. Las ediciones no se mezclan.
- **Cargar jugada** (`features/make-bet/index.tsx`): con una sola edición abierta queda elegida. Con varias se elige a mano, como antes. Repetir ticket arranca con la misma.
- **Ediciones**: el texto de la pantalla ya no dice "una edición por quiniela, turno y semana".

### Added - 2026-11-05 (Tests y typecheck)

- **Vitest 5.0.5** (`vitest.config.ts`, devDependency con versión fija): tests de la lógica en TypeScript en `src/**/*.test.ts`. Los de `@helper/polla` también viven acá (`src/__tests__/helper/`), porque si estuvieran en `helper/` los compilaría el `tsc` de la API. Reusa `vite.config.ts` (alias `@` y `@helper`).
- **Scripts**: `test` (`vitest run`), `test:watch` y `typecheck` (`tsc -b && tsc -p tsconfig.node.json`). `vite build` no chequea tipos.
- **Primer test** (`src/__tests__/helper/game.type.test.ts`): `pollaTotalPool` y `pollaTicketCashierCode`.
- Se instaló con `--legacy-peer-deps` porque npm 10.9 falla al resolver los peers de Vitest (`Cannot read properties of null (reading 'edgesOut')`). El lock solo cambia los paquetes de Vitest y el hoisting de `fdir` y `picomatch`.

### Fixed - 2026-11-05 (R02: opciones de los desplegables legibles)

- **`SelectItem`** (`components/ui/select.tsx`): la opción resaltada de los desplegables pasa de azul primario con el texto del popover (casi negro en el tema claro, 2.4:1; blanco sobre celeste en el oscuro, 2.2:1) a `accent` con `accent-foreground`: gris claro con texto oscuro (14:1) en el claro y gris azulado con texto blanco (7.4:1) en el oscuro. Lo había marcado el cliente en Ediciones (Quiniela y Turno), pero aplica a los 24 desplegables de la app. No había otro azul con texto oscuro: botones, badges, casillas y el menú activo ya usan su `*-foreground` (≥ 7.5:1).

### Changed - 2026-11-04 (PDFs: prefijo `polla_` y un PDF por pasador)

- **Exportar liquidación** (`functions/current-account/liquidationSlipPDF.ts`): se descarga un PDF por pasador (`polla_Exportar_Liquidacion_DD-MM-YYYY_<nombre>-<número>.pdf`) en vez de uno solo con todos, igual que en QuiniApp. Las descargas salen con 300 ms de diferencia para que el navegador no descarte ninguna (puede pedir permiso para descargar varios archivos). La hoja de cada pasador no cambia; la del pasador ("Imprimir liquidación") sigue siendo un solo PDF.
- **Nombres de archivo**: todos los PDFs de Polla empiezan con `polla_`: diario / resumen de la cuenta corriente (`accountTablePDF.ts`), cobros y pagos y subtotales (`totalsTicket.ts`), liquidación del grupo (`groupLiquidationTicket.ts`), tickets de la edición (`editionTicketsPDF.ts`, antes `Polla_`) y tickets (`makePollaTicket.ts`, antes `polla-<ticket>.pdf` / `polla-<n>-tickets.pdf`, ahora `polla_<ticket>.pdf` / `polla_<n>_tickets.pdf`).

### Removed - 2026-11-04 (Cuenta corriente: sin acceso para el admin)

- **Cuenta corriente** (`components/layout/AppLayout.tsx`, `routes/route.tsx`): el admin ya no la ve en el menú y si entra por URL vuelve a Jugadas. Quedan dueño, capitalista, superadmin y el pasador (solo la suya). La API tampoco le da acceso.
- **`GroupAccountView`** (`features/current-account/GroupAccounts.tsx`): se borra la vista de la cuenta del grupo para su admin. Con ella se van `canLiquidate` de `GroupPreviews` y `groupId` de `GroupAccountHistory`, que solo usaba esa vista.

### Added - 2026-11-04 (Ver contraseña)

- **`PasswordInput`** (`components/ui/password-input.tsx`): input de contraseña con un ojito para ver lo que se escribió y volver a ocultarlo. Arranca oculta, cada campo se muestra por separado y al tocar el ojito el foco (y el teclado en mobile) sigue en el input.
- Lo usan todos los campos de contraseña de Polla: login, cambiar contraseña (actual, nueva y repetir), blanquear contraseña (`ResetPasswordDialog`), alta y edición de usuario (`EditUserDialog`), alta de organización (capitalista) y alta de grupo (admin).

### Changed - 2026-10-29 (Identificador opcional con jugador, ventas de la edición y fecha del PDF de Administrar)

- **Cargar jugada** (`features/make-bet/index.tsx`): el pasador que elige uno de sus jugadores ya no tiene que poner identificador ("opcional"); a su nombre sigue siendo obligatorio ("Poné el identificador o elegí uno de tus jugadores").
- **Ventas del día** (`features/sales/index.tsx`): "Ver: Del día | Total de la edición". Con la edición, las boletas y lo recaudado de todos los días de carga de la edición elegida (en la URL, como en Jugadas), con el mismo desglose por grupo. Los grupos se muestran con su número (`groupLabel`). `useDailySales` acepta `polla_edition_id` y `enabled`; `useBetsEdition` devuelve `updateEdition`.
- **Administrar jugadas** (`features/bets/ShareTicketsPdfButton.tsx`, `features/manage-bets/index.tsx`): "Compartir PDF" abre un diálogo para elegir de qué día son las jugadas que se imprimen: hoy, otra fecha, todas las fechas o, si la lista tiene "Cargadas desde / Hasta", ese rango (elegido de entrada). Los demás filtros de la lista se aplican igual y el PDF dice qué fecha se eligió. Prop nueva `pickLoadDate`; Jugadas y Resultados no cambian.
- **Selector de grupo** (`features/current-account/dialogs/shared.tsx`): los grupos con su número.

### Fixed - 2026-10-29

- **Selects** (`components/ui/select.tsx`): el valor elegido se trunca con "…" en vez de desbordar. Las variantes `*:data-[slot=select-value]:` de shadcn son de Tailwind 4 y en el 3 no aplicaban: el nombre largo de una edición agrandaba la página en mobile (scroll horizontal en Jugadas, Administrar jugadas y Ventas). Pasan a `[&>[data-slot=select-value]]:`.

### Changed - 2026-10-27 (Números por grupo, tickets nuevos, usuarios de calle, rol Super y liquidación por grupo)

- **Rol Super** (`routes/route.tsx`, `components/layout/AppLayout.tsx`): entra a Cargar jugada, Jugadas, Administrar jugadas, Revisar ticket, Resultados y Configuración.
- **Cargar jugada** (`features/make-bet/index.tsx`):
  - El pasador carga a su nombre o al de uno de sus jugadores.
  - Admin+ y el Super eligen "Pasador | Jugador"; el pasador se busca por número, `grupo-número` o nombre.
  - Campo "Identificador": obligatorio para el pasador y para cualquier jugada a nombre de un pasador; el jugador no lo ve.
- **Ticket impreso** (`functions/makePollaTicket.ts`): "Usuario: grupo-pasador", el número de ticket achica la letra hasta entrar y una línea "Id:" con el identificador.
- **Jugadas y Administrar jugadas**: un solo "Buscar": un nº de ticket busca en todas las ediciones; otro texto, el jugador o el identificador en la edición elegida (también en el PDF). El Super administra toda la organización (grupo, editar, borrar, imprimir).
- **Listado de jugadas** (`features/bets/BetsList.tsx`, `format.ts`): botón para copiar el nº de ticket (todos menos el jugador), pasador como `grupo-número` y el cliente con su identificador.
- **Usuarios** (`features/users`): "De calle" para pasadores y jugadores (sin usuario ni contraseña); el número se precarga con el siguiente libre del grupo o del pasador; badge "Calle"; sin blanqueo para los de calle; al editar se pasa de calle a aplicación (pide usuario y contraseña) o al revés (avisa que se borran las credenciales).
- **Grupos** (`features/groups/index.tsx`): columna Nº. `lib/pollaGroups.ts`: `groupLabel` ("2 · Zona norte").
- **Cuenta corriente** (`features/current-account`): se ven todos los pasadores como `grupo-número`; "Generar liquidación" pide elegir un grupo (o "Sin grupo") y liquida solo ese grupo.
- **Revisar ticket, ganadores y PDFs de tickets**: pasador como `grupo-número` e identificador del ticket.

### Changed - 2026-10-26 (Menú y PDF de Jugadas)

- **Menú lateral** (`components/layout/AppLayout.tsx`): "Cargar jugada" pasa primero, después "Jugadas" y "Administrar jugadas". El resto queda igual.
- **Jugadas** (`features/bets/index.tsx`): el pasador y superiores tienen de nuevo "Cargadas desde / Hasta" y "Compartir PDF". El jugador sigue sin filtros ni PDF.
  - El PDF imprime lo que muestra la lista: toda la organización en "Todas", o "Mis jugadas" (el pasador, lo suyo y lo de sus jugadores), con las fechas elegidas y por aciertos. Pide `export=true&view=public`.
  - Esto vuelve atrás, solo en Jugadas, lo de 2026-10-23: el pasador puede compartir el PDF de todo lo que se juega. En Administrar jugadas el PDF sigue acotado a lo que administra cada rol.
- **PDF de tickets** (`features/bets/ShareTicketsPdfButton.tsx`): `TicketsPdfFilters` suma `view: 'public'` y `mine`.
- **`useLoadRangeParam`** (`features/bets/useLoadRangeParam.ts`): lee y escribe juntos `load_from`/`load_to` de la URL. Lo usan Jugadas y Administrar jugadas (antes estaba inline en `features/manage-bets/index.tsx`).

### Changed - 2026-10-23 (Jugadas de solo lectura y Administrar jugadas)

Se separa mirar las jugadas de administrarlas.

- **Jugadas** (`features/bets/index.tsx`): de solo lectura e igual para todos los roles. Pide `view=public`, así que la API manda la versión pública (sin montos ni ids) también a admin+.
  - Selector de edición (abre en la activa), pozo y banner de ganadores.
  - Buscar Nº de ticket y "Todas / Mis jugadas". Abre en Todas; `mine=1` en la URL (y `/mis-jugadas`) abre en Mis jugadas.
  - Orden fijo: más aciertos primero y, a igual cantidad, lo último cargado.
  - Sin acciones, filtros ni PDF. "Actualizar" para todos menos el jugador, que ve lo cargado al entrar.
- **Administrar jugadas** (`features/manage-bets`, ruta `/administrar-jugadas`, debajo de "Cargar jugada" en el menú): pasador y admin+. El jugador no la ve y por URL vuelve a Jugadas.
  - Pide `view=manage`: el pasador ve lo suyo y lo de sus jugadores; el admin, su grupo; superadmin+, toda la organización.
  - Tiene lo que antes estaba en Jugadas: filtros (grupo solo superadmin+; el pasador filtra por uno de sus jugadores; el admin busca en su grupo), fecha de carga, resultado, aciertos, orden, Actualizar, Compartir PDF, imprimir, editar, borrar y repetir sin cargo. Los permisos de cada acción no cambian.
  - Ya no tiene "Solo mi grupo" ni "Mis jugadas / Jugando": el alcance lo fija el rol.
- **Compartidos** (`features/bets`): `BetsList` (tarjetas en mobile, planilla en desktop), `EditionPicker`, `WinnersBanner`, `useBetsEdition` y `format.ts`.
- **PDF de tickets** (`ShareTicketsPdfButton.tsx`): se saca el filtro `mine`. La API lo acota al alcance de cada rol, así que el pasador ya no comparte el PDF de todo lo que se juega.

### Added - 2026-10-22 (Jugadas: filtro por fecha de carga)

- **Filtro "Cargadas desde / Hasta"** (`features/bets/LoadDateFilter.tsx`, `features/bets/index.tsx`):
  - Acota el listado de Jugadas a las cargadas entre esas fechas, sumado a los demás filtros (edición, grupo, pasador/jugador, resultado, aciertos). Viaja en la URL (`load_from` / `load_to`) y la API ya lo aceptaba.
  - Elegir una sola fecha filtra ese día. Si el otro extremo queda fuera de rango (desde después de hasta, o más de `POLLA_ACCOUNT_RECALC_MAX_DAYS` días), se corre al mismo día. La cruz vuelve a todos los días.
  - Pasador y admin+: el jugador no lo ve, y si la URL trae fechas no se mandan.
  - Lo ignora la búsqueda por número de ticket, como el resto de los filtros.
- **PDF de tickets** (`ShareTicketsPdfButton.tsx`): el export lleva también el rango de carga y el encabezado lo menciona ("cargadas 12/10 al 13/10").

### Changed - 2026-10-22 (Polla: grupos con admin, corte por rol, edición de pollas y repetir tickets)

#### Roles y grupos
- **Menú y rutas** (`AppLayout.tsx`, `routes/route.tsx`):
  - Ediciones, Quinielas y turnos y Grupos quedan para superadmin+.
  - El admin entra a Cuenta corriente y ve la de su grupo.
  - Resultados: solo superadmin+ los carga y procesa (`features/results`).
- **Admin sin grupo** (`protected/ProtectedRoute.tsx`): pantalla que explica que tiene que asignarle un grupo un superadministrador.
- **Grupos** (`features/groups`):
  - Alta del grupo con su admin en un diálogo, como Organizaciones.
  - El listado muestra el admin. "Asignar admin" (uno sin grupo o uno nuevo) aparece en los grupos del modelo anterior.
  - Borrar avisa que se van también admin, pasadores y jugadores.
- **Usuarios** (`features/users`):
  - El admin ve y crea solo pasadores y jugadores de su grupo: su pasador queda en el grupo y el jugador cuelga de un pasador del grupo.
  - El grupo de un pasador se elige al crearlo y después se ve de solo lectura (`EditUserDialog.tsx`).
- **`UserSearchPicker`**: prop `scope` (grupo, pasador o `writable` para cargar a nombre de otro).

#### Cargar y repetir
- **Cargar jugada** (`features/make-bet`):
  - El admin ve hasta cuándo carga (`my_load_cutoff`) y busca pasadores de su grupo.
  - El aviso de "edición en juego" es solo para superadmin+.
  - Pozo sorpresa destacado.
- **Repetir directo** (`RepeatBetDialog.tsx`):
  - Pasador y admin+: nº de ticket → números y dueño → "Cargar e imprimir". La jugada va a nombre del dueño original (el jugador, si era de uno) y el diálogo queda listo para el siguiente.
  - Jugador: "Repetir mis tickets" lista sus tickets de la última edición en que jugó, con checkboxes, y los carga todos.
  - Lo que no se pudo repetir se avisa con el motivo (`lib/repeatReasons.ts`).
- **Tickets** (`functions/makePollaTicket.ts`): `makePollaTicketsPdf` arma varios tickets en un PDF (una página por ticket). Imprime "+ Pozo sorpresa" y "SIN CARGO" en los repetidos sin cargo.

#### Jugadas
- **Filtros** (`features/bets/index.tsx`, `ResultFilters.tsx`):
  - Para todos: Resultado (Todos / Ganadores / No ganadores) y Aciertos (10, 9, 8, 7).
  - Superadmin+ elige grupo; el resto tiene "Solo mi grupo". Todos filtran por pasador o jugador.
  - Los filtros viajan también al PDF de tickets.
- **Acciones**: editar y borrar según `can_edit` / `can_delete` de la API. Imprimir usa el precio guardado en la jugada.
- **Repetir sin cargo** (`FreeRepeatDialog.tsx`): con una edición finalizada, admin+ elige tickets de su alcance (o todos los de la lista) y los repite en una edición abierta. Ve cuántos se cargaron y cuáles no. Badges "Sin cargo" y cantidad de veces que se repitió cada ticket.

#### Ediciones
- **`features/editions`**:
  - Editar una edición: precio (vale para las jugadas nuevas), fechas, horas, pozo y pozo sorpresa.
  - "Extender" en las cerradas sin ganador.
  - Con ganador solo se renombra.
  - El cierre de carga puede ser el mismo día del primer sorteo.
- **Pozo sorpresa** destacado en Ediciones, Jugadas, Cargar jugada, Revisar ticket y el PDF de tickets.

#### Cuenta corriente
- **Pestaña "Grupos"** (`GroupAccounts.tsx`, superadmin+):
  - Previa de cada grupo a la fecha (deja de los pasadores, gastos, arrastre, base) con los pasadores que faltan liquidar.
  - "Liquidar" con % del admin, ajustes y pago, más ticket térmico (`functions/current-account/groupLiquidationTicket.ts`).
  - Historial de liquidaciones.
- **Admin**: ve la cuenta de su grupo (previa e historial, solo lectura).
- **Reportes** (`dialogs/ReportDialogs.tsx`, `totalsTicket.ts`): se saca el "% del pozo"; la liquidación no descuenta del pozo.
- **Ventas** (`features/sales`): el admin ve su grupo, sin selector de grupo.

#### Fixed
- **`components/ui/checkbox.tsx`**: el borde usaba `border-input` (el fondo blanco de los inputs) y no se veía sobre fondo blanco. Ahora usa `border-input-border`.

### Changed - 2026-10-21 (Polla: usuarios por número y sin @)

- **Usuarios** (`features/users/index.tsx`): pasadores y jugadores salen de menor a mayor número. El orden lo da la API (`GET /user`) porque la lista viene paginada.
- **`lib/pollaUsers.ts` → `pollaUserTypeLine`**: el buscador de usuarios (`UserSearchPicker`) muestra el usuario sin `@` adelante ("pasador · juanp").

### Added - 2026-10-21 (Polla: botón Actualizar en Jugadas)

- **`features/bets/index.tsx`**: botón "Actualizar" junto a "Compartir PDF" (gira mientras busca). Trae lo último cargado sin recargar la página, con los mismos filtros.
- **`hooks/fetchs/usePollaData.ts`**: `useRefreshBets(params)` refresca la lista y además los ganadores y los totales de las ediciones (pozo y cantidad de jugadas).
- **`hooks/useApi.ts`**: `useRefreshCursorQuery` deja solo la primera página del feed por keyset y la vuelve a pedir. Un `refetch()` común volvía a pedir cada página con su cursor viejo y salteaba las filas que las jugadas nuevas corren a la página siguiente. Mientras llega se sigue viendo la primera página. `cursorQueryKey` arma la query key que comparten el hook y el refresco.

### Added - 2026-10-20 (Polla: Vercel Web Analytics)

- **`src/App.tsx`**: `<Analytics />` de `@vercel/analytics/react` (1.6.1, la misma versión que QuiniApp), así las visitas y páginas de la Polla se ven en la pestaña Analytics de su propio proyecto de Vercel, separadas de las de QuiniApp. Hay que activar Web Analytics en el proyecto de Vercel de polla-web para que empiece a registrar.

### Changed - 2026-10-20 (Polla: el admin no ve la cuenta corriente; capitalistas fuera de Usuarios)

- **Cuenta corriente**: el ADMIN ya no la tiene en el menú (`AppLayout.tsx`) y la ruta lo manda a Jugadas (`routes/route.tsx`). Entran dueño, capitalista, superadmin (`POLLA_ACCOUNT_ROLES`) y el pasador, que ve la suya.
- **Usuarios** (`features/users/index.tsx`): el filtro de tipos ya no ofrece "Capitalista" (`pollaUserListTypes`) y la API no los lista. El capitalista se ve desde Organizaciones.

### Changed - 2026-10-20 (Polla: jugadas borradas en el pase, liquidación por rango y carga de ADMIN+)

#### Cuenta corriente
- **Columnas "Pase jugadas" y "Borradas"** antes de "Pase" en la planilla (tabla y tarjetas mobile, `features/current-account/index.tsx`), la vista del pasador (`CashierAccountView.tsx`), el modal de liquidar y la grilla de "Generar liquidación" (`dialogs/LiquidationDialogs.tsx`), "Exportar diario", el resumen por rango (`accountTablePDF.ts`) y la hoja de liquidación (`liquidationSlipPDF.ts`). Pase jugadas − Borradas = Pase (más los reclamos positivos), sobre el que se calcula la comisión.
- **Modo "Día / Rango de fechas"** en la planilla del admin y en la vista del pasador (`ModeToggle` de `dialogs/shared.tsx`, ahora con `id` y `label`). Por día sigue igual: cada pasador desde su última liquidación hasta "A la fecha". Por rango se eligen Desde y Hasta y todo suma esos días (planilla, liquidar, PDFs, jugadas); liquidar cierra en Hasta. Desde arranca en el inicio de la semana y se limita a Hasta y a 62 días (`accountRangeFrom` y `oldestRangeFrom` en `lib/accountPeriod.ts`).
- **`DayBetsTables.tsx`**: los tickets del período incluyen los que se borraron después (`with_deducted`), con la marca "Borrada dd/mm", y hay una tabla "Borradas del período" (ticket, jugador, día de carga, día de baja y monto). Así se puede verificar Pase jugadas − Borradas = Pase.

#### Jugadas y carga
- **`features/bets/index.tsx`**: el pasador puede borrar aunque su cuenta ya esté liquidada (lo decide `can_delete`). La confirmación avisa que se descuenta del pase del día en que se borra.
- **`features/make-bet/index.tsx`**: ADMIN y superiores ven las ediciones hasta su último día de juego y el aviso dice "vos podés cargar hasta el {fin de la edición}". Si la edición ya está en juego, avisa que para sumar los aciertos de los sorteos anteriores hay que volver a generar los ganadores de esos días.

### Added - 2026-10-15 (Polla: ícono de la app)

- **`public/manifest.webmanifest`** (nombre "Polla", `display: standalone`) y los íconos del gallo en `public/icons/`: 192 y 512, maskable 512 (con margen para el recorte circular de Android), `apple-touch-icon` 180 y favicons de 32 y 48.
  - Sin manifest, Android armaba al instalarla un ícono genérico con una letra ("V").
  - `index.html` enlaza el manifest, el `apple-touch-icon`, `theme-color` y los favicons PNG. Antes apuntaba a un `/favicon.svg` que no existía.
  - Quien ya la tiene instalada tiene que borrarla y volver a agregarla para ver el ícono nuevo.

### Changed - 2026-10-15 (Polla: mobile de ediciones y usuarios)

#### Ediciones (`features/editions/index.tsx`)
- **Checkboxes "Futuras / Jugando / Pasadas"**, en mobile y en desktop. Por defecto quedan tildadas Futuras y Jugando. Con ninguna o con las tres se ven todas.
  - Filtra la API con `periods` (`GET /edition?periods=UPCOMING,PLAYING`), así el scroll infinito pagina sobre lo filtrado.
  - `useEditionList` suma `keepPrevious`: al tildar o destildar se sigue viendo la lista anterior hasta que llega la nueva.
  - Sin resultados dice "No hay ediciones para los filtros elegidos".
- **Mobile: tarjetas** en lugar de la tabla de 8 columnas, que obligaba a scrollear de costado. Muestran quiniela, turno, semana, estado, eliminar, cierre, pozo, ticket y jugadas. En desktop (`md`) sigue la tabla.
- **Estado**: el badge dice Futura, Jugando o Cerrada (con fecha del ganador o "sin ganador"), según `pollaEditionPeriod`. Antes las futuras y las que se jugaban decían las dos "Activa".

#### Usuarios (`features/users/index.tsx`)
- **Mobile: tarjetas** en lugar de la tabla. Muestran número y nombre, tipo, "Deshabilitado", `@usuario`, grupo, comisión y las acciones (editar, blanquear y eliminar, compartidas con la tabla en `renderActions`). En desktop sigue la tabla.

### Changed - 2026-10-14 (Polla: cierre de carga de los admin)

- **`features/make-bet/index.tsx`**: ADMIN y superiores ven las ediciones hasta el final del día de cierre, porque `GET /edition?loadable=true` ya las filtra solo por fecha para ellos.
  - Debajo de la edición se agrega "· vos podés cargar hasta las 23:59" después de la fecha y hora de cierre, que siguen siendo las de pasadores y jugadores.

### Changed - 2026-10-14 (Polla: desplegable de usuarios)

#### `components/UserSearchPicker.tsx`
- **Clic:** abre el desplegable aunque el input ya tenga el foco (por ejemplo, recién elegido alguien).
- **Chevron:** el que aparece a la derecha abre y cierra la lista sin sacarle el foco al input.
- **Orden:** la lista viene ordenada por número, por el cambio de `GET /user/search`.
- **Refinar sin vaciar:** mientras se escribe se sigue viendo la lista anterior hasta que llega la refinada.
  - `useApiInfiniteQuery` suma la opción `keepPrevious` (`placeholderData: keepPreviousData`).
  - La usan `useUserSearch` y `useUsers`.
- **Teclado:** con ↑/↓ la fila activa queda a la vista (`scrollIntoView`). Al llegar al final se carga la página siguiente.
- **Sin coincidencias:** se avisa dentro del panel, que ya no se cierra.
- **Prop nueva `typeFilter`:** muestra "Pasador | Jugador" junto al label y busca solo en el tipo elegido.
  - Al cambiar de tipo se limpia el texto.
  - La página suelta al elegido y limpia sus filtros.

#### Cargar jugada
- "Cargar a nombre del pasador" lista **solo pasadores**. La usan los roles superiores al pasador para cargar a nombre de uno.
- La API sigue aceptando un jugador como destino.

#### Jugadas
- El filtro "Pasador" pasa a ser "Filtrar por" con **Pasador | Jugador**.
  - **Pasador:** filtra con `cashier_polla_user_id`, que trae sus jugadas y las de sus jugadores.
  - **Jugador:** filtra con `polla_user_id`, que trae solo las del jugador.
- El filtro queda en la URL. Al recargar se trae al usuario por id y, si es un jugador, también a su pasador para mostrar "jugador de N · Pasador".
- **"Compartir PDF":** usa el mismo filtro (`TicketsPdfFilters.polla_user_id`) y el encabezado dice "Jugador N · Nombre" o "Pasador N · Nombre".
- **`lib/pollaUsers.ts`:** `cashierOption` pasa a ser `pollaUserOption(user, cashier?)`. Sin el pasador a mano, el texto dice solo "jugador".

#### Usuarios
- Buscador "número, nombre o usuario" al lado del filtro de tipo (`search` de `GET /user`, con debounce).

### Changed - 2026-10-13 (Polla: número por tipo y buscador de pasadores)

#### Buscador de pasadores y jugadores (`components/UserSearchPicker.tsx`)
- **Cómo busca:** el mismo campo acepta número o nombre.
  - Solo dígitos busca el número exacto. Si hay uno solo, lo elige solo y Enter sigue de largo, como antes.
  - Con letras busca en nombre, apellido y usuario.
  - Al enfocarlo vacío lista todos, para scrollear hasta encontrarlo (de a 30, con scroll infinito dentro del panel).
- **Cómo se elige:** con clic o con ↑/↓ y Enter. Si un pasador y un jugador comparten número aparecen los dos.
- **Debajo del campo** se ve el elegido ("Ana Gómez · jugador de 3 · Pedro"). Con `clearLabel` aparece una ✕ para volver a "Todos".
- **Dónde se usa:**
  - **Cargar jugada:** reemplaza a `TargetUserByNumber` ("Cargar a nombre de"). Escribir suelta al elegido, así no se carga a nombre del anterior.
  - **Cuenta corriente:** reemplaza al input "Nº de pasador". Filtra por `polla_user_id`.
  - **Jugadas:** reemplaza al desplegable "Pasador", que cortaba en 200. El filtro sigue en la URL y al recargar se trae el pasador por id.
  - **Usuarios → Nuevo jugador:** reemplaza al desplegable "Pasador".
- **`lib/pollaUsers.ts`** (nuevo): `describePollaUser`, `pollaUserTypeLine` y `cashierOption`.
- **Hooks:** nuevo `useUserSearch`. Salen `useUserByNumber`, `useUserOptions`, `TargetUserByNumber.tsx` y la ruta `user.byNumber`. Crear, editar o borrar un usuario invalida también el buscador.

### Changed - 2026-10-12 (Polla: cuarta tanda del cliente)

#### Cuenta corriente por período (liquidación semanal)
- **Vista y exportes:** la planilla, el total general, "Exportar diario" y "Exportar liquidación" muestran cada pasador acumulado desde el día siguiente a su última liquidación hasta la fecha elegida. Hay una columna nueva "Desde".
  - "Actualizar" recalcula todo el período abierto.
  - Liquidar, a uno o a todos, cierra el período en esa fecha.
- **Helpers nuevos (`lib/accountPeriod.ts`):**
  - `periodView`, la fila con los montos del período;
  - `periodLabel`;
  - `betsRangeFrom`.
- **`LiquidateCashierDialog`:**
  - montos del período de solo lectura, incluidos los reclamos del período;
  - reclamos, gastos, cobro y pago del día, editables;
  - el saldo anterior solo se edita si el período empieza ese día.
- **`GenerateLiquidationDialog`:** usa los montos del período, con la columna "Desde".
- **`DayBetsTables`:** recibe `from`/`to` y lista los tickets y las ganadoras del período.
- **`CashierAccountView`:** el pasador ve su período.
- **Liquidación en PDF:** dice "Período D/M al D/M" e incluye las ganadoras de todo el período.
- **Reportes por día:** "Resumen" y "Exportar subtotales" usan lo acumulado del período. "Exportar cobros y pagos" sigue siendo la caja del día.

#### Cobros y pagos
- **"Exportar cobros y pagos"** tiene el campo "Porcentaje del pozo":
  - **Día:** si el saldo del día es positivo, el ticket suma `p% POZO` y `SALDO SIN POZO`.
  - **Período:** si deja, descuenta el pozo y calcula el `% DEJA` del capitalista sobre lo que queda.

#### Jugadas
- **El pasador borra hasta el cierre de carga:** el botón eliminar ya no se limita a las jugadas del día. Sigue `can_delete`: carga abierta y cuenta sin liquidar desde el día de carga.
- **"Compartir PDF" (`features/bets/ShareTicketsPdfButton.tsx`):** está en Jugadas para todos menos el jugador y usa los filtros elegidos.
  - Baja todas las jugadas de la edición de a 1000, con un spinner que muestra el progreso.
  - Arma un PDF A4 apaisado para blanco y negro (`functions/editionTicketsPDF.ts`):
    - los números acertados van en negrita y sombreados;
    - tiene columnas de aciertos, si ganó y premio.
  - En mobile lo comparte; en desktop lo descarga (`sharePdf` y `downloadPdfBlob` en `functions/printPdf.ts`).
- **Resultados:** después de "Generar ganadores" aparece una tarjeta con cada edición procesada, su "Compartir PDF" y un link a Jugadas.

### Changed - 2026-10-12 (Polla: tercera tanda del cliente)

#### Organización y roles
- El OWNER opera solo sobre su organización, como el resto: se saca el selector de organización del header (`OrganizationPicker`), `activeOrganizationId`/`setActiveOrganizationId` del `AuthContext` y el botón "Trabajar acá" de Organizaciones. Organizaciones queda para dar de alta, editar y eliminar organizaciones con su capitalista y blanquearle la contraseña.
- **Grupos** (`features/groups`, ruta `/grupos`, OWNER y capitalista): pantalla propia para crear, renombrar y eliminar grupos. Sale la tarjeta de Grupos de "Quinielas y turnos". Hook nuevo `useUpdateGroup`.

#### Usuarios y contraseñas
- El alta ofrece los tipos de `POLLA_CREATABLE_TYPES`. Superadmin, capitalista y OWNER pueden crear jugadores eligiendo el pasador (select "Pasador"). Admin crea solo pasadores.
- El ícono de blanqueo se muestra solo si `canResetPollaPassword(rol, tipo)` y nunca sobre uno mismo.
- El blanqueo pone una contraseña definitiva: `ResetPasswordDialog` ya no habla de contraseña temporal.
- Se saca "Cambiar contraseña" de Configuración. `/cambiar-password` queda solo para la contraseña inicial del OWNER del seed: `ProtectedRoute` redirige ahí mientras `password_reset_required` y, si no, la manda a Jugadas.

#### Jugadas y carga
- **`features/bets`**: owner, capitalista, superadmin y admin tienen todas las acciones. El pasador solo imprime y elimina lo suyo. El jugador no tiene columna de acciones.
- **`features/make-bet`**: "Cargar a nombre de" queda solo para owner, capitalista, superadmin y admin. El pasador carga únicamente a su nombre. Las ediciones se piden con `loadable=true` (la API mira fecha y hora de cierre) y se muestra "cierre de carga DD-MM-YYYY HH:mm".
- **`features/editions`**: el alta pide la hora de cierre de carga (`load_limit_time`, por defecto 21:00) además de la fecha. La columna Cierre muestra fecha y hora.

#### Revisar ticket
- **`features/check-ticket`** (ruta `/revisar-ticket`, todos menos el jugador): se busca un ticket de la organización y se ve:
  - si ganó y el premio;
  - el titular: pasador, o jugador y de qué pasador;
  - los números con aciertos;
  - la edición con su pozo;
  - la tabla de ganadores con lo que se llevó cada uno.
- Hook `useTicketCheck` y `BACKEND_ROUTES.bet.check`.

#### Ventas, cuenta corriente y reportes
- **`features/sales`**: filtro por grupo (o todos) para todos menos el pasador. Filtra el desglose por grupo y los totales.
- **`components/ui/date-input.tsx`** (`DateInput`) y `lib/dates.ts` (`todayIso`):
  - el calendario se abre con cualquier click (`showPicker`); antes, después de elegir una vez, había que tipear la fecha;
  - una fecha tipeada pasado el `max` se lleva al máximo.
- `DateInput` se usa en cuenta corriente (admin y pasador), reportes, ventas, resultados (máximo hoy) y ediciones.
- **`styles/index.css`**: `color-scheme: light` en los inputs de fecha y hora, porque en el tema oscuro el ícono del calendario quedaba blanco sobre blanco.
- **Exportar subtotales** (`ReportDialogs`, `totalsTicket`):
  - campo nuevo "Porcentaje del pozo";
  - del total (o del saldo neto si hay gastos) se descuenta ese %, con las líneas `X% POZO` y `SALDO SIN POZO`;
  - el % del capitalista se calcula sobre lo que queda.

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
