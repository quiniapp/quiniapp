# Tests de base de datos (pgTAP)

Prueban las reglas de Polla que viven en SQL: premios, pagos, borrados, cuenta corriente y permisos de los RPC.

## Cómo correrlos

Con el Supabase local levantado (`npx supabase status` desde `api/`):

```bash
cd api
npx supabase db push   # migraciones pendientes
npx supabase test db   # corre tests/database/*.sql
```

Con la CLI v3 los comandos de base apuntan al stack local por defecto: no hace falta `--db-url`. Para una base hosteada hay que pasar `--remote=<url>`, y como cambia una base remota pide confirmación (`--yes`).

`supabase test db` instala pgTAP solo para la corrida (la base no lo conserva) y ejecuta los archivos con `pg_prove`, en orden alfabético.

**Correrlos solo contra el Supabase local.** No usar `--linked` ni `--db-url` contra develop o prod.

## Convenciones

- Un archivo por tema en `database/`, llamado `NNN_<tema>.test.sql` (por ejemplo, `010_polla_prize_rule.test.sql`).
- Cada archivo:
  - empieza con `BEGIN;` y `CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;`;
  - declara `SELECT plan(n);`;
  - termina con `SELECT * FROM finish();` y `ROLLBACK;`.

  Así no queda nada en la base.
- Cada test crea sus propios datos (organización, usuarios, loterías, edición, jugadas) dentro de la transacción. No depende de los datos de prueba que haya en la base local.
- La lógica de TypeScript (helpers, PDFs, permisos del front) se prueba con Vitest en `polla-web` (`npm run test --workspace polla-web`).
