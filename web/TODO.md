# TODO - Frontend QuiniApp

**Fecha de creación:** 2025-11-20
**Estado:** Pendiente de implementación

---

## 📋 Índice

1. [Arquitectura y Diseño](#1-arquitectura-y-diseño)
2. [Componentización y Reutilización](#2-componentización-y-reutilización)
3. [Optimización de Modales](#3-optimización-de-modales)
4. [Uniformización de UI](#4-uniformización-de-ui)
5. [Features Nuevas](#5-features-nuevas)
6. [Optimizaciones de Performance](#6-optimizaciones-de-performance)

---

## 1. Arquitectura y Diseño

### 1.1 Migración a Atomic Design Pattern 🎨

**Objetivo:** Reorganizar componentes siguiendo metodología Atomic Design para mejor mantenibilidad y escalabilidad.

#### Contexto
Actualmente la estructura de componentes es funcional pero no sigue un patrón consistente. Atomic Design nos permitirá:
- Mejor reutilización de componentes
- Estructura clara y predecible
- Facilitar onboarding de nuevos desarrolladores
- Reducir duplicación de código

#### Estructura Propuesta
```
src/
├── components/
│   ├── atoms/           # Componentes más básicos
│   │   ├── Button/
│   │   ├── Input/
│   │   ├── Label/
│   │   ├── Icon/
│   │   ├── Badge/
│   │   └── Spinner/
│   │
│   ├── molecules/       # Combinación de atoms
│   │   ├── FormField/   # Input + Label + Error
│   │   ├── SearchBar/   # Input + Icon + Button
│   │   ├── Card/        # Container + Title + Content
│   │   ├── IconButton/  # Icon + Button (ya existe)
│   │   └── CheckboxWithLabel/ (ya existe)
│   │
│   ├── organisms/       # Secciones complejas
│   │   ├── Header/
│   │   ├── Sidebar/
│   │   ├── DataTable/
│   │   ├── Modal/
│   │   └── Form/
│   │
│   ├── templates/       # Layouts de páginas
│   │   ├── MainLayout/
│   │   ├── AuthLayout/
│   │   └── DashboardLayout/
│   │
│   └── ui/             # Shadcn/ui components (mantener como están)
│
└── pages/              # Páginas completas (ya existe)
```

#### Tareas

##### Fase 1: Auditoría y Planning (1 día)
- [ ] Inventariar todos los componentes existentes
- [ ] Clasificar componentes por categoría (atoms, molecules, organisms)
- [ ] Identificar componentes duplicados o similares
- [ ] Crear mapa de dependencias entre componentes
- [ ] Documentar componentes que necesitan refactoring

##### Fase 2: Atoms (2-3 días)
- [ ] **Button**: Consolidar variantes existentes
  - Revisar `components/ui/button.tsx`
  - Revisar `components/button/IconButton.tsx`
  - Crear `atoms/Button/` con todas las variantes
  - Migrar usos existentes gradualmente

- [ ] **Input**: Unificar inputs
  - Consolidar inputs de formularios
  - Crear variantes: text, number, password, date
  - Integrar con react-hook-form

- [ ] **Label**: Estandarizar labels
  - Crear componente base reutilizable
  - Variantes: default, required, optional

- [ ] **Icon**: Wrapper para lucide-react
  - Crear componente Icon con tamaños predefinidos
  - Props: name, size, color, className

- [ ] **Badge**: Para estados y etiquetas
  - Variantes: success, error, warning, info
  - Tamaños: sm, md, lg

##### Fase 3: Molecules (3-4 días)
- [ ] **FormField**: Combo de Input + Label + Error
  - Integración con react-hook-form
  - Validación automática de errores
  - Soporte para diferentes tipos de input

- [ ] **SearchBar**: Barra de búsqueda reutilizable
  - Input + Icon de búsqueda + Clear button
  - Debouncing integrado
  - Usado en terminal-ticket y otras tablas

- [ ] **Card**: Contenedor estándar
  - Variantes: default, outlined, elevated
  - Slots: header, content, footer

- [ ] **DataTableRow**: Fila de tabla reutilizable
  - Ya tenemos `TicketTableRow` como base
  - Generalizar para cualquier tipo de data

- [ ] **FilterGroup**: Grupo de filtros
  - Usado en make-plays y otras secciones
  - Combinación de inputs y selects

##### Fase 4: Organisms (4-5 días)
- [ ] **DataTable**: Tabla genérica reutilizable
  - Base: tabla de terminal-ticket
  - Props: columns, data, onRowClick, loading, pagination
  - Soporte para sorting, filtering
  - Infinite scroll integrado

- [ ] **Modal**: Sistema de modales unificado
  - Ver sección [3. Optimización de Modales](#3-optimización-de-modales)

- [ ] **Header**: Header consistente
  - Logo + Navigation + User menu
  - Responsive (hamburger en mobile)

- [ ] **Sidebar**: Sidebar de navegación
  - Colapsable en mobile
  - Active state en rutas actuales

- [ ] **Form**: Formularios complejos
  - Base para create-bet, login, etc.
  - Validación integrada
  - Submit handling

##### Fase 5: Templates (2-3 días)
- [ ] **MainLayout**: Layout principal
  - Header + Sidebar + Content + Footer
  - Responsive breakpoints

- [ ] **AuthLayout**: Para login/register
  - Centrado, sin sidebar
  - Logo y branding

- [ ] **DashboardLayout**: Para admin/reports
  - Layout específico para dashboards
  - Grid responsivo

##### Fase 6: Migración Gradual (2-3 semanas)
- [ ] Crear guía de migración para el equipo
- [ ] Migrar páginas por orden de prioridad:
  1. `make-plays` (más compleja, más impacto)
  2. `terminal-ticket` (ya tiene tabla modular)
  3. `current-account`
  4. Otras páginas
- [ ] Actualizar imports en toda la app
- [ ] Eliminar componentes antiguos duplicados
- [ ] Testing exhaustivo en cada migración

##### Fase 7: Documentación (2 días)
- [ ] Documentar cada categoría de componentes
- [ ] Crear Storybook (opcional pero recomendado)
- [ ] Guía de cuándo usar cada componente
- [ ] Ejemplos de uso para cada componente

#### Consideraciones
- **No hacer Big Bang refactor**: Migrar gradualmente
- **Mantener compatibilidad**: Usar ambos sistemas en paralelo durante migración
- **Testing**: Validar que funcionalidad no se rompe
- **Performance**: No degradar performance con capas extra

#### Estado Actual
- **Prioridad:** Alta (mejora mantenibilidad a largo plazo)
- **Estimación:** 4-6 semanas de migración completa
- **Bloqueantes:** Ninguno, puede empezar inmediatamente

---

## 2. Componentización y Reutilización

### 2.1 Reutilizar Tabla de Terminal Tickets en Current Account 🔄

**Objetivo:** Eliminar duplicación de código usando la tabla modular ya creada.

#### Contexto
La tabla de terminal-ticket fue recientemente modularizada con:
- `TicketTableHeader`: Header reutilizable
- `TicketTableRow`: Fila de ticket reutilizable

Current Account necesita una tabla similar para mostrar movimientos de cuenta.

#### Tareas

##### Análisis (0.5 día)
- [ ] Revisar `current-account` page actual
- [ ] Identificar similitudes con `terminal-ticket` table
- [ ] Determinar qué necesita adaptar (columnas, filtros, etc.)
- [ ] Decidir approach: reutilizar o crear componente genérico

##### Opción A: Adaptar TicketTable para Current Account (1 día)
- [ ] Hacer `TicketTable` más genérica
- [ ] Props configurables para columnas
- [ ] Permitir customización de row rendering
- [ ] Usar en current-account con config específica

**Ejemplo:**
```typescript
<TicketTable
  columns={['fecha', 'descripcion', 'debe', 'haber', 'saldo']}
  data={accountMovements}
  renderRow={(item) => <AccountMovementRow movement={item} />}
/>
```

##### Opción B: Crear DataTable Genérica (2-3 días)
- [ ] Crear componente `DataTable` genérico (parte de Atomic Design)
- [ ] Usar para terminal-ticket Y current-account
- [ ] Configuración de columnas tipo-safe con TypeScript

**Ejemplo:**
```typescript
interface Column<T> {
  key: keyof T;
  header: string;
  render?: (value: T[keyof T], item: T) => ReactNode;
  width?: string;
}

<DataTable
  columns={columns}
  data={data}
  onRowClick={handleRowClick}
  loading={isLoading}
/>
```

##### Implementación Recomendada: Opción B
- [ ] Crear `organisms/DataTable/DataTable.tsx`
- [ ] Migrar terminal-ticket a usar DataTable
- [ ] Implementar current-account con DataTable
- [ ] Props de DataTable:
  - `columns`: Configuración de columnas
  - `data`: Array de datos
  - `keyExtractor`: Función para key única
  - `onRowClick`: Handler de click
  - `loading`: Estado de carga
  - `emptyMessage`: Mensaje cuando no hay datos
  - `infiniteScroll`: Soporte para infinite scroll

##### Testing (0.5 día)
- [ ] Validar que terminal-ticket sigue funcionando
- [ ] Validar que current-account funciona correctamente
- [ ] Testing responsive en mobile
- [ ] Testing de performance con datos reales

#### Beneficios
- ✅ Elimina duplicación de código
- ✅ Mantenimiento más fácil (cambios en un lugar)
- ✅ Consistencia visual entre tablas
- ✅ Base sólida para futuras tablas

#### Estado Actual
- **Prioridad:** Media-Alta
- **Estimación:** 2-3 días
- **Dependencias:** Ninguna (puede hacerse independiente de Atomic Design)
- **Bloqueantes:** Ninguno

---

## 3. Optimización de Modales

### 3.1 Sistema Unificado de Modales 🪟

**Objetivo:** Consolidar todos los modales en un sistema consistente y optimizado.

#### Problema Actual
- Múltiples implementaciones de modales
- Inconsistencias en animaciones y estilos
- No hay gestión centralizada de modales
- Duplicación de lógica (open/close, backdrop, etc.)

#### Modales Existentes a Consolidar
```
src/components/modals/
├── DeleteResultsModal.tsx
├── DeleteTicketModal.tsx
├── EditBetModal.tsx (si existe)
└── ... otros modales
```

#### Tareas

##### Fase 1: Auditoría (0.5 día)
- [ ] Listar todos los modales existentes
- [ ] Identificar patterns comunes
- [ ] Identificar inconsistencias
- [ ] Documentar props de cada modal

##### Fase 2: Base Modal Component (1 día)
- [ ] Crear `organisms/Modal/Modal.tsx` base
- [ ] Props estándar:
  - `isOpen`: Estado de visibilidad
  - `onClose`: Handler para cerrar
  - `title`: Título del modal
  - `size`: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  - `closeOnBackdrop`: Cerrar al click fuera (default: true)
  - `closeOnEsc`: Cerrar con ESC (default: true)
  - `showCloseButton`: Mostrar X de cerrar (default: true)
  - `footer`: Slot para botones de acción

**Estructura:**
```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  showCloseButton?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}
```

##### Fase 3: Modal Manager (1 día)
- [ ] Crear Context para gestionar modales globalmente
- [ ] Hook `useModal()` para abrir/cerrar modales
- [ ] Sistema de stacking (múltiples modales)
- [ ] Gestión de focus trap

**Ejemplo de uso:**
```typescript
// En cualquier componente
const { openModal, closeModal } = useModal();

const handleDelete = () => {
  openModal({
    type: 'confirm',
    title: '¿Eliminar ticket?',
    message: 'Esta acción no se puede deshacer',
    onConfirm: () => deleteTicket(id),
  });
};
```

##### Fase 4: Modal Presets (1-2 días)
Crear modales pre-configurados para casos comunes:

- [ ] **ConfirmModal**: Confirmación con botones Sí/No
  ```typescript
  <ConfirmModal
    isOpen={isOpen}
    onClose={onClose}
    title="¿Confirmar acción?"
    message="Esta acción no se puede deshacer"
    onConfirm={handleConfirm}
    confirmText="Confirmar"
    cancelText="Cancelar"
    variant="danger" // danger, warning, info
  />
  ```

- [ ] **FormModal**: Modal con formulario
  ```typescript
  <FormModal
    isOpen={isOpen}
    onClose={onClose}
    title="Editar apuesta"
    onSubmit={handleSubmit}
  >
    <FormContent />
  </FormModal>
  ```

- [ ] **AlertModal**: Solo para mostrar información
  ```typescript
  <AlertModal
    isOpen={isOpen}
    onClose={onClose}
    title="Éxito"
    message="Operación completada correctamente"
    variant="success"
  />
  ```

##### Fase 5: Migrar Modales Existentes (2-3 días)
- [ ] Migrar `DeleteResultsModal` a nuevo sistema
- [ ] Migrar `DeleteTicketModal` a nuevo sistema
- [ ] Migrar otros modales existentes
- [ ] Mantener APIs públicas compatibles
- [ ] Testing de cada modal migrado

##### Fase 6: Optimizaciones (1 día)
- [ ] Lazy loading de modales pesados
- [ ] Animations con Framer Motion (opcional)
- [ ] Optimizar re-renders
- [ ] Accessibility (ARIA attributes, focus management)

**Optimizaciones específicas:**
```typescript
// Lazy loading
const HeavyModal = lazy(() => import('./HeavyModal'));

// Portal para mejor performance
import { createPortal } from 'react-dom';

const Modal = ({ children }) => {
  return createPortal(
    <ModalContent>{children}</ModalContent>,
    document.getElementById('modal-root')!
  );
};
```

##### Fase 7: Documentación (0.5 día)
- [ ] Documentar API de cada modal
- [ ] Ejemplos de uso común
- [ ] Guía de cuándo usar cada tipo
- [ ] Accessibility guidelines

#### Beneficios
- ✅ Código más limpio y mantenible
- ✅ Consistencia en UX
- ✅ Mejor performance (lazy loading)
- ✅ Mejor accesibilidad
- ✅ Más fácil agregar nuevos modales

#### Estado Actual
- **Prioridad:** Media
- **Estimación:** 1 semana
- **Dependencias:** Ninguna
- **Bloqueantes:** Ninguno

---

## 4. Uniformización de UI

### 4.1 Textos, Labels y Títulos Responsive 📱

**Objetivo:** Estandarizar todos los textos para que funcionen correctamente en todos los tamaños de pantalla.

#### Problema Actual
- Tamaños de texto inconsistentes
- Textos que no se adaptan bien a mobile
- Falta de sistema de tipografía
- Truncamiento inadecuado

#### Tareas

##### Fase 1: Sistema de Tipografía (1 día)
- [ ] Definir scale de tamaños de texto
- [ ] Crear utility classes en Tailwind config
- [ ] Documentar cuándo usar cada tamaño

**Propuesta de scale:**
```typescript
// tailwind.config.js
module.exports = {
  theme: {
    fontSize: {
      // Display (títulos principales)
      'display-lg': ['3.5rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }],  // 56px - solo desktop
      'display-md': ['3rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }],     // 48px
      'display-sm': ['2.5rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],   // 40px

      // Headings
      'h1': ['2rem', { lineHeight: '1.25', letterSpacing: '-0.01em' }],      // 32px
      'h2': ['1.5rem', { lineHeight: '1.33', letterSpacing: '-0.01em' }],    // 24px
      'h3': ['1.25rem', { lineHeight: '1.4' }],                              // 20px
      'h4': ['1.125rem', { lineHeight: '1.4' }],                             // 18px

      // Body
      'body-lg': ['1rem', { lineHeight: '1.5' }],      // 16px
      'body': ['0.875rem', { lineHeight: '1.5' }],     // 14px (default)
      'body-sm': ['0.8125rem', { lineHeight: '1.5' }], // 13px

      // Utility
      'caption': ['0.75rem', { lineHeight: '1.33' }],  // 12px
      'overline': ['0.6875rem', { lineHeight: '1.5', letterSpacing: '0.08em' }], // 11px uppercase
    }
  }
}
```

##### Fase 2: Componentes de Texto (1 día)
- [ ] Crear componentes tipográficos reutilizables

```typescript
// atoms/Typography/
export const Display = ({ size = 'md', children, className }) => (
  <h1 className={cn(`text-display-${size}`, className)}>{children}</h1>
);

export const Heading = ({ level = 1, children, className }) => {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  return <Tag className={cn(`text-h${level}`, className)}>{children}</Tag>;
};

export const Text = ({ size = 'body', children, className }) => (
  <p className={cn(`text-${size}`, className)}>{children}</p>
);

export const Caption = ({ children, className }) => (
  <span className={cn('text-caption text-muted-foreground', className)}>
    {children}
  </span>
);
```

##### Fase 3: Responsive Text Patterns (1 día)
- [ ] Crear patterns para textos responsive

**Patterns comunes:**
```typescript
// Título que se ajusta en mobile
<Heading level={1} className="text-h3 sm:text-h2 md:text-h1">
  Título Principal
</Heading>

// Texto que se oculta en mobile
<Text className="hidden sm:inline">
  Descripción detallada
</Text>

// Truncamiento inteligente
<Text className="truncate max-w-[200px] sm:max-w-none">
  Texto largo que se trunca en mobile
</Text>

// Stack de labels en mobile, inline en desktop
<div className="flex flex-col sm:flex-row sm:gap-2">
  <Label>Monto parcial:</Label>
  <Text>$1,234</Text>
</div>
```

##### Fase 4: Auditoría y Migración (3-5 días)
- [ ] Auditar todas las páginas
- [ ] Identificar textos problemáticos en mobile
- [ ] Migrar a componentes tipográficos
- [ ] Testing en diferentes breakpoints

**Páginas prioritarias:**
1. `make-plays` (muchos labels y textos)
2. `terminal-ticket`
3. `current-account`
4. Modales
5. Headers y navegación

##### Fase 5: Guidelines (0.5 día)
- [ ] Documentar cuándo usar cada tamaño
- [ ] Ejemplos de patterns responsive
- [ ] Guía de truncamiento
- [ ] Guía de labels en formularios

#### Consideraciones
- **Mobile First**: Diseñar para mobile, expandir para desktop
- **Legibilidad**: No usar textos <12px
- **Contraste**: Cumplir WCAG AAA en textos importantes
- **Truncamiento**: Usar tooltip cuando texto se trunca

#### Estado Actual
- **Prioridad:** Media
- **Estimación:** 1 semana
- **Dependencias:** Ninguna
- **Bloqueantes:** Ninguno

---

### 4.2 Uniformización de Botones 🔘

**Objetivo:** Estandarizar todos los botones de la aplicación.

#### Problema Actual
- Algunos usan `Button` de shadcn
- Algunos usan `IconButton` custom
- Inconsistencias en tamaños y variantes
- Comportamiento inconsistente en mobile/desktop

#### Estado Actual (✅ Parcialmente Implementado)
Ya se migró `results-overview.tsx` a usar `IconButton`, que es un buen inicio.

#### Tareas

##### Fase 1: Auditoría (0.5 día)
- [ ] Listar todos los usos de botones en la app
- [ ] Identificar variantes necesarias
- [ ] Documentar casos edge (loading, disabled, etc.)

##### Fase 2: Sistema de Botones (1 día)
- [ ] Consolidar `Button` y `IconButton` en `atoms/Button/`
- [ ] Variantes necesarias:
  - `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`, `success`
- [ ] Tamaños: `xs`, `sm`, `md`, `lg`, `xl`
- [ ] Estados: `loading`, `disabled`, `active`
- [ ] Con/sin icono: left, right, only-icon

**API unificada:**
```typescript
interface ButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  isLoading?: boolean;
  loadingText?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

// Uso
<Button variant="destructive" leftIcon={<Trash2 />} isLoading={isPending}>
  Eliminar
</Button>

<Button variant="outline" size="sm" rightIcon={<ChevronRight />}>
  Siguiente
</Button>
```

##### Fase 3: Icon Buttons (0.5 día)
- [ ] Mantener `IconButton` para casos con icon+text
- [ ] Crear `IconOnlyButton` para solo-icono con tooltip

```typescript
// Icon con texto (mobile oculta icon)
<IconButton icon={<Save />} label="Guardar cambios" />

// Solo icono (con tooltip)
<IconOnlyButton icon={<Edit />} tooltip="Editar" />
```

##### Fase 4: Button Groups (0.5 día)
- [ ] Crear componente para grupos de botones
- [ ] Soporte para segmented buttons

```typescript
<ButtonGroup>
  <Button>Opción 1</Button>
  <Button>Opción 2</Button>
  <Button>Opción 3</Button>
</ButtonGroup>
```

##### Fase 5: Migración (2-3 días)
- [ ] Migrar todos los botones existentes
- [ ] Priorizar páginas principales
- [ ] Testing en cada página migrada

##### Fase 6: Guidelines (0.5 día)
- [ ] Cuándo usar cada variante
- [ ] Cuándo usar icon vs text
- [ ] Placement de botones (primary right, secondary left)
- [ ] Mobile considerations

#### Estado Actual
- **Prioridad:** Media
- **Estimación:** 5-6 días
- **Dependencias:** Ninguna
- **Bloqueantes:** Ninguno
- **Progreso:** 10% (IconButton creado, algunos migrados)

---

### 4.3 Uniformización de Fieldsets y Form Elements 📝

**Objetivo:** Estandarizar todos los elementos de formularios.

#### Problema Actual
- Fieldsets con estilos inconsistentes
- Inputs sin estilo unificado
- Validación inconsistente
- Mensajes de error con diferentes estilos

#### Tareas

##### Fase 1: Form System (2 días)
- [ ] Crear sistema de formularios basado en react-hook-form + zod
- [ ] Componentes base:
  - `FormField`: Wrapper con label, input, error
  - `FormGroup`: Grupo de fields relacionados
  - `FormSection`: Sección con título y fields
  - `Fieldset`: Fieldset con legend

**Estructura:**
```typescript
<Form onSubmit={handleSubmit}>
  <FormSection title="Datos del Ticket">
    <FormField
      label="Monto"
      name="amount"
      type="number"
      placeholder="Ingrese monto"
      required
    />

    <FormField
      label="Fecha"
      name="date"
      type="date"
      required
    />
  </FormSection>

  <Fieldset legend="Loterías">
    <CheckboxGroup name="lotteries" options={lotteries} />
  </Fieldset>
</Form>
```

##### Fase 2: Input Components (2 días)
- [ ] `Input`: Text, number, email, password, etc.
- [ ] `Select`: Dropdown
- [ ] `Checkbox`: Individual o group
- [ ] `Radio`: Radio buttons
- [ ] `Textarea`: Text area
- [ ] `DatePicker`: Date input
- [ ] `NumberInput`: Con steppers (+/-)

Todos integrados con react-hook-form y validación.

##### Fase 3: Validation System (1 día)
- [ ] Mensajes de error consistentes
- [ ] Validación en tiempo real vs on submit
- [ ] Schemas de validación con Zod
- [ ] Error messages en español

```typescript
const ticketSchema = z.object({
  amount: z.number().min(1, 'El monto debe ser mayor a 0'),
  date: z.date({ required_error: 'La fecha es requerida' }),
  lotteries: z.array(z.string()).min(1, 'Seleccione al menos una lotería'),
});
```

##### Fase 4: Migración (3-4 días)
- [ ] Migrar formularios existentes
- [ ] Priorizar:
  1. `make-plays` (formulario más complejo)
  2. Login/Register
  3. Modales con formularios
  4. Otros formularios

##### Fase 5: Guidelines (0.5 día)
- [ ] Guía de uso de cada input
- [ ] Patterns de validación
- [ ] Accessibility guidelines
- [ ] Mobile optimization

#### Estado Actual
- **Prioridad:** Media-Alta
- **Estimación:** 1.5 semanas
- **Dependencias:** Sistema de tipografía
- **Bloqueantes:** Ninguno

---

## 5. Features Nuevas

### 5.1 Envío de Archivos por WhatsApp Web (Desktop) 📤

**Objetivo:** Permitir enviar tickets/reportes por WhatsApp Web desde versión desktop con selector de imprimir-exportar.

#### Contexto
Actualmente existe un selector de radio "Imprimir/Exportar" (visible en `results-overview.tsx`) pero no está implementado.

#### Funcionalidad Propuesta
Al finalizar un ticket, el usuario puede:
1. **Opción Imprimir**: Genera PDF y abre dialog de impresión del navegador
2. **Opción Exportar**: Genera PDF y abre WhatsApp Web para compartir

#### Tareas

##### Fase 1: Setup (1 día)
- [ ] Instalar librería para generar PDFs
  - Opción A: `jspdf` + `html2canvas` (simple)
  - Opción B: `@react-pdf/renderer` (más control)
  - Opción C: Generar PDF en backend (más robusto)

- [ ] Decisión de approach: Frontend vs Backend
  **Recomendado:** Backend (mejor calidad, más fácil customizar)

##### Fase 2: Generación de PDF (2-3 días)

**Opción A: Frontend (jspdf)**
```typescript
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const generateTicketPDF = async (ticketData) => {
  const element = document.getElementById('ticket-to-print');
  const canvas = await html2canvas(element);
  const imgData = canvas.toDataURL('image/png');

  const pdf = new jsPDF();
  pdf.addImage(imgData, 'PNG', 10, 10, 190, 0);

  return pdf;
};
```

**Opción B: Backend (Recomendado)**
- [ ] Crear endpoint `POST /api/private/tickets/{id}/export-pdf`
- [ ] Implementar generación de PDF con librería backend
- [ ] Template de ticket con logo, datos, QR code, etc.
- [ ] Retornar PDF como blob

```typescript
// Backend (Node.js con PDFKit o similar)
const generateTicketPDF = async (ticketId) => {
  const ticket = await getTicketById(ticketId);
  const pdf = new PDFDocument();

  // Header
  pdf.fontSize(20).text('QuiniApp - Ticket', { align: 'center' });
  pdf.fontSize(12).text(`Número: ${ticket.ticket_number}`);

  // Bets
  ticket.bets.forEach(bet => {
    pdf.text(`${bet.lottery_name} - ${bet.number}: $${bet.amount}`);
  });

  // Footer
  pdf.fontSize(10).text(`Total: $${ticket.total}`, { align: 'right' });

  return pdf;
};
```

##### Fase 3: Funcionalidad de Imprimir (0.5 día)
- [ ] Generar PDF
- [ ] Abrir en nueva ventana
- [ ] Trigger browser print dialog

```typescript
const handlePrint = async () => {
  const pdfBlob = await generateTicketPDF(ticketId);
  const pdfUrl = URL.createObjectURL(pdfBlob);

  const printWindow = window.open(pdfUrl);
  printWindow?.print();
};
```

##### Fase 4: Funcionalidad de WhatsApp Web (1 día)
- [ ] Generar PDF
- [ ] Convertir a base64 o subir a temp storage
- [ ] Construir URL de WhatsApp Web con mensaje + link al PDF

**Limitación de WhatsApp Web:**
WhatsApp Web API no permite enviar archivos directamente desde URL. Opciones:

**Opción A: Link de descarga (Simple)**
```typescript
const handleWhatsAppExport = async () => {
  // Generar PDF y subir a storage temporal
  const pdfBlob = await generateTicketPDF(ticketId);
  const downloadUrl = await uploadToTempStorage(pdfBlob); // S3, Cloudinary, etc.

  // Construir mensaje
  const message = encodeURIComponent(
    `Ticket #${ticketNumber}\nTotal: $${total}\nDescarga: ${downloadUrl}`
  );

  // Abrir WhatsApp Web
  const whatsappUrl = `https://web.whatsapp.com/send?text=${message}`;
  window.open(whatsappUrl, '_blank');
};
```

**Opción B: Auto-descarga + instrucciones (Mejor UX)**
```typescript
const handleWhatsAppExport = async () => {
  // 1. Descargar PDF automáticamente
  const pdfBlob = await generateTicketPDF(ticketId);
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ticket-${ticketNumber}.pdf`;
  a.click();

  // 2. Abrir WhatsApp Web con mensaje
  const message = encodeURIComponent(
    `Ticket #${ticketNumber}\nTotal: $${total}\n\n📎 Adjunta el PDF descargado`
  );

  setTimeout(() => {
    window.open(`https://web.whatsapp.com/send?text=${message}`, '_blank');
  }, 500);

  // 3. Mostrar toast con instrucciones
  toast.info('PDF descargado. Adjúntalo en WhatsApp Web.');
};
```

**Opción C: Integración con WhatsApp Business API (Avanzado - Futuro)**
- Requiere cuenta de WhatsApp Business
- Permite envío programático de archivos
- Requiere backend y configuración compleja

##### Fase 5: UI/UX (1 día)
- [ ] Integrar selector Imprimir/Exportar en `results-overview`
- [ ] Estado visual de selección actual
- [ ] Loading states durante generación
- [ ] Toast messages de éxito/error
- [ ] Solo mostrar en desktop (ocultar en mobile)

```typescript
const [exportOption, setExportOption] = useState<'print' | 'whatsapp'>('print');

<RadioGroup value={exportOption} onValueChange={setExportOption}>
  <RadioGroupItem value="print" label="Imprimir" />
  <RadioGroupItem value="whatsapp" label="Enviar por WhatsApp" />
</RadioGroup>

<Button
  onClick={exportOption === 'print' ? handlePrint : handleWhatsAppExport}
  disabled={isGeneratingPDF}
>
  {isGeneratingPDF ? 'Generando...' : exportOption === 'print' ? 'Imprimir' : 'Enviar'}
</Button>
```

##### Fase 6: Testing (1 día)
- [ ] Probar generación de PDF con diferentes tickets
- [ ] Validar calidad de PDF (legibilidad, formato)
- [ ] Probar flujo de impresión en diferentes navegadores
- [ ] Probar flujo de WhatsApp Web
- [ ] Testing en mobile (debería estar oculto)

##### Fase 7: Documentación (0.5 día)
- [ ] Documentar cómo funciona el export
- [ ] Instrucciones para usuario final
- [ ] Troubleshooting común

#### Consideraciones Técnicas
- **Performance**: Generar PDF puede ser pesado, mostrar loading
- **Storage**: Si se sube a temp storage, limpiar archivos viejos
- **Security**: Validar que usuario tiene acceso al ticket
- **Mobile**: Feature solo disponible en desktop (WhatsApp Web no funciona en mobile)

#### Estado Actual
- **Prioridad:** Media
- **Estimación:** 1 semana
- **Dependencias:** Sistema de modales (opcional)
- **Bloqueantes:** Decisión de approach (frontend vs backend PDF)
- **Recomendación:** Backend PDF + Opción B de WhatsApp

---

## 6. Optimizaciones de Performance

### 6.1 Optimizaciones Generales ⚡

**Objetivo:** Mejorar performance general de la aplicación.

#### Áreas de Optimización

##### 6.1.1 Code Splitting y Lazy Loading (2 días)
- [ ] Identificar rutas/componentes pesados
- [ ] Implementar lazy loading de rutas
- [ ] Lazy loading de componentes pesados (modales, gráficos)
- [ ] Preloading de rutas críticas

```typescript
// Lazy loading de rutas
const MakePlays = lazy(() => import('./pages/MakePlays'));
const Reports = lazy(() => import('./pages/Reports'));

// Lazy loading de modales
const HeavyModal = lazy(() => import('./components/modals/HeavyModal'));

// Preloading de ruta crítica
<Link
  to="/make-plays"
  onMouseEnter={() => import('./pages/MakePlays')} // Preload on hover
>
  Hacer Jugada
</Link>
```

##### 6.1.2 Optimización de Re-renders (2 días)
- [ ] Auditar componentes con DevTools Profiler
- [ ] Identificar re-renders innecesarios
- [ ] Aplicar `React.memo` donde corresponda
- [ ] Usar `useMemo` y `useCallback` estratégicamente
- [ ] Optimizar contextos (split contexts grandes)

```typescript
// Memoización estratégica
const ExpensiveComponent = React.memo(({ data }) => {
  const processedData = useMemo(() => processData(data), [data]);
  const handleClick = useCallback(() => onClick(data), [data, onClick]);

  return <div onClick={handleClick}>{processedData}</div>;
});

// Split contexts
// ❌ Mal: Un context gigante
const AppContext = { user, theme, settings, tickets, bets, ... };

// ✅ Bien: Contexts separados
const UserContext = { user };
const ThemeContext = { theme };
const TicketsContext = { tickets, bets };
```

##### 6.1.3 Optimización de Imágenes (1 día)
- [ ] Auditar todas las imágenes
- [ ] Convertir a formatos modernos (WebP, AVIF)
- [ ] Implementar lazy loading de imágenes
- [ ] Responsive images con srcset
- [ ] Comprimir imágenes sin perder calidad

```typescript
// Imagen optimizada
<img
  src="/logo.webp"
  srcSet="/logo-sm.webp 320w, /logo-md.webp 640w, /logo-lg.webp 1280w"
  sizes="(max-width: 640px) 320px, (max-width: 1280px) 640px, 1280px"
  loading="lazy"
  alt="QuiniApp Logo"
/>
```

##### 6.1.4 Optimización de Queries (TanStack Query) (2 días)
- [ ] Revisar configuración de cache
- [ ] Implementar stale-while-revalidate estratégicamente
- [ ] Prefetching de datos anticipados
- [ ] Optimistic updates en mutations
- [ ] Pagination vs Infinite queries según caso de uso

```typescript
// Configuración optimizada
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      cacheTime: 10 * 60 * 1000, // 10 minutos
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Prefetching
const prefetchTickets = () => {
  queryClient.prefetchQuery({
    queryKey: ['tickets'],
    queryFn: fetchTickets,
  });
};

// Optimistic update
const updateTicketMutation = useMutation({
  mutationFn: updateTicket,
  onMutate: async (updatedTicket) => {
    // Cancelar queries en flight
    await queryClient.cancelQueries({ queryKey: ['tickets'] });

    // Snapshot anterior
    const previous = queryClient.getQueryData(['tickets']);

    // Optimistic update
    queryClient.setQueryData(['tickets'], (old) =>
      old.map(t => t.id === updatedTicket.id ? updatedTicket : t)
    );

    return { previous };
  },
  onError: (err, variables, context) => {
    // Rollback en caso de error
    queryClient.setQueryData(['tickets'], context.previous);
  },
});
```

##### 6.1.5 Bundle Size Optimization (1-2 días)
- [ ] Analizar bundle size con `vite-bundle-visualizer`
- [ ] Identificar dependencias pesadas
- [ ] Reemplazar librerías pesadas por alternativas livianas
- [ ] Tree shaking verification
- [ ] Code splitting agresivo

```bash
# Analizar bundle
npm run build
npx vite-bundle-visualizer

# Identificar imports pesados
# Ejemplo: moment.js → date-fns
# Ejemplo: lodash → lodash-es (mejor tree shaking)
```

**Reemplazos comunes:**
```typescript
// ❌ Pesado
import moment from 'moment'; // 67 KB
import _ from 'lodash'; // 71 KB

// ✅ Ligero
import { format } from 'date-fns'; // 10 KB
import { debounce } from 'lodash-es'; // Tree-shakeable
```

##### 6.1.6 Virtualización de Listas (1 día)
- [ ] Implementar virtualización en listas largas
- [ ] Usar `@tanstack/react-virtual` para tablas grandes
- [ ] Optimizar infinite scroll

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const VirtualizedTicketList = ({ tickets }) => {
  const parentRef = useRef();

  const virtualizer = useVirtualizer({
    count: tickets.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // Altura estimada de cada fila
  });

  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(item => (
          <TicketRow
            key={item.key}
            ticket={tickets[item.index]}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: item.size,
              transform: `translateY(${item.start}px)`,
            }}
          />
        ))}
      </div>
    </div>
  );
};
```

##### 6.1.7 Web Vitals Monitoring (1 día)
- [ ] Implementar monitoreo de Web Vitals
- [ ] Tracking de performance en producción
- [ ] Alertas cuando métricas degradan

```typescript
import { onCLS, onFID, onFCP, onLCP, onTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  // Enviar a analytics (Google Analytics, Sentry, etc.)
  console.log(metric);
}

onCLS(sendToAnalytics);
onFID(sendToAnalytics);
onFCP(sendToAnalytics);
onLCP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

##### 6.1.8 Service Worker & Offline Support (2-3 días - Opcional)
- [ ] Implementar Service Worker
- [ ] Cache de assets estáticos
- [ ] Offline fallback page
- [ ] Background sync de datos

```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
      manifest: {
        name: 'QuiniApp',
        short_name: 'QuiniApp',
        theme_color: '#000000',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
});
```

#### Performance Budget
Establecer límites de performance:

```yaml
Performance Budget:
  - First Contentful Paint (FCP): < 1.5s
  - Largest Contentful Paint (LCP): < 2.5s
  - Time to Interactive (TTI): < 3.5s
  - Cumulative Layout Shift (CLS): < 0.1
  - First Input Delay (FID): < 100ms
  - Bundle Size: < 200 KB (gzipped)
  - Total Page Weight: < 1 MB
```

#### Herramientas de Medición
- [ ] Lighthouse CI
- [ ] Chrome DevTools Performance
- [ ] React DevTools Profiler
- [ ] Bundle analyzer
- [ ] WebPageTest

#### Estado Actual
- **Prioridad:** Media-Alta (mejora experiencia general)
- **Estimación:** 2-3 semanas (todas las optimizaciones)
- **Quick Wins:** Lazy loading, bundle optimization (1 semana)
- **Dependencias:** Ninguna
- **Bloqueantes:** Ninguno

---

## 📊 Resumen de Prioridades y Timeline

### Prioridad Alta (1-2 meses)
1. **Atomic Design Migration** - 4-6 semanas
2. **DataTable Reutilizable** - 2-3 días
3. **Sistema de Modales** - 1 semana
4. **Uniformización de Forms** - 1.5 semanas
5. **Performance Quick Wins** - 1 semana

### Prioridad Media (2-3 meses)
1. **Sistema de Tipografía** - 1 semana
2. **Uniformización de Botones** - 5-6 días
3. **Export a WhatsApp** - 1 semana
4. **Performance Optimization** - 2-3 semanas

### Prioridad Baja (Futuro)
1. **Service Worker** - 2-3 días
2. **Advanced Monitoring** - Continuo

---

## 🎯 Plan de Acción Recomendado

### Mes 1: Fundaciones
**Semanas 1-2: Quick Wins**
- DataTable reutilizable
- Sistema de modales básico
- Performance quick wins (lazy loading, bundle)

**Semanas 3-4: Atomic Design - Fase 1**
- Auditoría y planning
- Atoms (Button, Input, Label, Icon)
- Molecules básicas (FormField, Card)

### Mes 2: Core Components
**Semanas 1-2: Atomic Design - Fase 2**
- Organisms (DataTable, Modal, Header)
- Templates básicos

**Semanas 3-4: Uniformización**
- Sistema de tipografía
- Uniformización de forms
- Guidelines y documentación

### Mes 3: Features y Polish
**Semanas 1-2: Features**
- Export a WhatsApp
- Optimizaciones avanzadas

**Semanas 3-4: Migration y Testing**
- Migrar páginas a nuevos componentes
- Testing exhaustivo
- Bug fixes y refinamiento

---

## 📝 Notas Finales

### Principios a Seguir
1. **No romper lo que funciona**: Migrar gradualmente
2. **Mobile First**: Siempre diseñar para mobile primero
3. **Performance Budget**: No degradar performance con refactors
4. **Accesibilidad**: Mantener ARIA y keyboard navigation
5. **Documentar**: Cada componente debe estar documentado
6. **Testing**: Validar funcionalidad en cada migración

### Métricas de Éxito
- ✅ Reducción de código duplicado (>30%)
- ✅ Mejora de performance (LCP <2.5s)
- ✅ Consistencia visual (100% componentes uniformes)
- ✅ Developer Experience (tiempo para agregar features -40%)
- ✅ Bundle size reduction (>20%)

### Mantenimiento Continuo
- **Auditorías mensuales** de componentes
- **Performance monitoring** continuo
- **Actualizar guidelines** cuando agreguen patterns nuevos
- **Refactoring incremental** de componentes legacy

---

**Fecha de última actualización:** 2025-11-20
**Próxima revisión:** 2025-12-20
