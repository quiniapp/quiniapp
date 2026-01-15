# Plan de Implementación: Sistema de Grupos

## Prerequisito
Este plan debe implementarse DESPUÉS de completar el sistema de organizaciones (ver `org.md`).

---

## Objetivo
Implementar un sistema de grupos dentro de cada organización que permita agrupar usuarios (principalmente cashiers) para mejor organización y gestión.

---

## Modelo de Datos

### Nueva tabla: `groups`
```sql
CREATE TABLE groups (
  group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(organization_id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,

  -- Un grupo es único por nombre dentro de su organización
  CONSTRAINT unique_group_name_per_org UNIQUE (organization_id, name)
);

CREATE INDEX idx_groups_org_id ON groups(organization_id);
CREATE INDEX idx_groups_active ON groups(deleted_at) WHERE deleted_at IS NULL;
```

### Relación con Users
La tabla `users` ya tiene el campo `group_id`. Solo necesitamos:
```sql
-- Agregar foreign key a la tabla existente
ALTER TABLE users ADD CONSTRAINT fk_users_group
  FOREIGN KEY (group_id) REFERENCES groups(group_id) ON DELETE SET NULL;
```

---

## Estructura de Grupos

```
Organization
  └── Group 1
  │     └── Cashier A
  │     └── Cashier B
  │     └── Admin X (opcional)
  │
  └── Group 2
  │     └── Cashier C
  │     └── Cashier D
  │
  └── Sin grupo (usuarios no asignados)
        └── Cashier E
```

### Reglas:
- Un grupo pertenece a UNA organización
- Un usuario puede pertenecer a UN grupo o a ninguno
- SUPERADMIN y ADMIN pueden gestionar grupos
- Los grupos son opcionales (usuarios pueden no tener grupo)

---

## Tipo TypeScript

Ya existe parcialmente en `helper/types/group.type.ts`:

```typescript
export interface IGroupEntityBack {
  group_id: string;
  organization_id: string;  // NUEVO
  name: string;
  created_at: string | Date;
  edited_at: string | Date;
  deleted_at: string | null | Date;
}

export type IGroupEntityFront = Omit<
  IGroupEntityBack,
  'created_at' | 'deleted_at' | 'edited_at'
>;
```

---

## Backend: Módulo de Grupos

### Nuevos archivos:
- `api/src/group/repository/group.repository.ts`
- `api/src/group/controller/group.controller.ts`
- `api/src/group/route/group.route.ts`
- `api/src/group/helper/group.parse.ts`

### Endpoints:

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/api/private/group` | Listar grupos de la org | SUPERADMIN, ADMIN |
| GET | `/api/private/group/:id` | Obtener grupo por ID | SUPERADMIN, ADMIN |
| POST | `/api/private/group` | Crear grupo | SUPERADMIN, ADMIN |
| PUT | `/api/private/group/:id` | Actualizar grupo | SUPERADMIN, ADMIN |
| DELETE | `/api/private/group/:id` | Eliminar grupo (soft) | SUPERADMIN, ADMIN |
| POST | `/api/private/group/:id/users` | Asignar usuarios a grupo | SUPERADMIN, ADMIN |
| DELETE | `/api/private/group/:id/users/:userId` | Quitar usuario de grupo | SUPERADMIN, ADMIN |

### Repository:
```typescript
class GroupRepository {
  async getAll(organization_id: string): Promise<IGroupEntityBack[]>
  async getById(group_id: string, organization_id: string): Promise<IGroupEntityBack>
  async create(group: Omit<IGroupEntityBack, 'group_id' | 'created_at' | 'edited_at' | 'deleted_at'>): Promise<IGroupEntityBack>
  async update(group_id: string, organization_id: string, payload: Partial<IGroupEntityBack>): Promise<IGroupEntityBack>
  async delete(group_id: string, organization_id: string): Promise<void>
  async assignUsers(group_id: string, user_ids: string[]): Promise<void>
  async removeUser(group_id: string, user_id: string): Promise<void>
  async getUsersByGroup(group_id: string, organization_id: string): Promise<IUserEntityBack[]>
}
```

---

## Frontend: UI de Grupos

### Página existente (skeleton):
`web/src/features/groups/index.tsx` - Ya existe pero está vacía

### Componentes a crear:
- `GroupList.tsx` - Lista de grupos con tabla
- `GroupForm.tsx` - Formulario crear/editar grupo
- `GroupUserAssignment.tsx` - Panel para asignar usuarios
- `GroupDeleteModal.tsx` - Confirmación de eliminación

### Hooks a crear:
```typescript
// web/src/hooks/fetchs/groups/useGroups.ts
export const useGroups = () => {
  return useQuery({
    queryKey: ['groups'],
    queryFn: () => fetchGroups(),
  });
};

// web/src/hooks/mutations/groups/useCreateGroup.ts
export const useCreateGroup = () => {
  return useMutation({
    mutationFn: (data: CreateGroupDTO) => createGroup(data),
    onSuccess: () => queryClient.invalidateQueries(['groups']),
  });
};

// ... useUpdateGroup, useDeleteGroup, useAssignUsersToGroup
```

### Actualizar formulario de usuario:
`web/src/features/user-list/user-list-form.tsx`
- Descomentar y activar el campo `group_id`
- Agregar selector de grupos (dropdown)

### Actualizar modal de edición:
`web/src/components/modals/UpdateUserModal.tsx`
- Agregar selector de grupos

---

## Secuencia de Implementación

```
1. [ ] Migración: Crear tabla groups
2. [ ] Migración: FK de users.group_id a groups
3. [ ] Tipo TypeScript: Actualizar group.type.ts
4. [ ] Backend: Crear módulo group (repository, controller, route)
5. [ ] Backend: Registrar rutas en router.ts
6. [ ] Frontend: Hooks (useGroups, useCreateGroup, etc.)
7. [ ] Frontend: Componentes de grupos
8. [ ] Frontend: Implementar página de grupos
9. [ ] Frontend: Actualizar formularios de usuario
10. [ ] Testing
```

---

## Casos de Uso

### 1. Crear grupo
```
SUPERADMIN/ADMIN → POST /api/private/group
Body: { name: "Zona Norte" }
→ Se crea grupo con organization_id del usuario autenticado
```

### 2. Asignar usuarios a grupo
```
SUPERADMIN/ADMIN → POST /api/private/group/:id/users
Body: { user_ids: ["uuid1", "uuid2"] }
→ Se actualiza users.group_id para los usuarios especificados
```

### 3. Ver usuarios de un grupo
```
SUPERADMIN/ADMIN → GET /api/private/group/:id/users
→ Lista de usuarios que pertenecen al grupo
```

### 4. Mover usuario a otro grupo
```
SUPERADMIN/ADMIN → PUT /api/private/user/:id
Body: { group_id: "nuevo-grupo-uuid" }
→ Se actualiza el grupo del usuario
```

### 5. Quitar usuario de grupo
```
SUPERADMIN/ADMIN → PUT /api/private/user/:id
Body: { group_id: null }
→ Usuario queda sin grupo
```

---

## Filtros y Reportes (Futuro)

Una vez implementados los grupos, se pueden agregar filtros en:
- Lista de tickets (filtrar por grupo)
- Reportes de ventas (agrupar por grupo)
- Cuenta corriente (ver por grupo)
- Dashboard (métricas por grupo)

---

## Notas

- Los grupos son **opcionales** - no todos los usuarios necesitan uno
- Al eliminar un grupo, los usuarios quedan con `group_id = NULL`
- La validación asegura que solo se asignen usuarios de la misma organización
- El nombre del grupo debe ser único dentro de la organización
