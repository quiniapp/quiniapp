# TanStack Query Cache Optimization Plan

## 📊 Estado Actual
- 20+ hooks de queries sin optimización de cache
- Todas las queries usan configuración por defecto
- Refetch automático en window focus/reconnect (innecesario en muchos casos)
- No hay control de staleTime ni gcTime

## 🎯 Configuración Recomendada por Tipo

### ❌ NO CACHEAR (tickets y bets recientes)
Como mencionaste, tickets y bets recientes necesitan data fresca siempre.

**Hooks a OMITIR:**
1. `useInfiniteTickets.ts` - tickets necesitan estar fresh
2. `useInfiniteBets.ts` - jugadas necesitan estar fresh
3. `useInfiniteBetsByTicketNumber.ts` - jugadas por ticket fresh
4. `useGetBetysByTicketNumber.ts` - jugadas por ticket fresh
5. `useGetTicketByNumber.ts` - ticket específico fresh
6. `useGetTicketNumber.ts` - ticket específico fresh
7. `useTickets.ts` - listado de tickets fresh

**Configuración para estos:**
```typescript
{
  staleTime: 0,                    // Siempre considerarfresh data como stale
  gcTime: 30 * 1000,              // 30 segundos en cache (solo para evitar doble fetch al navegar)
  refetchOnWindowFocus: true,      // Sí refetch al volver
  refetchOnReconnect: true,        // Sí refetch al reconectar
}
```

---

### ✅ CACHEAR MEDIANO (1-5 min) - Datos semi-estáticos

**Hooks a OPTIMIZAR:**

8. `useUsers.ts` - Lista de usuarios (rara vez cambia)
```typescript
{
  staleTime: 3 * 60 * 1000,        // 3 minutos
  gcTime: 10 * 60 * 1000,          // 10 minutos
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
}
```

9. `useUsersByNumber.ts` - Usuario por número
```typescript
{
  staleTime: 3 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
  refetchOnWindowFocus: false,
}
```

10. `useSchedules.ts` - Horarios/turnos (cambian pocas veces)
```typescript
{
  staleTime: 5 * 60 * 1000,        // 5 minutos
  gcTime: 15 * 60 * 1000,          // 15 minutos
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
}
```

11. `useScheduleLottery.ts` - Relación schedules-lotteries
```typescript
{
  staleTime: 5 * 60 * 1000,
  gcTime: 15 * 60 * 1000,
  refetchOnWindowFocus: false,
}
```

12. `useLotteries.ts` - Lista de quinielas (rara vez cambia)
```typescript
{
  staleTime: 10 * 60 * 1000,       // 10 minutos
  gcTime: 30 * 60 * 1000,          // 30 minutos
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
}
```

---

### ✅ CACHEAR AGRESIVO (10-30 min) - Datos históricos/reportes

**Hooks a OPTIMIZAR:**

13. `useResults.ts` - Resultados históricos (no cambian una vez guardados)
```typescript
{
  staleTime: 30 * 60 * 1000,       // 30 minutos
  gcTime: 60 * 60 * 1000,          // 1 hora
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
}
```

14. `useTotals.ts` - Totales/reportes (datos agregados)
```typescript
{
  staleTime: 5 * 60 * 1000,
  gcTime: 15 * 60 * 1000,
  refetchOnWindowFocus: false,
}
```

15. `useGetAmountsByTicketNumber.ts` - Montos por ticket (histórico)
```typescript
{
  staleTime: 5 * 60 * 1000,
  gcTime: 15 * 60 * 1000,
  refetchOnWindowFocus: false,
}
```

16. `useGetCurrentAccount.ts` - Cuenta corriente
```typescript
{
  staleTime: 2 * 60 * 1000,        // 2 minutos (balance puede cambiar)
  gcTime: 10 * 60 * 1000,
  refetchOnWindowFocus: true,      // Sí, refetch al volver (importante ver balance actualizado)
}
```

17. `useGetDeletedTickets.ts` - Tickets eliminados (histórico)
```typescript
{
  staleTime: 10 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  refetchOnWindowFocus: false,
}
```

18. `useGetGroupedBetsByTicketId.ts` - Jugadas agrupadas por ticket (histórico)
```typescript
{
  staleTime: 5 * 60 * 1000,
  gcTime: 15 * 60 * 1000,
  refetchOnWindowFocus: false,
}
```

19. `useGetGroupedBetsByTicketNumber.ts` - Jugadas agrupadas (histórico)
```typescript
{
  staleTime: 5 * 60 * 1000,
  gcTime: 15 * 60 * 1000,
  refetchOnWindowFocus: false,
}
```

20. `useGetUsedStorage.ts` - Estadísticas de almacenamiento
```typescript
{
  staleTime: 30 * 60 * 1000,       // 30 minutos (cambia lento)
  gcTime: 60 * 60 * 1000,
  refetchOnWindowFocus: false,
}
```

---

## 📋 Plan de Implementación

### Fase 1: Datos Estáticos (ALTA PRIORIDAD)
**Impacto:** 10-15ms, reduce requests en 70%

```bash
# 1. Lotteries (más usado)
web/src/hooks/fetchs/lottery/useLotteries.ts

# 2. Schedules (muy usado)
web/src/hooks/fetchs/schedule/useSchedules.ts

# 3. ScheduleLottery
web/src/hooks/fetchs/schedule-lottery/useScheduleLottery.ts
```

---

### Fase 2: Usuarios y Cuenta Corriente (MEDIA PRIORIDAD)
**Impacto:** 5-10ms

```bash
# 4. Users
web/src/hooks/fetchs/users/useUsers.ts

# 5. UsersByNumber
web/src/hooks/fetchs/users/useUsersByNumber.ts

# 6. CurrentAccount
web/src/hooks/fetchs/current-account/useGetCurrentAccount.ts
```

---

### Fase 3: Datos Históricos (BAJA PRIORIDAD)
**Impacto:** 3-5ms

```bash
# 7-11. Results, Totals, Grouped bets, etc.
```

---

## 🚀 Ejemplo de Implementación

### Antes (sin optimización):
```typescript
// web/src/hooks/fetchs/lottery/useLotteries.ts
export const useLotteries = () => {
  return useQuery({
    queryKey: ['lotteries'],
    queryFn: getLotteries,
    // ❌ Sin configuración - usa defaults
  });
};
```

### Después (optimizado):
```typescript
// web/src/hooks/fetchs/lottery/useLotteries.ts
export const useLotteries = () => {
  return useQuery({
    queryKey: ['lotteries'],
    queryFn: getLotteries,
    // ✅ Configuración óptima para datos casi estáticos
    staleTime: 10 * 60 * 1000,       // 10 minutos - no refetch si data < 10min
    gcTime: 30 * 60 * 1000,          // 30 minutos - mantener en cache
    refetchOnWindowFocus: false,     // No refetch al enfocar ventana
    refetchOnReconnect: false,       // No refetch al reconectar
  });
};
```

---

## 📊 Beneficios Esperados

| Optimización | Requests Reducidos | Mejora INP Estimada |
|--------------|-------------------|---------------------|
| Fase 1 | 60-70% | 10-15ms |
| Fase 2 | 40-50% | 5-10ms |
| Fase 3 | 30-40% | 3-5ms |
| **TOTAL** | **50-60%** | **18-30ms** |

---

## ⚠️ Notas Importantes

1. **Tickets y Bets:** NO cachear agresivamente (30s máximo)
2. **CurrentAccount:** Refetch en window focus (usuarios necesitan ver balance actual)
3. **Lotteries/Schedules:** Cachear fuerte (cambian raramente)
4. **Results:** Cachear fuerte (datos históricos, no cambian)

---

## 🧪 Testing

Después de implementar:

```typescript
// Agregar en cada hook optimizado
if (import.meta.env.DEV) {
  console.log('[Cache] Fetching:', queryKey, {
    staleTime,
    gcTime,
    refetchOnWindowFocus,
  });
}
```

Verificar en DevTools → Network:
- Menos requests al navegar
- Requests solo cuando data está "stale"
- No requests innecesarios en focus/reconnect

---

**Creado:** 2025-12-08
**Para próxima optimización:** Implementar Fase 1 primero
