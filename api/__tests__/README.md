# QuiniApp E2E Test Suite

Suite completa de tests end-to-end para validar el flujo crítico de apuestas, premios y cuentas corrientes.

## Configuración Inicial

### 1. Instalar Dependencias

```bash
cd api
npm install
```

### 2. Configurar Variables de Entorno

Los tests usan las mismas variables de entorno que el servidor. Asegúrate de tener un archivo `.env` configurado correctamente en el directorio `api/`.

**Importante:** Los tests se conectarán a la base de datos configurada en `.env`. Se recomienda usar una base de datos de desarrollo o test, **NO la de producción**.

Variables críticas:
- `NODE_ENV`: Configurar como `test` o `development`
- `SUPABASE_URL_LOCAL` / `SUPABASE_URL`: URL de Supabase
- `SUPABASE_SERVICE_ROLE_KEY_LOCAL` / `SUPABASE_SERVICE_ROLE_KEY`: Service role key
- `JWT_SECRET_SUPABASE_LOCAL` / `JWT_SECRET_SUPABASE`: JWT secret de Supabase
- `JWT_SECRET_ACCESS`: Secret para access tokens
- `JWT_SECRET_REFRESH`: Secret para refresh tokens

### 3. Base de Datos de Test

**⚠️ ADVERTENCIA:** Los tests limpian TODAS las tablas al inicio:
- `organizations`
- `users`
- `schedules`
- `lotteries`
- `schedule_lotteries`
- `tickets`
- `bets`
- `results`
- `current_accounts`
- `ticket_prices_by_turn`

**Usa una base de datos separada para tests o corre los tests en un ambiente aislado.**

## Ejecutar Tests

### Todos los tests
```bash
npm test
```

### Modo watch (desarrollo)
```bash
npm run test:watch
```

### Con cobertura
```bash
npm run test:coverage
```

## Arquitectura de Testing

```
┌─────────────────────────────────────────────────────────────┐
│                    8 CASHIERS                                │
├──────────────────────────┬──────────────────────────────────┤
│  4 con fee_plus=10       │  4 con fee_plus=0                │
│  (A, B, C, D)            │  (E, F, G, H)                    │
└──────────────────────────┴──────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              5 SCHEDULES × 5 LOTTERIES                       │
│                 = 25 COMBINATIONS                            │
├─────────────────────────────────────────────────────────────┤
│  Each combination generates specific hit count (0-20)        │
│  Schedule 0: All 0 hits                                      │
│  Schedule 1: 1-5 hits (distributed across lotteries)        │
│  Schedule 2: 6-10 hits                                       │
│  Schedule 3: 11-15 hits                                      │
│  Schedule 4: 16-20 hits                                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  RESULTS (numbers)                           │
├─────────────────────────────────────────────────────────────┤
│  [1111, 1111, ...(N times), 9999, 9999, ...(20-N times)]   │
│                                                              │
│  N = number of hits for that schedule-lottery combination   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    BETS (per cashier)                        │
├─────────────────────────────────────────────────────────────┤
│  HITS_0:      bet with 8888 (never matches)                 │
│  HITS_1_TO_5: bet with 1111 using FIVE places               │
│  HITS_6_TO_10: bet with 1111 using TEN places               │
│  HITS_11_TO_20: bet with 1111 using TWENTY places           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│         GENERATE WINNERS & CALCULATE ACCOUNTS                │
│              (RPC function execution)                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     VALIDATIONS                              │
├─────────────────────────────────────────────────────────────┤
│  ✓ Correct hits count per bet                               │
│  ✓ Prize calculation with correct multipliers              │
│  ✓ Current account: pass, successes, revenue, commission   │
│  ✓ Drag accumulation (fee_plus > 0)                        │
│  ✓ Leave calculation (when executed)                       │
└─────────────────────────────────────────────────────────────┘
```

## Estructura de los Tests

### Fixtures (Datos de Prueba)

- **`fixtures/users.fixture.ts`**: 1 owner + 6 cashiers con 3 escenarios diferentes
- **`fixtures/schedules.fixture.ts`**: 5 schedules × 5 lotteries × 6 días (Lunes a Sábado)
- **`fixtures/results/`**: Results diseñados para producir escenarios específicos:
  - `no-winners.fixture.ts`: Todas las jugadas pierden (0 hits)
  - `one-hit.fixture.ts`: Exactamente 1 hit por tipo de jugada
  - `max-hits.fixture.ts`: Máximo número de hits por tipo de jugada
- **`fixtures/bets/`**: Generador de jugadas para cada escenario

### Helpers

- **`helpers/test-database.helper.ts`**: Setup y cleanup de base de datos
- **`helpers/test-auth.helper.ts`**: Generación de tokens JWT para autenticación
- **`helpers/calculate-expected.helper.ts`**: Cálculo de valores esperados (premios, revenue, drag, leave)
- **`helpers/assertions.helper.ts`**: Assertions personalizadas para validaciones

### Tests de Integración

- **`integration/winners-results-account.test.ts`**: Test principal E2E

## Escenarios de Test

### Cashiers y Escenarios

Los tests usan **8 cashiers** divididos en **4 escenarios** (2 cashiers por escenario):

1. **HITS_0** (Cashiers A y E):
   - Todas las jugadas pierden (0 hits)
   - Usa número 8888 que nunca coincide con results
   - Valida: `revenue = pass - commission`, `successes = 0`, `hits = 0`

2. **HITS_1_TO_5** (Cashiers B y F):
   - Jugadas con 1-5 hits (distribuido entre schedules/lotteries)
   - Usa DOUBLE FIVE, TERN FIVE, QUATERN FIVE con número 1111
   - Valida: Premios correctos para hits bajos

3. **HITS_6_TO_10** (Cashiers C y G):
   - Jugadas con 6-10 hits
   - Usa DOUBLE TEN, TERN TEN, QUATERN TEN con número 1111
   - Valida: Premios para rango medio de hits

4. **HITS_11_TO_20** (Cashiers D y H):
   - Jugadas con 11-20 hits
   - Usa DOUBLE TWENTY, TERN TWENTY, QUATERN TWENTY con número 1111
   - Valida: Máximo hits posible y premios altos

### Distribución de Hits por Schedule-Lottery

Los results están mapeados para generar diferentes cantidades de hits según la combinación:

| Schedule | Lottery 0 | Lottery 1 | Lottery 2 | Lottery 3 | Lottery 4 |
|----------|-----------|-----------|-----------|-----------|-----------|
| **0 (Matutina)** | 0 hits | 0 hits | 0 hits | 0 hits | 0 hits |
| **1 (Mediodía)** | 1 hit | 2 hits | 3 hits | 4 hits | 5 hits |
| **2 (Vespertina)** | 6 hits | 7 hits | 8 hits | 9 hits | 10 hits |
| **3 (Nocturna)** | 11 hits | 12 hits | 13 hits | 14 hits | 15 hits |
| **4 (Especial)** | 16 hits | 17 hits | 18 hits | 19 hits | 20 hits |

**Total:** 25 combinaciones únicas (5 schedules × 5 lotteries) cubriendo de 0 a 20 hits.

### Estrategia de Numbers

Los results usan números repetidos simples para facilitar testing:

- **Results con N hits:** `[1111, 1111, ...(N veces)..., 9999, 9999, ...(20-N veces)...]`
- **Jugadas que ganan:** Número `1111` (coincide con las primeras N posiciones)
- **Jugadas que pierden:** Número `8888` (nunca coincide)

### Fee Configuration

- **fee**: 20% (comisión sobre apostado) - todos los cashiers
- **fee_plus**:
  - Cashiers A, B, C: 10% (comisión sobre drag)
  - Cashiers D, E, F: 0% (sin comisión sobre drag)

### Tipos de Jugadas Testeados

Todos los tipos de jugadas con todas sus variantes:

- **ONE**: HEAD
- **DOUBLE**: HEAD, FIVE, TEN, TWENTY
- **TERN**: HEAD, FIVE, TEN, TWENTY
- **QUATERN**: HEAD, FIVE, TEN, TWENTY
- **BORRATINA**: HEAD, FIVE, TEN, TWENTY
- **REDOUBLE**: 9 combinaciones (HEAD×FIVE, HEAD×TEN, HEAD×TWENTY, FIVE×FIVE, FIVE×TEN, FIVE×TWENTY, TEN×TEN, TEN×TWENTY, TWENTY×TWENTY)

**Total:** 26 jugadas por cashier × schedule × lottery

## Validaciones

### Winners y Premios
- ✅ Hits correctos según result y tipo de jugada
- ✅ Prize calculado con multiplicador correcto
- ✅ Winner flag correcto (true/false)

### Current Account
- ✅ Pass (total apostado)
- ✅ Successes (total de premios)
- ✅ Revenue (pass - commission - successes)
- ✅ Cashier commission (fee × pass)
- ✅ Drag (acumulación de revenue para fee_plus > 0)
- ✅ Leave (fee_plus × drag cuando se liquida)
- ✅ Total (balance acumulado)

### Lógica de Negocio
- ✅ Drag se acumula solo si fee_plus > 0
- ✅ Leave se calcula solo si drag > 0 y se ejecuta liquidación
- ✅ Drag se resetea el día después de calcular leave

## Calendario de Pruebas (Plan Completo)

El plan completo contempla 26 días:

```
Ciclo 1: Días 1-6   (Lun-Sáb) → Leave después del día 6
Descanso: Día 7     (Domingo)
Ciclo 2: Días 8-13  (Lun-Sáb) → Leave después del día 13
Pausa 1: Días 14-16 (3 días sin jugadas)
Pausa 2: Días 17-20 (4 días sin jugadas)
Ciclo 3: Días 21-26 (Lun-Sáb) → Leave después del día 26
```

**Estado actual:** Test implementado para Día 1 solamente.

## Próximos Pasos

Para completar la suite E2E:

1. Expandir el test del Día 1 a todos los días del Ciclo 1 (días 2-6)
2. Agregar test de leave al final del Ciclo 1 (día 6)
3. Implementar Ciclo 2 (días 8-13) validando que drag inicia en 0
4. Implementar pausas sin jugadas (días 7, 14-20)
5. Implementar Ciclo 3 (días 21-26) con validación final

## Troubleshooting

### Error: Cannot find module '@database/supabase'
Verifica que el path alias esté configurado en `jest.config.js`:
```javascript
moduleNameMapper: {
  '^@database/(.*)$': '<rootDir>/database/$1',
}
```

### Error: Timeout
El timeout por defecto es 60 segundos. Si el test es muy lento, incrementa el timeout:
```javascript
test('...', async () => {
  // test code
}, 120000); // 2 minutos
```

### Error: Cannot connect to Supabase
Verifica que:
1. Las credenciales en `.env` sean correctas
2. Supabase esté corriendo (si usas Supabase local)
3. La red permita la conexión

## Notas de Desarrollo

- Los tests usan `runInBand` para evitar conflictos de base de datos
- Se usa `detectOpenHandles` para detectar conexiones abiertas
- Jest está configurado con ESM support via `ts-jest`
- Todos los imports usan extensión `.js` para compatibilidad con ESM
