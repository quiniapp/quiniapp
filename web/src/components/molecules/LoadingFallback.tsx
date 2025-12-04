import { Loader2 } from 'lucide-react';

interface LoadingFallbackProps {
  message?: string;
  fullScreen?: boolean;
}

export function LoadingFallback({
  message = 'Cargando...',
  fullScreen = false
}: LoadingFallbackProps) {
  const containerClass = fullScreen
    ? 'fixed inset-0 flex items-center justify-center bg-background'
    : 'flex items-center justify-center min-h-[200px]';

  return (
    <div className={containerClass}>
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">{message}</span>
      </div>
    </div>
  );
}
