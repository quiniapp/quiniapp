# Pre-Deploy Checklist - QuiniApp Web

**Objetivo:** Detectar bugs de producción ANTES de hacer deploy

---

## 🚨 Por Qué Es Importante

### Diferencias entre Development y Production:

| Aspecto | Development (npm run dev) | Production (npm run build) |
|---------|---------------------------|---------------------------|
| **Módulos** | Servidos directamente sin optimizar | Bundled y minificados |
| **Code Splitting** | No aplicado | Chunks según `manualChunks` |
| **Minificación** | No | Terser (puede causar bugs) |
| **Source Maps** | Completos | No (por performance) |
| **Console.logs** | Visibles | Removidos automáticamente |
| **Dependencias** | Pre-bundled por Vite | Chunks manuales (orden importa) |

**Resultado:** Bugs que NO aparecen en dev PUEDEN aparecer en producción.

---

## ✅ Checklist Pre-Deploy

### 1. Build Local de Producción

```bash
# Paso 1: Build
npm run build

# Verificar que build complete sin errores
# Revisar warnings (chunks > 500KB, etc.)
```

**⚠️ Verificar:**
- ✅ Build completa exitosamente
- ✅ No hay errores de TypeScript
- ✅ No hay warnings críticos
- ✅ Tamaños de chunks son razonables

---

### 2. Preview Local (CRÍTICO)

```bash
# Opción A: Manual
npm run preview

# Opción B: Automático (build + preview)
npm run build:preview
```

**Abre:** `http://localhost:4173`

**⚠️ Testing obligatorio:**

#### A. Console del Browser
1. Abrir DevTools → Console
2. **Verificar NO hay errores** (especialmente de React)
3. Común: `Cannot read properties of undefined (reading 'useLayoutEffect')`

#### B. Login Flow
1. Cargar `/login`
2. Verificar que carga sin errores
3. Login con credenciales válidas
4. Verificar redirect a home

#### C. Navegación
1. Navegar a todas las rutas principales:
   - Home
   - Make Plays
   - Plays & Hits
   - Terminal Ticket
   - Results
   - Settings
2. Verificar que cada ruta carga correctamente
3. Verificar que lazy loading funciona (chunks se descargan bajo demanda)

#### D. Features Críticas
1. Generar ticket/PDF
2. Crear jugada
3. Ver resultados
4. Infinite scroll en tablas
5. Modales y popups

#### E. Network Tab
1. Abrir DevTools → Network
2. Reload la página
3. **Verificar orden de carga de chunks:**
   - `vendor.js` debe cargarse PRIMERO
   - Otros chunks después
4. **Verificar tamaños:**
   - Login inicial: ~300-350 KB gzip
   - Chunks lazy-loaded bajo demanda

---

### 3. Bundle Analysis (Opcional pero Recomendado)

```bash
# Genera y abre stats.html visual
npm run build:analyze
```

**⚠️ Verificar:**
- ✅ React ecosystem en vendor.js
- ✅ PDF vendor separado (lazy)
- ✅ Date vendor separado (lazy)
- ✅ Features separadas en chunks
- ✅ No hay duplicación de dependencias

---

## 🐛 Bugs Comunes que Solo Aparecen en Producción

### 1. React Dependency Order
**Error:** `Cannot read properties of undefined (reading 'useLayoutEffect')`

**Causa:** Chunks que dependen de React se cargan antes que React

**Detección:**
- Preview local → Console error inmediato

**Solución:**
- Consolidar React ecosystem en un solo chunk

---

### 2. Missing Imports en Lazy Loading
**Error:** `Failed to fetch dynamically imported module`

**Causa:** Import paths incorrectos, archivos no generados

**Detección:**
- Preview local → Error al navegar a ruta lazy-loaded

**Solución:**
- Verificar imports en route.tsx
- Verificar que componentes existen

---

### 3. Console.logs Críticos Removidos
**Error:** Debugging imposible, comportamiento inesperado

**Causa:** Terser remueve console.logs en producción

**Detección:**
- Funcionalidad que depende de console.log falla silenciosamente

**Solución:**
- Usar logging library (Winston, Pino)
- O desactivar `drop_console` en vite.config.ts para debug

---

### 4. CSS No Aplicado Correctamente
**Error:** Estilos rotos, layout incorrecto

**Causa:** PurgeCSS/Tailwind removiendo clases "no usadas"

**Detección:**
- Preview local → Estilos visualmente incorrectos

**Solución:**
- Safelist clases dinámicas en tailwind.config.ts

---

### 5. Environment Variables
**Error:** API calls fallan, features no funcionan

**Causa:** ENV vars no configuradas en producción

**Detección:**
- Preview local con production ENV vars

**Solución:**
- Documentar ENV vars requeridas
- Verificar .env.production

---

## 📋 Checklist Resumido (Copy-Paste)

**Antes de cada deploy:**

```
[ ] npm run build - Build completa sin errores
[ ] npm run preview - Preview local funciona
[ ] Console del browser - Sin errores
[ ] Login flow - Funciona correctamente
[ ] Navegación - Todas las rutas cargan
[ ] Features críticas - Funcionan correctamente
[ ] Network tab - Chunks cargan en orden correcto
[ ] Bundle analysis - Estructura correcta (opcional)
[ ] Git commit con mensaje descriptivo
[ ] Push a branch
[ ] Deploy
```

---

## 🔧 Scripts Útiles

```json
{
  "dev": "vite",                    // Development server
  "build": "vite build",             // Build de producción
  "preview": "vite preview",         // Preview del build
  "build:preview": "npm run build && npm run preview",  // Build + Preview automático
  "build:analyze": "npm run build && start dist/stats.html"  // Build + Análisis visual
}
```

---

## 💡 Best Practices

### Pre-Deploy
1. **SIEMPRE** hacer `npm run build:preview` antes de deploy
2. **NUNCA** deployar sin probar el build localmente
3. **Verificar console** en preview (errores de React son críticos)
4. **Testing en mobile** - Preview en localhost:4173 desde móvil

### Durante Deploy
1. **Hacer deploy en staging primero** (si existe)
2. **Monitorear logs** durante deploy
3. **Probar inmediatamente** después de deploy

### Post-Deploy
1. **Verificar producción** en browser limpio (incognito)
2. **Revisar console** - No debe haber errores
3. **Testing smoke** - Login, navegación básica
4. **Rollback plan** - Si algo falla, tener plan B

---

## 🚀 Herramientas Adicionales (Futuro)

### Playwright E2E Tests
```bash
npm run test:e2e:prod  # Tests contra build de producción
```

### Lighthouse CI
```bash
npm run lighthouse    # Performance audit local
```

### Bundle Size Limits
```json
// package.json
"size-limit": [
  {
    "path": "dist/js/vendor-*.js",
    "limit": "300 KB"
  }
]
```

---

## 📚 Recursos

- [Vite Production Build](https://vitejs.dev/guide/build.html)
- [Rollup Manual Chunks](https://rollupjs.org/configuration-options/#output-manualchunks)
- [Bundle Analysis Best Practices](https://web.dev/reduce-javascript-payloads-with-code-splitting/)

---

**Última actualización:** 2025-12-04
**Mantenedor:** Equipo QuiniApp
