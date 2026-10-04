import { ReactNode } from 'react';

interface PageHeaderProps {
  /** El título de la sección lo pinta el header de la app; acá solo se usa
   *  para subsecciones dentro de una misma pantalla. */
  title?: string;
  description?: string;
  actions?: ReactNode;
}

export const PageHeader = ({ title, description, actions }: PageHeaderProps) => {
  if (!title && !description && !actions) return null;

  return (
    <div className="flex flex-wrap items-end justify-between gap-3 pb-4">
      {(title || description) && (
        <div className="min-w-0">
          {title && <h2 className="text-lg font-semibold text-foreground sm:text-xl">{title}</h2>}
          {description && <p className="text-xs text-muted-foreground sm:text-sm">{description}</p>}
        </div>
      )}
      {/* En 320px las acciones bajan a su propia línea y ocupan el ancho. */}
      {actions && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
          {actions}
        </div>
      )}
    </div>
  );
};

export const EmptyState = ({ message }: { message: string }) => (
  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground sm:p-8">
    {message}
  </div>
);
