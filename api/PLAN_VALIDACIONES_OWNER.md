# Plan de Implementación: Validaciones de OWNER

## Resumen Ejecutivo

Implementar validaciones para garantizar la integridad del sistema de roles OWNER:

1. **Solo 1 OWNER en el sistema**: Debe existir exactamente un usuario con `user_type='OWNER'` en toda la base de datos
2. **OWNER no se puede borrar**: El usuario OWNER no puede ser eliminado (excepto con acceso directo a la base de datos)
3. **Organización del OWNER protegida**: La organización asignada al OWNER (vía `organization_id`) no puede ser eliminada
4. **Organización del OWNER oculta**: La organización del OWNER no se envía al frontend en respuestas de `getAll()`

---

## Requisitos Confirmados

- **OWNER único**: Solo puede existir 1 usuario con `user_type='OWNER'` en todo el sistema
- **Organización del OWNER**: Es la organización a la que está asignado el usuario OWNER mediante su campo `organization_id`
- **Error handling**: Retornar códigos HTTP 403/400 con mensajes descriptivos cuando se violen las restricciones

---

## Fase 1: Tipos de Error y Mensajes

### Archivo: `helper/types/errors.type.ts`

**Agregar nuevos tipos al enum `ERROR_TYPE`:**

```typescript
export enum ERROR_TYPE {
  // ... tipos existentes ...
  OWNER_ALREADY_EXISTS,
  CANNOT_DELETE_OWNER,
  CANNOT_DELETE_OWNER_ORGANIZATION,
  OWNER_USER_NOT_FOUND,
}
```

**Agregar mensajes al objeto `ERROR_MESSAGE`:**

```typescript
export const ERROR_MESSAGE = {
  // ... mensajes existentes ...
  OWNER_ALREADY_EXISTS: 'Ya existe un usuario OWNER en el sistema',
  CANNOT_DELETE_OWNER: 'El usuario OWNER no puede ser eliminado',
  CANNOT_DELETE_OWNER_ORGANIZATION: 'La organización del OWNER no puede ser eliminada',
  OWNER_USER_NOT_FOUND: 'No se encontró el usuario OWNER',
};
```

---

## Fase 2: Métodos de Repositorio

### 2.1 User Repository

**Archivo: `api/src/user/repository/user.repository.ts`**

Agregar los siguientes métodos a la clase `UserRepository`:

#### Método 1: `getOwnerUser()`
Encuentra el usuario OWNER del sistema.

```typescript
/**
 * Obtiene el usuario OWNER del sistema
 * @returns El usuario OWNER o null si no existe
 */
async getOwnerUser(): Promise<IUserEntityBack | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('user_type', USER_TYPE.OWNER)
    .is('deleted_at', null)
    .single();

  if (error) {
    // Si no se encuentra, retornar null en lugar de lanzar error
    if (error.code === 'PGRST116') return null;
    throw new Error(error.details);
  }
  return data;
}
```

#### Método 2: `isOwnerUser(user_id: string)`
Verifica si un usuario específico es el OWNER.

```typescript
/**
 * Verifica si un usuario es el OWNER
 * @param user_id - ID del usuario a verificar
 * @returns true si el usuario es OWNER, false en caso contrario
 */
async isOwnerUser(user_id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('user_type')
    .eq('user_id', user_id)
    .eq('user_type', USER_TYPE.OWNER)
    .is('deleted_at', null)
    .single();

  if (error) return false;
  return data !== null;
}
```

#### Método 3: `getByIdWithoutOrgFilter(id: string)`
Obtiene un usuario por ID sin filtrar por organización (para checks internos).

```typescript
/**
 * Obtiene un usuario por ID sin filtrar por organización
 * Útil para validaciones internas que necesitan acceso global
 * @param id - ID del usuario
 * @returns El usuario o null si no existe
 */
async getByIdWithoutOrgFilter(id: string): Promise<IUserEntityBack | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', id)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.details);
  }
  return data;
}
```

### 2.2 Organization Repository

**Archivo: `api/src/organization/repository/organization.repository.ts`**

Agregar los siguientes métodos a la clase `OrganizationRepository`:

#### Método 1: `hasOwnerUser(organization_id: string)`
Verifica si una organización tiene el usuario OWNER asignado.

```typescript
/**
 * Verifica si una organización tiene el usuario OWNER
 * @param organization_id - ID de la organización
 * @returns true si la organización tiene el OWNER, false en caso contrario
 */
async hasOwnerUser(organization_id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('user_id')
    .eq('organization_id', organization_id)
    .eq('user_type', USER_TYPE.OWNER)
    .is('deleted_at', null)
    .limit(1);

  if (error) throw new Error(error.details);
  return data && data.length > 0;
}
```

#### Método 2: `getOwnerOrganizationId()`
Obtiene el `organization_id` del usuario OWNER.

```typescript
/**
 * Obtiene el organization_id del usuario OWNER
 * @returns El organization_id del OWNER o null si no existe/no tiene organización
 */
async getOwnerOrganizationId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('organization_id')
    .eq('user_type', USER_TYPE.OWNER)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.details);
  }
  return data?.organization_id || null;
}
```

---

## Fase 3: Validaciones en Controllers

### 3.1 User Controller

**Archivo: `api/src/user/controller/user.controller.ts`**

#### Modificación 1: Método `create` (línea ~17)

Agregar validación para prevenir la creación de un segundo OWNER.

```typescript
create = async (newUser: INewUserEntity, organization_id: string): Promise<IUserEntityFront> => {
  // ✅ NUEVO: Validar que no exista otro OWNER
  if (newUser.user_type === USER_TYPE.OWNER) {
    const existingOwner = await this.repository.getOwnerUser();
    if (existingOwner) {
      throw new Error(ERROR_MESSAGE.OWNER_ALREADY_EXISTS);
    }
  }

  const user = await buildUserForDB(newUser, organization_id);
  try {
    const result = await this.repository.create(user);
    // ... resto del código existente ...
  } catch (error) {
    // ... manejo de errores existente ...
  }
};
```

#### Modificación 2: Método `update` (línea ~64)

Agregar validación para prevenir cambiar un usuario a OWNER cuando ya existe uno.

```typescript
update = async (
  user_id: string,
  props: IUpdateUserEntity,
  organization_id: string
): Promise<IUserEntityFront> => {
  try {
    // ✅ NUEVO: Validar que no se pueda cambiar a OWNER si ya existe uno
    if (props.user_type === USER_TYPE.OWNER) {
      const existingOwner = await this.repository.getOwnerUser();
      if (existingOwner && existingOwner.user_id !== user_id) {
        throw new Error(ERROR_MESSAGE.OWNER_ALREADY_EXISTS);
      }
    }

    const result = await this.repository.update(user_id, props, organization_id);
    return parseUser(result);
  } catch (error) {
    console.error('Update error:', error);
    throw error instanceof Error ? error : new Error('Unknown error');
  }
};
```

#### Modificación 3: Método `delete` (línea ~93)

Agregar validación para prevenir la eliminación del usuario OWNER.

```typescript
delete = async (props: IDeleteUserEntity, organization_id: string) => {
  try {
    // ✅ NUEVO: Prevenir eliminación del usuario OWNER
    const isOwner = await this.repository.isOwnerUser(props.user_id);
    if (isOwner) {
      throw new Error(ERROR_MESSAGE.CANNOT_DELETE_OWNER);
    }

    const response = await this.repository.delete(props.user_id, organization_id);
    return parseUser(response);
  } catch (error) {
    console.error('Delete error:', error);
    throw error instanceof Error ? error : new Error('Unknown error');
  }
};
```

### 3.2 Organization Controller

**Archivo: `api/src/organization/controller/organization.controller.ts`**

#### Modificación 1: Método `getAll` (línea ~50)

Filtrar la organización del OWNER de las respuestas al frontend.

```typescript
getAll = async (): Promise<IOrganizationEntityFront[]> => {
  try {
    const orgs = await this.repository.getAll();

    // ✅ NUEVO: Filtrar la organización del OWNER
    const ownerOrgId = await this.repository.getOwnerOrganizationId();
    const filteredOrgs = ownerOrgId
      ? orgs.filter(org => org.organization_id !== ownerOrgId)
      : orgs;

    return filteredOrgs.map((org) => parseOrganization(org));
  } catch (error) {
    console.error('Organization getAll error:', error);
    throw error instanceof Error ? error : new Error('Unknown error');
  }
};
```

#### Modificación 2: Método `delete` (línea ~73)

Prevenir la eliminación de la organización del OWNER.

```typescript
delete = async (organization_id: string): Promise<void> => {
  try {
    // ✅ NUEVO: Prevenir eliminación de la organización del OWNER
    const hasOwner = await this.repository.hasOwnerUser(organization_id);
    if (hasOwner) {
      throw new Error(ERROR_MESSAGE.CANNOT_DELETE_OWNER_ORGANIZATION);
    }

    console.log('controller');
    await this.repository.delete(organization_id);
  } catch (error) {
    console.error('Organization delete error:', error);
    throw error instanceof Error ? error : new Error('Unknown error');
  }
};
```

---

## Fase 4: Manejo de Errores en Routes

### 4.1 User Routes

**Archivo: `api/src/user/route/user.route.ts`**

#### Actualizar `newUserhandler`

Agregar manejo específico para el error `OWNER_ALREADY_EXISTS` en el bloque catch:

```typescript
catch (error) {
  if (error instanceof Error) {
    let statusCode = 500;
    let errorType = ERROR_TYPE.AUTH_ERROR;

    // ✅ NUEVO: Manejar error de OWNER ya existe
    if (error.message === ERROR_MESSAGE.OWNER_ALREADY_EXISTS) {
      statusCode = 400;
      errorType = ERROR_TYPE.OWNER_ALREADY_EXISTS;
    }
    else if (
      error.message === ERROR_MESSAGE.USER_NOT_FOUND ||
      error.message === ERROR_MESSAGE.INVALID_CREDENTIALS
    ) {
      statusCode = 401;
    }

    const response: APIResponse<null> = {
      error: {
        error: errorType,
        message: error.message,
      },
    };
    res.status(statusCode).json(response);
    return;
  }
}
```

#### Actualizar `updateUserHandler`

Agregar el mismo manejo de error `OWNER_ALREADY_EXISTS`:

```typescript
catch (error) {
  if (error instanceof Error) {
    let statusCode = 500;
    let errorType = ERROR_TYPE.AUTH_ERROR;

    // ✅ NUEVO: Manejar error de OWNER ya existe
    if (error.message === ERROR_MESSAGE.OWNER_ALREADY_EXISTS) {
      statusCode = 400;
      errorType = ERROR_TYPE.OWNER_ALREADY_EXISTS;
    }
    else if (
      error.message === ERROR_MESSAGE.USER_NOT_FOUND ||
      error.message === ERROR_MESSAGE.INVALID_CREDENTIALS
    ) {
      statusCode = 401;
    }

    const response: APIResponse<null> = {
      error: {
        error: errorType,
        message: error.message,
      },
    };
    res.status(statusCode).json(response);
    return;
  }
}
```

#### Actualizar `deleteUserHandler`

Agregar manejo para el error `CANNOT_DELETE_OWNER`:

```typescript
catch (error) {
  if (error instanceof Error) {
    let statusCode = 500;
    let errorType = ERROR_TYPE.AUTH_ERROR;

    // ✅ NUEVO: Manejar error de no se puede borrar OWNER
    if (error.message === ERROR_MESSAGE.CANNOT_DELETE_OWNER) {
      statusCode = 403;
      errorType = ERROR_TYPE.CANNOT_DELETE_OWNER;
    }
    else if (
      error.message === ERROR_MESSAGE.USER_NOT_FOUND ||
      error.message === ERROR_MESSAGE.INVALID_CREDENTIALS
    ) {
      statusCode = 401;
    }

    const response: APIResponse<null> = {
      error: {
        error: errorType,
        message: error.message,
      },
    };
    res.status(statusCode).json(response);
    return;
  }
}
```

### 4.2 Organization Routes

**Archivo: `api/src/organization/route/organization.route.ts`**

#### Actualizar `deleteHandler`

Agregar manejo para el error `CANNOT_DELETE_OWNER_ORGANIZATION`:

```typescript
try {
  await this.controller.delete(id);
  console.log('route od');
  res.status(200).json({ data: { deleted: true } });
} catch (error) {
  console.error(error);

  let statusCode = 500;
  let errorType = ERROR_TYPE.AUTH_ERROR;
  let errorMessage = error instanceof Error ? error.message : 'Unknown error';

  // ✅ NUEVO: Manejar error de no se puede borrar org del OWNER
  if (error instanceof Error && error.message === ERROR_MESSAGE.CANNOT_DELETE_OWNER_ORGANIZATION) {
    statusCode = 403;
    errorType = ERROR_TYPE.CANNOT_DELETE_OWNER_ORGANIZATION;
  }

  const response: APIResponse<null> = {
    error: {
      error: errorType,
      message: errorMessage,
    },
  };
  res.status(statusCode).json(response);
}
```

---

## Fase 5: Database Constraints (OPCIONAL pero RECOMENDADO)

### 5.1 Crear Migración de Constraint

**Crear archivo**: `api/supabase/migrations/<timestamp>_add_owner_unique_constraint.sql`

Donde `<timestamp>` sigue el formato: `YYYYMMDDHHMMSS` (ej: `20251217150000`)

**Contenido de la migración**:

```sql
-- ============================================================================
-- Migration: Add OWNER Unique Constraint
-- Description: Ensures only one active OWNER user exists in the system
-- Date: 2025-12-17
-- ============================================================================

-- Create unique partial index on user_type for OWNER
-- This prevents multiple OWNER users from existing simultaneously
CREATE UNIQUE INDEX idx_users_single_owner
ON users(user_type)
WHERE user_type = 'OWNER' AND deleted_at IS NULL;

-- Add comment for documentation
COMMENT ON INDEX idx_users_single_owner IS
'Ensures only one active OWNER user exists in the system. Prevents bypassing application-level validations.';

-- ============================================================================
-- Verification Query (for manual testing)
-- ============================================================================
-- SELECT user_id, user_type, organization_id, deleted_at
-- FROM users
-- WHERE user_type = 'OWNER' AND deleted_at IS NULL;
-- Should return exactly 1 row or 0 rows
```

### 5.2 Actualizar Stored Procedure

**Modificar archivo**: El archivo de migración más reciente de `hard_delete_organization`

**Agregar validación antes del DELETE**:

```sql
DROP FUNCTION IF EXISTS public.hard_delete_organization(uuid);

CREATE OR REPLACE FUNCTION public.hard_delete_organization(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY definer
SET search_path = public
AS $$
DECLARE
  has_owner BOOLEAN;
BEGIN
  -- ✅ NUEVO: Verificar si la organización tiene el usuario OWNER
  SELECT EXISTS(
    SELECT 1 FROM public.users
    WHERE organization_id = p_org_id
    AND user_type = 'OWNER'
    AND deleted_at IS NULL
  ) INTO has_owner;

  IF has_owner THEN
    RAISE EXCEPTION 'Cannot delete organization with OWNER user';
  END IF;

  -- HIJAS (más dependientes primero)
  DELETE FROM public.ticket_prizes_by_turn WHERE organization_id = p_org_id;
  DELETE FROM public.bets WHERE organization_id = p_org_id;
  DELETE FROM public.tickets WHERE organization_id = p_org_id;
  DELETE FROM public.current_accounts WHERE organization_id = p_org_id;
  DELETE FROM public.results WHERE organization_id = p_org_id;
  DELETE FROM public.schedule_lotteries WHERE organization_id = p_org_id;
  DELETE FROM public.schedules WHERE organization_id = p_org_id;
  DELETE FROM public.lotteries WHERE organization_id = p_org_id;
  DELETE FROM public.users WHERE organization_id = p_org_id;

  -- PADRE al final
  DELETE FROM public.organizations WHERE organization_id = p_org_id;
END;
$$;

-- Mantener permisos restrictivos
REVOKE ALL ON FUNCTION public.hard_delete_organization(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.hard_delete_organization(uuid) TO service_role;
```

---

## Fase 6: Actualizar CHANGELOGs

### 6.1 Helper CHANGELOG

**Archivo: `helper/CHANGELOG.md`**

Agregar la siguiente entrada en la sección `## [Unreleased]`:

```markdown
### Added - 2025-12-17

#### OWNER Validation Error Types
- **Error Types**: Added OWNER-specific error types and messages in `types/errors.type.ts`
  - `OWNER_ALREADY_EXISTS`: Prevents multiple OWNER users in the system
  - `CANNOT_DELETE_OWNER`: Prevents deletion of OWNER user
  - `CANNOT_DELETE_OWNER_ORGANIZATION`: Prevents deletion of OWNER's organization
  - `OWNER_USER_NOT_FOUND`: Handles missing OWNER scenarios
  - Use case: Enforce single OWNER constraint across the system for data integrity
```

### 6.2 API CHANGELOG

**Archivo: `api/CHANGELOG.md`**

Agregar las siguientes entradas en la sección `## [Unreleased]`:

```markdown
### Added - 2025-12-17

#### OWNER Validation System

**User Repository** (`user/repository/user.repository.ts`)
- `getOwnerUser()`: Find the system OWNER user
- `isOwnerUser(user_id)`: Check if specific user is OWNER
- `getByIdWithoutOrgFilter(id)`: Internal user lookup without organization filter
- Use case: Support OWNER validation logic across controllers

**Organization Repository** (`organization/repository/organization.repository.ts`)
- `hasOwnerUser(organization_id)`: Check if organization has the OWNER user
- `getOwnerOrganizationId()`: Get the organization_id of the OWNER user
- Use case: Protect OWNER's organization from deletion and filtering

**User Controller** (`user/controller/user.controller.ts`)
- Validation in `create()`: Prevent creating multiple OWNER users
- Validation in `update()`: Prevent updating users to OWNER if one already exists
- Validation in `delete()`: Prevent deleting the OWNER user (soft delete protection)
- Use case: Enforce single OWNER constraint at application level

**Organization Controller** (`organization/controller/organization.controller.ts`)
- Modified `getAll()`: Filter out OWNER's organization from responses sent to frontend
- Modified `delete()`: Prevent deleting organization that has the OWNER user
- Use case: Protect OWNER's organization and hide it from UI

**Enhanced Error Handling** (`user/route/user.route.ts` & `organization/route/organization.route.ts`)
- Return HTTP 403 status for OWNER deletion attempts
- Return HTTP 400 status for duplicate OWNER creation attempts
- Specific error messages for each validation failure
- Use case: Provide clear feedback to API consumers

### Changed - 2025-12-17

#### Database Schema

**Migration**: `supabase/migrations/<timestamp>_add_owner_unique_constraint.sql`
- Added UNIQUE partial index `idx_users_single_owner` on `users.user_type` for OWNER
- Enforces single OWNER constraint at database level
- Prevents bypassing application-level validations via direct DB access
- Use case: Final safety layer for data integrity

**Stored Procedure**: `hard_delete_organization`
- Added OWNER check before deletion
- Raises exception if organization has OWNER user
- Use case: Prevent accidental deletion of OWNER's organization via stored procedure
```

---

## Archivos a Modificar - Resumen

### Helper Workspace
1. ✅ `helper/types/errors.type.ts` - Agregar tipos de error
2. ✅ `helper/CHANGELOG.md` - Documentar cambios

### API Workspace
3. ✅ `api/src/user/repository/user.repository.ts` - Métodos OWNER lookup
4. ✅ `api/src/organization/repository/organization.repository.ts` - Métodos org-OWNER
5. ✅ `api/src/user/controller/user.controller.ts` - Validaciones OWNER
6. ✅ `api/src/organization/controller/organization.controller.ts` - Protección org OWNER
7. ✅ `api/src/user/route/user.route.ts` - Manejo de errores
8. ✅ `api/src/organization/route/organization.route.ts` - Manejo de errores
9. ✅ `api/supabase/migrations/<timestamp>_add_owner_unique_constraint.sql` - Constraint BD
10. ✅ `api/CHANGELOG.md` - Documentar cambios

**Total**: 10 archivos

---

## Casos Edge a Considerar

### 1. OWNER sin organization_id
**Escenario**: El usuario OWNER existe pero `organization_id` es `NULL`

**Solución**:
- El método `getOwnerOrganizationId()` retorna `null`
- El filtrado en `getAll()` no filtra ninguna organización (comportamiento seguro)
- Considerar agregar validación en `buildUserForDB` para requerir `organization_id` para OWNER

### 2. Múltiples OWNER ya existentes
**Escenario**: La base de datos ya tiene múltiples usuarios OWNER (corrupción de datos)

**Solución**:
- La migración del índice UNIQUE fallará
- **Acción requerida**: Limpieza de datos antes de aplicar migración
- Script de limpieza:
  ```sql
  -- Identificar OWNERs duplicados
  SELECT user_id, username, organization_id, created_at
  FROM users
  WHERE user_type = 'OWNER' AND deleted_at IS NULL
  ORDER BY created_at ASC;

  -- Mantener solo el OWNER más antiguo, convertir otros a SUPERADMIN
  -- Ejecutar manualmente para cada OWNER extra
  ```

### 3. Creación concurrente de OWNER
**Escenario**: Dos requests API intentan crear OWNER simultáneamente

**Solución**:
- **Nivel aplicación**: Race condition posible (pequeña ventana de tiempo)
- **Nivel base de datos**: El índice UNIQUE previene la inserción concurrente
- Uno de los requests fallará con error de constraint violation
- El manejo de errores debe atrapar este caso

### 4. OWNER intenta auto-eliminarse
**Escenario**: El usuario OWNER intenta eliminarse a sí mismo

**Solución**:
- La validación `isOwnerUser()` bloqueará la operación
- Se retorna error `CANNOT_DELETE_OWNER`
- No hay bypass posible desde la aplicación
- **Única forma**: Acceso directo a la base de datos

### 5. Eliminación de organización vía DB directo
**Escenario**: Admin ejecuta DELETE directo en la base de datos

**Solución**:
- El stored procedure `hard_delete_organization` ahora valida OWNER
- Foreign key constraints previenen huérfanos de usuarios
- Database triggers (si se implementan) proveen capa adicional de seguridad

### 6. Actualizar usuario existente a OWNER
**Escenario**: Cambiar un CASHIER/ADMIN/SUPERADMIN a OWNER cuando ya existe uno

**Solución**:
- Validación en `UserController.update()` verifica existencia de OWNER
- Solo permite actualización a OWNER si no existe otro OWNER
- Excepción: El mismo usuario que ya es OWNER puede ser actualizado
- El índice DB previene duplicados incluso si se bypasea validación

---

## Estrategia de Testing

### Tests Unitarios Requeridos

#### UserRepository
- ✅ `getOwnerUser()` retorna el usuario OWNER cuando existe
- ✅ `getOwnerUser()` retorna `null` cuando no existe OWNER
- ✅ `isOwnerUser(id)` retorna `true` para el OWNER
- ✅ `isOwnerUser(id)` retorna `false` para usuarios no-OWNER
- ✅ `getByIdWithoutOrgFilter(id)` retorna usuario sin filtrar por org

#### OrganizationRepository
- ✅ `hasOwnerUser(org_id)` retorna `true` para org del OWNER
- ✅ `hasOwnerUser(org_id)` retorna `false` para otras organizaciones
- ✅ `getOwnerOrganizationId()` retorna el `organization_id` correcto
- ✅ `getOwnerOrganizationId()` retorna `null` cuando no existe OWNER

#### UserController
- ✅ Crear OWNER cuando no existe → SUCCESS
- ✅ Crear OWNER cuando ya existe → FAIL con `OWNER_ALREADY_EXISTS`
- ✅ Actualizar a OWNER cuando no existe → SUCCESS
- ✅ Actualizar a OWNER cuando ya existe → FAIL con `OWNER_ALREADY_EXISTS`
- ✅ Actualizar el mismo OWNER → SUCCESS
- ✅ Eliminar usuario OWNER → FAIL con `CANNOT_DELETE_OWNER`
- ✅ Eliminar usuario no-OWNER → SUCCESS

#### OrganizationController
- ✅ `getAll()` excluye organización del OWNER
- ✅ `getAll()` retorna todas las orgs cuando OWNER no tiene org
- ✅ `delete(owner_org_id)` → FAIL con `CANNOT_DELETE_OWNER_ORGANIZATION`
- ✅ `delete(other_org_id)` → SUCCESS

### Tests de Integración Requeridos

1. **Flujo completo: Protección de organización OWNER**
   - Crear organización con usuario OWNER
   - Intentar eliminar organización → Debe fallar con 403

2. **Flujo completo: Prevención de OWNER duplicado**
   - Crear segunda organización
   - Intentar crear usuario OWNER → Debe fallar con 400

3. **Flujo completo: Eliminación de organización normal**
   - Crear organización con SUPERADMIN
   - Eliminar organización → Debe tener éxito

4. **Flujo completo: Actualización a OWNER**
   - Intentar cambiar CASHIER a OWNER cuando ya existe OWNER → Debe fallar con 400

5. **Flujo completo: Filtrado de organizaciones**
   - Login como OWNER
   - GET /api/private/organization → No debe incluir org del OWNER

### Tests de Base de Datos

1. **Constraint UNIQUE index**
   ```sql
   -- Debe fallar: INSERT segundo OWNER
   INSERT INTO users (user_type, name, organization_id)
   VALUES ('OWNER', 'Second Owner', '<some-org-id>');
   ```

2. **Stored Procedure validation**
   ```sql
   -- Debe fallar: Eliminar org con OWNER
   SELECT hard_delete_organization('<owner-org-id>');
   ```

---

## Secuencia de Deployment

### Paso 1: Preparación (Pre-deployment)
1. ✅ **Auditoría de datos**: Verificar que solo exista 1 OWNER en producción
   ```sql
   SELECT COUNT(*) FROM users WHERE user_type = 'OWNER' AND deleted_at IS NULL;
   ```
2. ✅ **Backup**: Crear respaldo de base de datos antes de deployment

### Paso 2: Helper Workspace
1. ✅ Deploy cambios en `helper/types/errors.type.ts`
2. ✅ Actualizar `helper/CHANGELOG.md`
3. ✅ Validar que no hay breaking changes

### Paso 3: Database Migration (Staging)
1. ✅ Aplicar migración `add_owner_unique_constraint.sql` en staging
2. ✅ Verificar que la migración se aplica sin errores
3. ✅ Probar que el constraint funciona correctamente

### Paso 4: API Workspace (Staging)
1. ✅ Deploy cambios en repositories (user + organization)
2. ✅ Deploy cambios en controllers (user + organization)
3. ✅ Deploy cambios en routes (user + organization)
4. ✅ Actualizar `api/CHANGELOG.md`

### Paso 5: Testing en Staging
1. ✅ Ejecutar suite de tests unitarios
2. ✅ Ejecutar tests de integración
3. ✅ Pruebas manuales de flujos críticos
4. ✅ Verificar logs de errores

### Paso 6: Production Deployment
1. ✅ Aplicar migración de base de datos
2. ✅ Deploy de código de API
3. ✅ Monitoring activo por 24 horas
4. ✅ Verificar logs para errores relacionados con OWNER

### Paso 7: Post-deployment
1. ✅ Verificar métricas de errores
2. ✅ Confirmar que validaciones están activas
3. ✅ Documentar cualquier issue encontrado

---

## Estrategia de Rollback

### Nivel 1: Rollback de Código (Sin cambios en DB)
1. ✅ Revertir cambios en API a versión anterior
2. ✅ Mantener constraint de base de datos (es no-breaking)
3. ✅ No hay pérdida de datos
4. ✅ Tiempo estimado: 5-10 minutos

### Nivel 2: Rollback de Database Constraint
```sql
-- Eliminar índice UNIQUE
DROP INDEX IF EXISTS idx_users_single_owner;

-- Revertir cambios en stored procedure
-- (restaurar versión anterior del stored procedure)
```

### Nivel 3: Rollback Completo
1. ✅ Rollback de código API
2. ✅ Rollback de database migrations
3. ✅ Verificar integridad de datos
4. ✅ Tiempo estimado: 15-20 minutos

**Nota**: Los tipos de error en `helper/` pueden permanecer sin causar problemas

---

## Beneficios de la Implementación

### Seguridad
- ✅ Previene múltiples OWNERs en el sistema
- ✅ Protege datos críticos de eliminación accidental
- ✅ Múltiples capas de validación (app + DB)

### Integridad de Datos
- ✅ Constraint a nivel de base de datos garantiza consistencia
- ✅ No se puede bypasear desde la aplicación
- ✅ Validaciones robustas en cada capa

### Experiencia de Usuario
- ✅ Mensajes de error claros y descriptivos
- ✅ Previene acciones que fallarían de todas formas
- ✅ Oculta información sensible del OWNER del frontend

### Mantenibilidad
- ✅ Código bien documentado con comentarios
- ✅ CHANGELOGs actualizados
- ✅ Separación clara de responsabilidades (Repository → Controller → Route)

---

## Notas Finales

### Consideraciones Importantes

1. **El índice UNIQUE es crítico**: Sin él, existe una pequeña ventana para race conditions
2. **Limpieza de datos previa**: Verificar que solo existe 1 OWNER antes del deployment
3. **Testing exhaustivo**: Especialmente flujos de creación/actualización/eliminación
4. **Monitoreo post-deploy**: Vigilar logs por intentos de violación de restricciones

### Próximos Pasos Opcionales

1. **Tests automatizados**: Implementar suite completa de tests
2. **Triggers de auditoría**: Log de intentos de crear/eliminar OWNER
3. **Notificaciones**: Alertas cuando se intenta violar restricciones de OWNER
4. **UI/UX**: Deshabilitar botones de eliminar para OWNER en frontend

---

**Fecha de creación**: 2025-12-17
**Autor**: Claude Code
**Versión**: 1.0
