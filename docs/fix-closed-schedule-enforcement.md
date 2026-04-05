# Fix: Closed Schedule Enforcement for CASHIERs

**Branch:** `improve-performance-by-agents`
**Date:** 2026-03-30
**Commits:** `0494ce9`, `ede558d`

---

## Problema

En la página `/make-plays`, un CASHIER podía:

1. Seleccionar un turno (ej. "Ocho y media [20:30]")
2. Esperar a que ese turno cerrara (pasadas las 20:30)
3. El turno seguía apareciendo **seleccionado** en la UI
4. El botón "Agregar" seguía **habilitado**
5. El CASHIER podía cargar jugadas a un turno ya cerrado ✗

Adicionalmente, si el CASHIER ya tenía jugadas cargadas de un turno que luego cerró, esas jugadas permanecían en la lista sin ser limpiadas.

---

## Causa Raíz

### Bug 1 — `isLessThanTenMinutes` devuelve `false` para horarios pasados

```ts
// ClockProvider.tsx — lógica original
const diffSec = scheduleTime.diff(now, 'second');
// Si el turno ya pasó: diffSec < 0
// isLessThanTenMinutes devuelve false (diffSec < 0 no está en el rango 0..600)
```

La función `isLessThanTenMinutes` solo detecta turnos que están **a punto de cerrar** (0–10 min), pero **no detecta turnos que ya cerraron**. Como resultado, `setIsEnabledCreateBet(false)` nunca se ejecutaba una vez pasado el horario.

### Bug 2 — Sin auto-deselección de turnos cerrados

El `useEffect` en `game-turns.tsx` solo actualizaba `setIsEnabledCreateBet`, pero **nunca limpiaba `checkedSchedules`**. El turno cerrado permanecía en el `Map` de seleccionados.

### Bug 3 — Sin limpieza de jugadas cargadas

`MakePlaysProvider.tsx` tenía `cleanClosedSchedulesFromBets` pero solo la llamaba **al momento de intentar crear el ticket** (modal de confirmación). Las jugadas no se limpiaban automáticamente mientras el usuario seguía en la pantalla.

---

## Solución

### Fix 1 & 2 — `game-turns.tsx`

Se reemplazó el predicado de "turno abierto" de solo `!isLessThanTenMinutes(t)` por la combinación correcta:

```ts
const stillOpen = isScheduleAfter(sch.time) && !isLessThanTenMinutes(sch.time);
//                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ turno no pasó
//                                               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ no está por cerrar
```

Se agregó auto-deselección dentro del `setInterval` (cada 10s):

```ts
useEffect(() => {
  const check = () => {
    // Auto-deselect para CASHIERs
    if (role === USER_TYPE.CASHIER) {
      setSchedules((prev) => {
        let changed = false;
        const newMap = new Map(prev);
        prev.forEach((sch) => {
          const stillOpen = isScheduleAfter(sch.time) && !isLessThanTenMinutes(sch.time);
          if (!stillOpen) {
            newMap.delete(sch.schedule_id);
            changed = true;
          }
        });
        return changed ? newMap : prev;
      });
    }

    // Habilitar/deshabilitar botón Agregar
    const hasOpenSchedule =
      schedulesData?.some(
        (sch) => isScheduleAfter(sch.time) && !isLessThanTenMinutes(sch.time)
      ) ?? false;
    setIsEnabledCreateBet(role !== USER_TYPE.CASHIER || hasOpenSchedule);
  };

  check();
  const id = window.setInterval(check, 10_000);
  return () => clearInterval(id);
}, [schedulesData, isScheduleAfter, isLessThanTenMinutes, role, setIsEnabledCreateBet, setSchedules]);
```

### Fix 3 — `MakePlaysProvider.tsx`

Se agregó un `setInterval` (10s) que corre únicamente para CASHIERs y llama a la función existente `cleanClosedSchedulesFromBets` sobre la lista de jugadas actual:

```ts
// Ref para leer bets actuales sin agregarlos como dependencia del effect
const betsRef = useRef(bets);
useEffect(() => { betsRef.current = bets; }, [bets]);

useEffect(() => {
  if (user?.user_type !== USER_TYPE.CASHIER) return;

  const id = window.setInterval(() => {
    const prev = betsRef.current;
    if (prev.length === 0) return;
    const cleaned = cleanClosedSchedulesFromBets(prev);
    if (cleaned.length === prev.length) return;
    const newTotal = computeTotal(cleaned);
    setBets(cleaned);
    setTotalAmount(newTotal);
    setPartialAmount(newTotal);
  }, 10_000);

  return () => clearInterval(id);
}, [user?.user_type, cleanClosedSchedulesFromBets, computeTotal]);
```

El `betsRef` evita incluir `bets` en las dependencias del `useEffect`, lo que reiniciaría el intervalo en cada jugada agregada.

---

## Archivos Modificados

| Archivo | Cambio |
|--------|--------|
| `web/src/features/make-plays/game-turns.tsx` | Fix predicado turno abierto + auto-deselección |
| `web/src/features/make-plays/provider/MakePlaysProvider.tsx` | Auto-limpieza de jugadas de turnos cerrados |

---

## Comportamiento Final

| Escenario | Antes | Después |
|-----------|-------|---------|
| Turno cierra mientras está seleccionado | Permanece seleccionado ✗ | Se deselecciona automáticamente (≤10s) ✓ |
| Botón Agregar tras cierre de turno | Habilitado ✗ | Deshabilitado ✓ |
| Jugadas cargadas de turno cerrado | Permanecen en lista ✗ | Se eliminan automáticamente (≤10s) ✓ |
| Admin (no CASHIER) | Sin restricción | Sin cambios ✓ |
