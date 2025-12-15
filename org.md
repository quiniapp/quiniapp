# Plan de Implementación: Sistema de Organizaciones (Multi-Tenancy)

## Objetivo
Implementar un sistema multi-tenant donde cada organización opera de forma independiente con sus propios usuarios, loterías, horarios, tickets, apuestas y cuentas corrientes.

---

## Modelo de Datos

### Nueva tabla: `organizations`
```sql
CREATE TABLE organizations (
  organization_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);
```

### Tablas que requieren `organization_id`
| Tabla | Propósito |
|-------|-----------|
| `users` | Cada usuario pertenece a una organización |
| `lotteries` | Cada org tiene sus propias loterías |
| `schedules` | Cada org tiene sus propios horarios |
| `schedule_lotteries` | Relación lotería-horario por org |
| `results` | Resultados por org |
| `tickets` | Tickets por org |
| `bets` | Apuestas por org |
| `current_accounts` | Cuentas corrientes por org |
| `ticket_prizes_by_turn` | Premios por turno por org |

---

## Estructura de Roles por Organización

```
OWNER (global)
  └── Puede crear organizaciones
  └── Ve todas las organizaciones

SUPERADMIN (por organización)
  └── 1 por organización
  └── Administra su organización completa
  └── Crea/gestiona ADMINs y CASHIERs

ADMIN (por organización)
  └── N por organización
  └── Gestiona CASHIERs y operaciones

CASHIER (por organización)
  └── N por organización
  └── Opera tickets/apuestas
```

---

## Migraciones de Base de Datos

### Orden de ejecución:

1. **Crear tabla organizations**
```sql
-- 001_create_organizations_table.sql
CREATE TABLE organizations (
  organization_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);
CREATE INDEX idx_organizations_active ON organizations(deleted_at) WHERE deleted_at IS NULL;
```

2. **Agregar organization_id a users**
```sql
-- 002_add_org_id_to_users.sql
ALTER TABLE users ADD COLUMN organization_id UUID;
ALTER TABLE users ADD CONSTRAINT fk_users_org
  FOREIGN KEY (organization_id) REFERENCES organizations(organization_id);
CREATE INDEX idx_users_org_id ON users(organization_id);
```

3. **Agregar organization_id a lotteries**
```sql
-- 003_add_org_id_to_lotteries.sql
ALTER TABLE lotteries ADD COLUMN organization_id UUID;
ALTER TABLE lotteries ADD CONSTRAINT fk_lotteries_org
  FOREIGN KEY (organization_id) REFERENCES organizations(organization_id);
CREATE INDEX idx_lotteries_org_id ON lotteries(organization_id);
```

4. **Agregar organization_id a schedules**
```sql
-- 004_add_org_id_to_schedules.sql
ALTER TABLE schedules ADD COLUMN organization_id UUID;
ALTER TABLE schedules ADD CONSTRAINT fk_schedules_org
  FOREIGN KEY (organization_id) REFERENCES organizations(organization_id);
CREATE INDEX idx_schedules_org_id ON schedules(organization_id);
```

5. **Agregar organization_id a schedule_lotteries**
```sql
-- 005_add_org_id_to_schedule_lotteries.sql
ALTER TABLE schedule_lotteries ADD COLUMN organization_id UUID;
ALTER TABLE schedule_lotteries ADD CONSTRAINT fk_schedule_lotteries_org
  FOREIGN KEY (organization_id) REFERENCES organizations(organization_id);
CREATE INDEX idx_schedule_lotteries_org_id ON schedule_lotteries(organization_id);
```

6. **Agregar organization_id a results**
```sql
-- 006_add_org_id_to_results.sql
ALTER TABLE results ADD COLUMN organization_id UUID;
ALTER TABLE results ADD CONSTRAINT fk_results_org
  FOREIGN KEY (organization_id) REFERENCES organizations(organization_id);
CREATE INDEX idx_results_org_id ON results(organization_id);
```

7. **Agregar organization_id a tickets**
```sql
-- 007_add_org_id_to_tickets.sql
ALTER TABLE tickets ADD COLUMN organization_id UUID;
ALTER TABLE tickets ADD CONSTRAINT fk_tickets_org
  FOREIGN KEY (organization_id) REFERENCES organizations(organization_id);
CREATE INDEX idx_tickets_org_id ON tickets(organization_id);
```

8. **Agregar organization_id a bets**
```sql
-- 008_add_org_id_to_bets.sql
ALTER TABLE bets ADD COLUMN organization_id UUID;
ALTER TABLE bets ADD CONSTRAINT fk_bets_org
  FOREIGN KEY (organization_id) REFERENCES organizations(organization_id);
CREATE INDEX idx_bets_org_id ON bets(organization_id);
```

9. **Agregar organization_id a current_accounts**
```sql
-- 009_add_org_id_to_current_accounts.sql
ALTER TABLE current_accounts ADD COLUMN organization_id UUID;
ALTER TABLE current_accounts ADD CONSTRAINT fk_current_accounts_org
  FOREIGN KEY (organization_id) REFERENCES organizations(organization_id);
CREATE INDEX idx_current_accounts_org_id ON current_accounts(organization_id);
```

10. **Agregar organization_id a ticket_prizes_by_turn**
```sql
-- 010_add_org_id_to_ticket_prizes_by_turn.sql
ALTER TABLE ticket_prizes_by_turn ADD COLUMN organization_id UUID;
ALTER TABLE ticket_prizes_by_turn ADD CONSTRAINT fk_ticket_prizes_by_turn_org
  FOREIGN KEY (organization_id) REFERENCES organizations(organization_id);
CREATE INDEX idx_ticket_prizes_by_turn_org_id ON ticket_prizes_by_turn(organization_id);
```

11. **Migrar datos existentes**
```sql
-- 011_migrate_to_default_org.sql
DO $$
DECLARE v_org_id UUID;
BEGIN
  INSERT INTO organizations (name) VALUES ('Default Organization')
  RETURNING organization_id INTO v_org_id;

  UPDATE users SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE lotteries SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE schedules SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE schedule_lotteries SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE results SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE tickets SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE bets SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE current_accounts SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE ticket_prizes_by_turn SET organization_id = v_org_id WHERE organization_id IS NULL;
END $$;
```

12. **Hacer organization_id NOT NULL**
```sql
-- 012_make_org_id_not_null.sql
ALTER TABLE users ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE lotteries ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE schedules ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE schedule_lotteries ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE results ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE tickets ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE bets ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE current_accounts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE ticket_prizes_by_turn ALTER COLUMN organization_id SET NOT NULL;
```

---

## Tipos TypeScript

### Nuevo tipo: Organization
```typescript
// helper/types/organization.type.ts
export interface IOrganizationEntityBack {
  organization_id: string;
  name: string;
  created_at: string | Date;
  edited_at: string | Date;
  deleted_at: string | null | Date;
}

export type IOrganizationEntityFront = Omit<
  IOrganizationEntityBack,
  'created_at' | 'deleted_at' | 'edited_at'
>;
```

### Actualizar tipo User
```typescript
// helper/types/user.type.ts
interface BaseUserEntityBack {
  // ... campos existentes ...
  organization_id: string;  // NUEVO
}
```

---

## Backend: Archivos a Modificar

### Nuevos archivos (módulo organization):
- `api/src/organization/repository/organization.repository.ts`
- `api/src/organization/controller/organization.controller.ts`
- `api/src/organization/route/organization.route.ts`
- `api/src/organization/helper/organization.parse.ts`

### Middleware:
- `api/middlewares/auth.middleware.ts` - Agregar `organization_id` al request

### Repositories a modificar:
- `api/src/user/repository/user.repository.ts`
- `api/src/lottery/repository/lottery.repository.ts`
- `api/src/shcedule/repository/schedule.repository.ts`
- `api/src/schedule-lottery/repository/schedule-lottery.repositroy.ts`
- `api/src/results/repository/results.repository.ts`
- `api/src/ticket/repository/ticket.repository.ts`
- `api/src/bet/repository/bet.repository.ts`
- `api/src/current-account/repository/current-account.repository.ts`
- `api/src/winners/repository/winners.repository.ts`

### Stored Procedures a actualizar:
- `create_ticket_with_bets`
- `edit_ticket_replace_bets`
- `ticket_full_json_plpgsql`
- `generate_winners`
- `generate_winners_and_calculate_accounts`
- `calculate_current_account`
- `update_current_account_recompute`
- `pay_ticket`
- `get_grouped_bets_for_parse`
- `bets_total_amount`
- `bets_total_prize`

---

## Frontend: Cambios Mínimos

El `organization_id` viene incluido en el usuario desde el backend, por lo que:
- Los hooks de datos no necesitan cambios (filtrado en backend)
- El AuthProvider expone `organization_id` automáticamente

### Futuro (no en esta fase):
- UI de gestión de organizaciones (solo OWNER)
- Selector de organización

---

## Secuencia de Implementación

```
1. [ ] Migraciones de base de datos (12 archivos)
2. [ ] Tipos TypeScript (organization.type.ts + updates)
3. [ ] Auth middleware (agregar org_id a request)
4. [ ] Módulo organization (CRUD completo)
5. [ ] Repositories (agregar filtros org_id)
6. [ ] Controllers (pasar org_id)
7. [ ] Routes (pasar req.organization_id)
8. [ ] Stored procedures (actualizar todos)
9. [ ] Frontend (minimal - solo exponer org_id)
10. [ ] Testing y verificación
```

---

## Notas Importantes

- **Backup**: Hacer backup de DB antes de ejecutar migraciones
- **Re-login**: Los usuarios deberán re-loguearse después del deploy
- **Ventana**: Implementar cuando no haya usuarios activos
- **Grupos**: Se implementarán DESPUÉS (ver group.md)
