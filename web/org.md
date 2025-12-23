# Frontend - Multi-Tenancy (Organizaciones)

**Fecha**: 2025-12-15
**Estado**: Pendiente de implementación
**Backend**: ✅ Completado (Fases 1-8)

---

## Resumen

Implementar soporte de organizaciones en el frontend. El backend ya devuelve `organization_id` en el usuario autenticado (JWT), por lo que **no se requieren cambios en hooks de datos** - todo el filtrado ocurre automáticamente en el backend.

### Cambios Mínimos Requeridos:
1. ✅ AuthProvider ya expone el usuario completo (incluye `organization_id`)
2. No hay cambios en hooks (TanStack Query ya usa el contexto correcto)
3. *Opcional*: UI de gestión de organizaciones (solo OWNER)

---

## Fase 9: Frontend - Plan de Implementación

### 1. Verificar Tipos (5 min)

**Archivos a revisar:**
- `web/src/types/user.types.ts` o equivalente

**Acción:**
Confirmar que el tipo de usuario incluye `organization_id`:
```typescript
export interface User {
  user_id: string;
  name: string;
  email: string;
  user_type: 'OWNER' | 'SUPERADMIN' | 'ADMIN' | 'CASHIER';
  organization_id: string; // ← Debe estar presente
  // ... otros campos
}
```

**Si no existe:** Agregar `organization_id: string` al tipo de usuario.

---

### 2. Verificar AuthProvider (5 min)

**Archivo:** `web/src/providers/AuthProvider.tsx`

**Acción:**
Confirmar que el usuario completo se expone en el contexto:
```typescript
// El contexto ya debería exponer:
const { user } = useAuth();
// user.organization_id debe estar disponible ✅
```

**Validación:**
- El usuario viene del backend con `organization_id`
- No se necesita cambio si ya se expone el objeto `user` completo

---

### 3. Verificar Hooks de Datos (10 min)

**Archivos a revisar:**
- `web/src/hooks/useTickets.ts`
- `web/src/hooks/useLotteries.ts`
- `web/src/hooks/useResults.ts`
- etc.

**Acción:**
**NO SE REQUIEREN CAMBIOS** - Los hooks ya llaman a endpoints que:
1. Reciben `req.organization_id` del middleware de autenticación
2. Filtran automáticamente por organización en el backend

**Ejemplo** (ya funciona correctamente):
```typescript
// ✅ Este código NO necesita cambios
export const useTickets = (date: string) => {
  return useQuery({
    queryKey: ['tickets', date],
    queryFn: () => ticketService.getAll(date),
  });
};
```

El backend recibe el JWT con `organization_id` y filtra automáticamente.

---

### 4. Testing Manual (15 min)

**Pasos:**
1. Login con usuario existente
2. Verificar en DevTools que `user.organization_id` existe
3. Crear un ticket/apuesta
4. Confirmar que se creó con `organization_id` correcto en la base de datos
5. Verificar que solo se ven datos de la organización del usuario

**Queries de verificación en Supabase:**
```sql
-- Ver tickets con organization_id
SELECT ticket_id, ticket_number, organization_id, user_id
FROM tickets
ORDER BY created_at DESC
LIMIT 10;

-- Ver organización del usuario
SELECT u.name, u.user_type, o.name as org_name
FROM users u
JOIN organizations o ON u.organization_id = o.organization_id
WHERE u.user_id = '<user_id>';
```

---

## (Opcional) UI de Gestión de Organizaciones

**Solo para OWNER** - Puede implementarse después

### 5.1 Crear Página de Organizaciones (30 min)

**Nuevo archivo:** `web/src/pages/Organizations/OrganizationsPage.tsx`

```typescript
import { useOrganizations } from '@/hooks/useOrganizations';
import { useAuth } from '@/providers/AuthProvider';

export const OrganizationsPage = () => {
  const { user } = useAuth();
  const { data: organizations, isLoading } = useOrganizations();

  // Solo OWNER puede acceder
  if (user?.user_type !== 'OWNER') {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div>
      <h1>Organizaciones</h1>
      {/* Lista de organizaciones */}
      {/* Botón crear organización */}
      {/* Tabla con nombre, fecha creación, acciones */}
    </div>
  );
};
```

### 5.2 Crear Hook de Organizaciones (20 min)

**Nuevo archivo:** `web/src/hooks/useOrganizations.ts`

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import { organizationService } from '@/services/organization.service';

export const useOrganizations = () => {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: () => organizationService.getAll(),
  });
};

export const useCreateOrganization = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => organizationService.create({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries(['organizations']);
    },
  });
};
```

### 5.3 Crear Service de Organizaciones (15 min)

**Nuevo archivo:** `web/src/services/organization.service.ts`

```typescript
import { api } from './api';

export const organizationService = {
  getAll: async () => {
    const { data } = await api.get('/api/private/organization');
    return data.data.organizations;
  },

  getById: async (id: string) => {
    const { data } = await api.get(`/api/private/organization/${id}`);
    return data.data.organization;
  },

  create: async (org: { name: string }) => {
    const { data } = await api.post('/api/private/organization', {
      newOrganization: org,
    });
    return data.data.organization;
  },

  update: async (id: string, org: { name: string }) => {
    const { data } = await api.put(`/api/private/organization/${id}`, {
      updateOrganization: org,
    });
    return data.data.organization;
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`/api/private/organization/${id}`);
    return data.data.organization;
  },
};
```

### 5.4 Agregar Ruta (5 min)

**Archivo:** `web/src/App.tsx` o router principal

```typescript
// Solo para OWNER
<Route
  path="/organizations"
  element={
    <ProtectedRoute allowedRoles={['OWNER']}>
      <OrganizationsPage />
    </ProtectedRoute>
  }
/>
```

### 5.5 Agregar Link en Navegación (5 min)

**Archivo:** Sidebar o navbar

```typescript
{user?.user_type === 'OWNER' && (
  <NavLink to="/organizations">
    <Building2 className="h-4 w-4" />
    Organizaciones
  </NavLink>
)}
```

---

## Checklist de Implementación

### Mínimo Viable (30 min)
- [ ] Verificar tipo de usuario incluye `organization_id`
- [ ] Confirmar AuthProvider expone usuario completo
- [ ] Testing manual: crear ticket y verificar `organization_id`
- [ ] Testing manual: confirmar filtrado por organización funciona

### Opcional - UI Gestión (2 horas)
- [ ] Crear página OrganizationsPage
- [ ] Crear hook useOrganizations
- [ ] Crear service organizationService
- [ ] Agregar ruta protegida (solo OWNER)
- [ ] Agregar link en navegación

---

## Notas Importantes

### ✅ Lo que NO necesitas cambiar:
- Hooks de datos (useTickets, useLotteries, etc.)
- Servicios API existentes
- Componentes existentes
- Queries de TanStack Query

### ⚠️ Lo único que cambia:
- El backend ahora filtra automáticamente por `organization_id`
- Cada usuario solo ve/modifica datos de su organización
- El `organization_id` viene en el JWT, no se pasa manualmente

### 🔒 Seguridad:
- El middleware de autenticación (`api/middlewares/auth.middleware.ts`) extrae `organization_id` del JWT
- Todos los endpoints usan `req.organization_id` automáticamente
- **No es posible** acceder a datos de otra organización desde el frontend

---

## Testing Post-Implementación

### Escenario 1: Usuario de Organización "Leo Chimento"
1. Login como usuario de org "Leo Chimento"
2. Ver que `user.organization_id` apunta a esa org
3. Crear tickets/apuestas
4. Confirmar que SOLO ves tus datos

### Escenario 2: Crear Nueva Organización (OWNER)
1. Login como OWNER
2. Crear organización "Organización Test"
3. Crear usuario en "Organización Test"
4. Login con ese usuario
5. Confirmar aislamiento total de datos

### Escenario 3: Verificar Aislamiento
1. En Supabase, verificar que todos los registros tienen `organization_id`
2. Intentar acceder a datos de otra org (debe fallar/vacío)
3. Confirmar que cada usuario solo ve su organización

---

## Migración de Datos Existentes

**Ya completada en backend** (Fase 1):
- ✅ Todos los datos existentes se asignaron a "Leo Chimento"
- ✅ Cada tabla tiene `organization_id NOT NULL`
- ✅ Constraints de FK configurados

**No se requiere migración de frontend** - todo funciona automáticamente.

---

## Próximos Pasos (Futuro)

### Grupos (Próxima Feature)
Ver `quiniapp/group.md` para el plan de implementación de grupos dentro de organizaciones.

### Multi-Organización para SUPERADMIN
Si un SUPERADMIN puede pertenecer a múltiples organizaciones:
- Agregar selector de organización en navbar
- Actualizar JWT al cambiar organización activa
- Persistir organización seleccionada en localStorage

---

## Resumen Ejecutivo

**Tiempo estimado total:** 30 min (mínimo) a 2.5 horas (con UI)

**Complejidad:** BAJA
- El backend hace todo el trabajo pesado
- El frontend solo expone `organization_id` del usuario
- No hay lógica de negocio nueva en frontend

**Riesgo:** MÍNIMO
- Cambios no-invasivos
- Backward compatible (datos migrados)
- Testing fácil

**Recomendación:**
1. Empezar con validación mínima (30 min)
2. Si todo funciona, implementar UI de gestión (opcional)
3. Dejar grupos para una siguiente iteración
