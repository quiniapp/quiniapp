# Scripts de Migración y Mantenimiento

Este directorio contiene scripts para migración del sistema de autenticación y mantenimiento de emergencia.

## 📋 Scripts Disponibles

### 1. `reset-owner-password.ts` - Reset de Contraseña del Owner (EMERGENCIA)

**Propósito**: Resetear la contraseña del usuario OWNER cuando no puedes acceder al sistema.

**Cuándo usar**:
- Después de la migración a custom auth (todos los usuarios necesitan password reset)
- Si olvidaste la contraseña del OWNER
- Si el OWNER está bloqueado
- Para acceso de emergencia al sistema

**Requisitos**:
1. Acceso a la base de datos (para obtener OWNER_ID)
2. Variables de entorno configuradas

---

## 🚀 Uso: Reset de Contraseña del Owner

### Paso 1: Obtener el OWNER_ID

Ejecuta esta query en Supabase SQL Editor o tu cliente PostgreSQL:

```sql
SELECT user_id, username, email, user_type, organization_id
FROM users
WHERE user_type = 'OWNER'
  AND deleted_at IS NULL
  AND disabled = FALSE;
```

**Resultado esperado**:
```
user_id                               | username  | email              | user_type | organization_id
--------------------------------------|-----------|--------------------|-----------|-----------------
a1b2c3d4-e5f6-7890-abcd-ef1234567890 | admin     | admin@example.com  | OWNER     | org-123
```

Copia el `user_id` (será tu `OWNER_ID`).

---

### Paso 2: Elegir una Contraseña

La contraseña puede ser cualquier texto no vacío.

**Ejemplos válidos**:
- `admin`
- `123456`
- `mipassword`
- `Admin2024!`

**Ejemplo inválido**:
- `` (vacío)

---

### Paso 3: Ejecutar el Script

#### Opción A: Con variables de entorno inline (Recomendado)

```bash
cd api
OWNER_ID=a1b2c3d4-e5f6-7890-abcd-ef1234567890 OWNER_PASSWORD=Admin2024! npx tsx scripts/reset-owner-password.ts
```

**Windows CMD**:
```cmd
cd api
set OWNER_ID=a1b2c3d4-e5f6-7890-abcd-ef1234567890
set OWNER_PASSWORD=Admin2024!
npx tsx scripts/reset-owner-password.ts
```

**Windows PowerShell**:
```powershell
cd api
$env:OWNER_ID="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
$env:OWNER_PASSWORD="Admin2024!"
npx tsx scripts/reset-owner-password.ts
```

#### Opción B: Con archivo .env (Menos seguro)

**⚠️ NO RECOMENDADO - Solo para desarrollo local**

1. Agrega temporalmente a tu `.env`:
   ```bash
   OWNER_ID=a1b2c3d4-e5f6-7890-abcd-ef1234567890
   OWNER_PASSWORD=Admin2024!
   ```

2. Ejecuta el script:
   ```bash
   cd api
   npx tsx scripts/reset-owner-password.ts
   ```

3. **IMPORTANTE**: Elimina `OWNER_PASSWORD` del `.env` inmediatamente después:
   ```bash
   # Comentar o eliminar esta línea
   # OWNER_PASSWORD=Admin2024!
   ```

---

### Paso 4: Verificar el Resultado

**Output esperado**:
```
[OWNER RESET] Starting owner password reset...

[OWNER RESET] Fetching user with ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890...
[OWNER RESET] ✅ User found: admin (OWNER)

[OWNER RESET] ✅ User type verified: OWNER

[OWNER RESET] Validating password strength...
[OWNER RESET] ✅ Password strength validated

[OWNER RESET] Hashing password with bcrypt (12 rounds)...
[OWNER RESET] ✅ Password hashed

[OWNER RESET] Updating password in database...
[OWNER RESET] ✅ Password updated successfully

[OWNER RESET] Revoking all existing sessions for security...
[OWNER RESET] ✅ All sessions revoked

[OWNER RESET] Creating audit log entry...
[OWNER RESET] ✅ Audit log entry created

═══════════════════════════════════════════════════════
              OWNER PASSWORD RESET SUCCESS
═══════════════════════════════════════════════════════
✅ User ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
✅ Username: admin
✅ User Type: OWNER
✅ Organization: org-123

IMPORTANT:
1. Password has been reset successfully
2. All existing sessions have been revoked
3. You can now login with the new password
4. You will NOT be required to change password on first login

NEXT STEPS:
1. Login to the application with:
   - Username: admin
   - Password: <the password you provided>
2. Reset passwords for other users via:
   POST /api/private/user/reset-password/:userId
3. Delete this script or keep it for emergency use only

SECURITY NOTES:
- Do not commit OWNER_PASSWORD to version control
- Consider changing the password after initial login
- This script should only be used in emergencies
═══════════════════════════════════════════════════════
```

---

### Paso 5: Login al Sistema

1. Ve a tu aplicación web
2. Limpia las cookies del navegador (F12 → Application → Cookies → Delete all)
3. Haz login con:
   - **Username**: `admin` (o el username del OWNER)
   - **Password**: `Admin2024!` (la contraseña que configuraste)

4. ✅ Deberías poder entrar sin problemas

---

## 🔒 Seguridad

### ✅ Buenas Prácticas

1. **NO commitear passwords**:
   ```bash
   # Asegúrate de que .env está en .gitignore
   echo ".env" >> .gitignore
   ```

2. **Eliminar OWNER_PASSWORD después de usar**:
   ```bash
   # Eliminar de .env
   sed -i '/OWNER_PASSWORD/d' .env
   ```

3. **Cambiar password después del primer login**:
   - Usa el endpoint: `POST /api/private/user/change-password`
   - O usa la UI del frontend si existe

4. **Limitar acceso al script**:
   ```bash
   # Solo el admin del servidor debería poder ejecutarlo
   chmod 700 scripts/reset-owner-password.ts
   ```

### ⚠️ Malas Prácticas

- ❌ NO commitear OWNER_PASSWORD al repositorio
- ❌ NO compartir OWNER_PASSWORD por email/chat sin encriptar
- ❌ NO dejar OWNER_PASSWORD en .env permanentemente
- ❌ NO usar contraseñas débiles como "admin123"
- ❌ NO ejecutar en producción sin verificar OWNER_ID primero

---

## 🐛 Troubleshooting

### Error: "User not found with ID: xxx"

**Causa**: OWNER_ID no existe en la base de datos

**Solución**:
```sql
-- Verifica que el OWNER_ID sea correcto
SELECT user_id, username, user_type
FROM users
WHERE user_type = 'OWNER'
  AND deleted_at IS NULL;
```

---

### Error: "User xxx is not an OWNER"

**Causa**: El user_id proporcionado no es de tipo OWNER

**Solución**: Este script SOLO funciona con usuarios OWNER por seguridad. Verifica que el user_id sea correcto.

---

### Error: "Password does not meet strength requirements"

**Causa**: La contraseña está vacía

**Solución**: Proporciona cualquier contraseña no vacía (puede ser cualquier texto como "admin", "123456", etc.)

---

### Error: "OWNER_ID environment variable is required"

**Causa**: No se pasó la variable de entorno OWNER_ID

**Solución**:
```bash
# Linux/Mac
OWNER_ID=xxx OWNER_PASSWORD=yyy npx tsx scripts/reset-owner-password.ts

# Windows CMD
set OWNER_ID=xxx
set OWNER_PASSWORD=yyy
npx tsx scripts/reset-owner-password.ts

# Windows PowerShell
$env:OWNER_ID="xxx"
$env:OWNER_PASSWORD="yyy"
npx tsx scripts/reset-owner-password.ts
```

---

## 📚 Otros Scripts

### `migrate-users-to-custom-auth.ts`

Marca todos los usuarios como `password_reset_required=true` después de la migración.

**Uso**:
```bash
cd api
npx tsx scripts/migrate-users-to-custom-auth.ts
```

**Cuándo ejecutar**: Una sola vez después de aplicar las migraciones de base de datos.

---

## 🔍 Verificación Post-Reset

Después de resetear la contraseña del OWNER, verifica:

### 1. Password actualizado en DB
```sql
SELECT user_id, username, password_hash, password_changed_at, password_reset_required
FROM users
WHERE user_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
```

**Resultado esperado**:
- `password_hash`: Debería tener un valor bcrypt (empieza con `$2b$12$`)
- `password_changed_at`: Timestamp reciente
- `password_reset_required`: `false`

### 2. Sesiones revocadas
```sql
SELECT session_id, is_active, revoked_at, revoked_reason
FROM sessions
WHERE user_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
ORDER BY created_at DESC
LIMIT 5;
```

**Resultado esperado**:
- Todas las sesiones antiguas deben tener `is_active = false`
- `revoked_reason`: `'owner_password_reset_script'`

### 3. Audit log creado
```sql
SELECT event_type, success, username, metadata, created_at
FROM auth_audit_log
WHERE user_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
ORDER BY created_at DESC
LIMIT 5;
```

**Resultado esperado**:
- Entry con `event_type = 'owner_password_reset_script'`
- `success = true`

---

## 📞 Soporte

Si tienes problemas con el script:

1. Verifica que las variables de entorno estén correctas
2. Verifica que el OWNER_ID exista en la base de datos
3. Verifica que la contraseña no esté vacía
4. Revisa los logs del script para más detalles
5. Consulta la sección de Troubleshooting arriba

---

## 🔐 Notas de Seguridad Final

Este script tiene permisos especiales y puede:
- ✅ Actualizar cualquier contraseña de OWNER
- ✅ Revocar todas las sesiones de un usuario
- ✅ Saltarse la validación de password actual

Por lo tanto:
- Solo debe ser ejecutado por administradores del sistema
- Solo debe ser usado en emergencias
- No debe ser expuesto en endpoints HTTP
- Las credenciales no deben ser commitadas
