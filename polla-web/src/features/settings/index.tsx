import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Check, KeyRound } from 'lucide-react';
import { POLLA_THEME } from '@helper/polla/types/user.type';
import { useAuth } from '@/providers/AuthContext';
import { ROUTES } from '@/types/routes.type';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const THEMES: { value: POLLA_THEME; label: string; description: string }[] = [
  {
    value: POLLA_THEME.LIGHT,
    label: 'Claro',
    description: 'Fondo claro con letras oscuras.',
  },
  {
    value: POLLA_THEME.DARK,
    label: 'Oscuro',
    description: 'Fondo azul grisáceo con letras blancas.',
  },
];

/**
 * Miniatura del tema: el contenedor lleva su propio `data-theme`, así que los
 * colores son los reales del tema y no una imitación.
 */
const ThemePreview = ({ theme }: { theme: POLLA_THEME }) => (
  <div
    data-theme={theme}
    aria-hidden
    className="flex flex-col gap-2 rounded-md border bg-background p-3 text-foreground"
  >
    <div className="flex items-center justify-between rounded bg-card px-2 py-1 text-xs font-semibold text-card-foreground">
      Jugadas
      <span className="rounded bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">
        Cargar
      </span>
    </div>
    <div className="flex gap-1">
      {['02', '14', '32', '57'].map((n, i) => (
        <span
          key={n}
          className={cn(
            'inline-flex h-6 w-7 items-center justify-center rounded text-xs tabular-nums',
            i < 2 ? 'bg-hit font-bold text-hit-foreground' : 'bg-card text-card-foreground'
          )}
        >
          {n}
        </span>
      ))}
    </div>
    <div className="rounded border border-input-border bg-input px-2 py-1 text-xs text-input-foreground">
      Número
    </div>
  </div>
);

export const SettingsPage = () => {
  const { user, setTheme } = useAuth();
  const [saving, setSaving] = useState<POLLA_THEME | null>(null);

  const current = user?.theme ?? POLLA_THEME.LIGHT;

  const handleSelect = async (theme: POLLA_THEME) => {
    if (theme === current || saving) return;

    setSaving(theme);
    try {
      await setTheme(theme);
      toast.success('Tema actualizado');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el tema');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <section className="rounded-xl bg-card p-4 text-card-foreground sm:p-6">
        <PageHeader
          title="Tema"
          description="Se guarda en tu usuario: lo vas a ver igual en cualquier dispositivo."
        />

        <div role="radiogroup" aria-label="Tema" className="grid gap-3 sm:grid-cols-2">
          {THEMES.map(({ value, label, description }) => {
            const selected = value === current;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={Boolean(saving)}
                onClick={() => handleSelect(value)}
                className={cn(
                  'flex flex-col gap-3 rounded-lg border-2 p-3 text-left transition-colors',
                  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  selected ? 'border-primary' : 'border-border hover:border-primary/60'
                )}
              >
                <ThemePreview theme={value} />
                <span className="flex items-center justify-between gap-2">
                  <span>
                    <span className="block font-semibold">{label}</span>
                    <span className="block text-xs text-muted-foreground">{description}</span>
                  </span>
                  {selected && (
                    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-4" />
                    </span>
                  )}
                  {saving === value && (
                    <span className="text-xs text-muted-foreground">Guardando…</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl bg-card p-4 text-card-foreground sm:p-6">
        <PageHeader title="Cuenta" />
        <Button asChild variant="outline">
          <Link to={ROUTES.CHANGE_PASSWORD}>
            <KeyRound />
            Cambiar contraseña
          </Link>
        </Button>
      </section>
    </div>
  );
};

export default SettingsPage;
