# Realtime Tickets — Documentación de Implementación

## Objetivo

Permitir que los admins vean tickets nuevos y modificados en tiempo real sin necesidad de recargar la página, usando una arquitectura híbrida: Supabase Realtime en el backend + SSE hacia el frontend.

---

## Infraestructura

```
Browser (Vercel CDN)
    ↓ requests normales → api-proxy.ts (Vercel Function) → Railway
    ↓ SSE / WS          → Railway directo (sin proxy)
```

| Capa | Plataforma | Notas |
|------|-----------|-------|
| Frontend (React/Vite) | Vercel (static) | CDN global |
| API (Express) | Railway | Servidor persistente, soporta SSE y WebSockets |
| Base de datos | Supabase (PostgreSQL) | Realtime vía WAL |

### El proxy de Vercel y sus limitaciones

Todas las llamadas del frontend a `/api/*` pasan por `web/api/api-proxy.ts`, una Vercel serverless function que actúa como proxy hacia Railway. Esta función termina con:

```ts
const buf = Buffer.from(await resp.arrayBuffer()); // ← bloquea hasta tener la respuesta completa
res.end(buf);
```

Esto hace que **SSE y WebSockets sean incompatibles con el proxy**:
- SSE nunca termina → la función queda colgada → Vercel la mata (timeout 10s Hobby / 5 min Pro) → `TypeError: terminated`
- WebSocket requiere un upgrade de protocolo que el proxy HTTP no soporta

**Solución para cualquier conexión persistente: el frontend debe conectarse directo a Railway**, saltando el proxy de Vercel. Esto aplica a todos los endpoints de SSE o WebSocket presentes y futuros.

> **Nota histórica:** El SSE de sesiones (`GET /api/private/auth/stream`) fue removido por este motivo (commit `45a8aae`) y reemplazado por polling cada 5 minutos. Una vez implementada la conexión directa a Railway, podría restaurarse. Por ahora el polling es suficiente para ese caso de uso.

---

## Patrón para conexiones persistentes (SSE / WebSocket)

Cualquier endpoint que requiera una conexión persistente debe seguir este patrón:

### 1. Variable de entorno en el frontend

```
VITE_API_DIRECT_URL=https://tu-app.railway.app
```

Esta variable apunta directamente a Railway, sin pasar por el proxy de Vercel.

### 2. Constante de URL directa en el frontend

```ts
// web/src/lib/directApiClient.ts (o similar)
export const DIRECT_API_BASE = import.meta.env.VITE_API_DIRECT_URL ?? 'http://localhost:3000';
```

### 3. Uso en el frontend para SSE

```ts
const es = new EventSource(`${DIRECT_API_BASE}/api/private/ticket/stream`, {
  withCredentials: true,
});
```

El resto de las requests (JSON) siguen pasando por el proxy de Vercel normalmente — no hay que cambiar nada del `apiClient` existente.

---

## Arquitectura de tickets en tiempo real

```
Cashier crea/modifica ticket
        ↓
  Supabase DB (tickets table)
        ↓
  WAL (Write-Ahead Log)
        ↓
  Supabase Realtime (WebSocket)
        ↓
  Express backend listener (1 conexión)
        ↓
  TicketSSEManager.broadcast(org_id, payload)
        ↓
  Admin 1 (SSE)   Admin 2 (SSE)   Admin N (SSE)
  (conexión directa a Railway, sin proxy Vercel)
```

### Por qué backend en el medio y no frontend directo a Supabase Realtime

Si el frontend se suscribiera directamente a Supabase Realtime, cada admin abriría una conexión Realtime hacia Supabase (N conexiones). Con el backend como intermediario, Supabase ve **1 sola conexión** independientemente de cuántos admins estén conectados.

---

## Impacto en rendimiento

### Base de datos

| Cambio | Impacto |
|---|---|
| `REPLICA IDENTITY FULL` en tabla `tickets` | Cada UPDATE/DELETE escribe la fila entera en el WAL en lugar de solo las columnas modificadas. Overhead mínimo a la escala de esta app. |
| Queries adicionales | Ninguna. Realtime lee el WAL directamente. |
| Replication slot | 1 slot adicional en Postgres. Supabase lo gestiona automáticamente. |

### Express server

| Recurso | Impacto |
|---|---|
| Memoria | ~pocos KB por admin conectado (`Set<Response>` por org) |
| CPU | Casi cero — solo `res.write()` al recibir un evento |
| Conexiones abiertas | 1 WebSocket hacia Supabase + 1 socket por admin conectado |

### Comparado con polling

| | Polling (30s) | SSE + Realtime |
|---|---|---|
| Requests al backend | N admins × 2/min | 0 |
| DB queries | N × 2/min | 0 |
| Latencia del update | Hasta 30s | < 1s |
| Bandwidth | Respuesta completa cada poll | Solo el ticket que cambió |

---

## Tradeoffs

### A favor

- Cero código adicional en los controllers — cualquier cambio en la tabla lo dispara automáticamente, incluyendo cambios directos en DB o migraciones.
- Supabase ve 1 sola conexión desde el backend, no N desde los frontends.
- Latencia real < 1 segundo desde la escritura en DB hasta que el admin lo ve.
- Railway soporta conexiones persistentes sin límite de tiempo.

### En contra

- Requiere habilitar `REPLICA IDENTITY FULL` en la tabla `tickets` (migración).
- Requiere habilitar la tabla en la publicación `supabase_realtime` (migración).
- La suscripción Realtime del backend es una conexión persistente hacia Supabase — si cae, hay que reconectar. Supabase JS client maneja la reconexión automáticamente.
- Si el servidor Express se reinicia, los admins pierden la conexión SSE y `EventSource` reconecta automáticamente (built-in del browser).
- El frontend necesita `VITE_API_DIRECT_URL` configurada en Vercel para conectarse directo a Railway en producción.

### Escenario no soportado

Si la app escala a múltiples instancias del servidor (horizontal scaling), cada instancia tendría su propio `TicketSSEManager`. Un evento de Supabase Realtime llegaría solo a la instancia suscripta y no se propagaría a las otras. **Este escenario no aplica hoy** (single instance en Railway). Si se necesitara en el futuro, la solución sería usar Redis Pub/Sub como broker entre instancias.

---

## Archivos a crear / modificar

### Backend

| Archivo | Acción | Descripción |
|---|---|---|
| `api/src/ticket/sse/ticket-sse.manager.ts` | Crear | Singleton `TicketSSEManager`. Map de `org_id → Set<Response>`. |
| `api/src/ticket/realtime/ticket-realtime.listener.ts` | Crear | Suscripción a Supabase Realtime. Llama a `TicketSSEManager.broadcast()` en cada evento. |
| `api/src/ticket/route/ticket.route.ts` | Modificar | Agregar `GET /api/private/ticket/stream` — endpoint SSE pasivo. |
| `api/src/index.ts` | Modificar | Llamar a `startTicketRealtimeListener()` al arrancar el servidor. |
| `api/supabase/migrations/YYYYMMDDHHMMSS_enable_tickets_realtime.sql` | Crear | `REPLICA IDENTITY FULL` + `ALTER PUBLICATION`. |

### Frontend

| Archivo | Acción | Descripción |
|---|---|---|
| `web/routes/routes.ts` | Modificar | Agregar `ticket.stream` (sin `/api` prefix — se construye con `DIRECT_API_BASE`). |
| `web/src/hooks/fetchs/tickets/useTickets.ts` | Modificar | Agregar `useEffect` con `EventSource` apuntando a `DIRECT_API_BASE`. Al recibir evento → `queryClient.invalidateQueries`. |
| `web/.env.production` / Vercel env vars | Modificar | Agregar `VITE_API_DIRECT_URL=https://tu-app.railway.app`. |

---

## Implementación detallada

### 1. Migración SQL

```sql
-- api/supabase/migrations/YYYYMMDDHHMMSS_enable_tickets_realtime.sql

-- Necesario para que UPDATE y DELETE incluyan la fila completa en payload.old
ALTER TABLE tickets REPLICA IDENTITY FULL;

-- Habilitar Realtime en la tabla
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
```

### 2. `TicketSSEManager`

```ts
// api/src/ticket/sse/ticket-sse.manager.ts

import { Response } from 'express';

class TicketSSEManager {
  // organization_id → conjunto de conexiones abiertas de admins
  private connections = new Map<string, Set<Response>>();

  add(orgId: string, res: Response): void {
    if (!this.connections.has(orgId)) {
      this.connections.set(orgId, new Set());
    }
    this.connections.get(orgId)!.add(res);
  }

  remove(orgId: string, res: Response): void {
    const orgConnections = this.connections.get(orgId);
    if (!orgConnections) return;
    orgConnections.delete(res);
    if (orgConnections.size === 0) this.connections.delete(orgId);
  }

  broadcast(orgId: string, payload: object): void {
    const orgConnections = this.connections.get(orgId);
    if (!orgConnections || orgConnections.size === 0) return;

    const data = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of orgConnections) {
      try {
        res.write(data);
      } catch {
        // Conexión muerta — se limpia en req.on('close')
        orgConnections.delete(res);
      }
    }
  }

  stats(): { orgs: number; connections: number } {
    let total = 0;
    for (const set of this.connections.values()) total += set.size;
    return { orgs: this.connections.size, connections: total };
  }
}

export const ticketSSEManager = new TicketSSEManager();
```

### 3. Supabase Realtime listener

```ts
// api/src/ticket/realtime/ticket-realtime.listener.ts

import { supabase } from '@database/db.connection';
import { ticketSSEManager } from '../sse/ticket-sse.manager';

export function startTicketRealtimeListener(): void {
  supabase
    .channel('ticket-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tickets' },
      (payload) => {
        const orgId =
          (payload.new as { organization_id?: string })?.organization_id ??
          (payload.old as { organization_id?: string })?.organization_id;

        if (!orgId) return;

        ticketSSEManager.broadcast(orgId, {
          type: `ticket_${payload.eventType.toLowerCase()}`, // ticket_insert | ticket_update | ticket_delete
          ticket: payload.new ?? payload.old,
        });
      }
    )
    .subscribe((status) => {
      console.log(`[TicketRealtime] Status: ${status}`);
    });

  console.log('[TicketRealtime] Listener started');
}
```

### 4. Endpoint SSE en el route de tickets

```ts
// En ticket.route.ts — agregar en setupPrivateRoutes():
this.router.get('/stream', this.ticketStreamHandler);

private ticketStreamHandler = asyncHandler(async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const orgId = req.organization_id!;
  ticketSSEManager.add(orgId, res);
  res.write('data: {"type":"connected"}\n\n');

  req.on('close', () => ticketSSEManager.remove(orgId, res));
});
```

### 5. Frontend — hook de tickets

```ts
// En useTickets.ts o en un hook dedicado useTicketStream.ts

const DIRECT_API_BASE = import.meta.env.VITE_API_DIRECT_URL ?? 'http://localhost:3000';

useEffect(() => {
  if (!organizationId) return;

  // Conexión directa a Railway — no pasa por el proxy de Vercel
  const es = new EventSource(`${DIRECT_API_BASE}/api/private/ticket/stream`, {
    withCredentials: true,
  });

  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as { type: string };
      if (data.type.startsWith('ticket_')) {
        void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      }
    } catch {
      // ignore malformed messages
    }
  };

  return () => es.close();
}, [organizationId, queryClient]);
```

---

## Eventos que se emiten

| Evento | Cuándo | `payload.ticket` |
|---|---|---|
| `ticket_insert` | Nuevo ticket creado | Datos del ticket nuevo |
| `ticket_update` | Ticket modificado (pagado, editado) | Datos del ticket actualizado |
| `ticket_delete` | Ticket eliminado | Datos del ticket eliminado |

---

## Consideraciones de seguridad

- El endpoint `/ticket/stream` pasa por `isAuthenticated` — solo usuarios autenticados pueden conectarse.
- El broadcast filtra por `organization_id` — un admin solo recibe eventos de su propia organización.
- Al conectarse directo a Railway (sin proxy Vercel), las cookies de autenticación deben incluirse con `withCredentials: true`. Railway debe tener el origen de Vercel en su CORS allowlist.
- Los datos del ticket que se broadcastan vienen directamente de Supabase Realtime (`payload.new`). Si el ticket contiene información sensible que no debería llegar al frontend, hay que filtrar los campos antes del broadcast.

---

## CORS — configuración requerida en Railway

Al conectarse directo a Railway desde el browser (saltando el proxy de Vercel), Railway debe aceptar el origen del frontend:

```ts
// api/src/index.ts — asegurar que el origen de Vercel esté en la allowlist
const allowedOrigins = [
  'https://quini-app.vercel.app',
  'http://localhost:5173',
  // otros orígenes según env
];
```

Esto probablemente ya está configurado (las cookies de auth ya funcionan), pero vale verificarlo.

---

## Orden de implementación sugerido

1. Agregar `VITE_API_DIRECT_URL` en Vercel env vars y en `.env.local` de desarrollo
2. Crear migración SQL y aplicarla
3. Crear `TicketSSEManager`
4. Crear `startTicketRealtimeListener`
5. Agregar endpoint `/ticket/stream` en el route
6. Registrar listener en `index.ts`
7. Implementar `EventSource` en el frontend usando `DIRECT_API_BASE`
8. Verificar CORS en Railway para el origen de Vercel
9. Probar creando un ticket desde un cashier y verificando que aparece en el panel del admin sin recargar
