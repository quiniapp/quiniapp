# Dependencias Requeridas

## @dnd-kit - Drag and Drop Library

Para que la funcionalidad de drag & drop en la página de loterías funcione correctamente, necesitas instalar las siguientes dependencias:

```bash
cd web
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### Paquetes instalados:
- `@dnd-kit/core` - Core functionality para drag and drop
- `@dnd-kit/sortable` - Utilidades para listas ordenables
- `@dnd-kit/utilities` - Funciones auxiliares como CSS.Transform

### Uso:
Estos paquetes son utilizados en:
- `web/src/features/lotteries/index.tsx` - Para reordenar loterías mediante drag & drop

### Documentación:
https://docs.dndkit.com/
