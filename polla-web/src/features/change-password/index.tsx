import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { pollaChangePasswordSchema } from '@helper/polla/schemas/auth.schema';
import { apiClient } from '@/lib/apiClient';
import { BACKEND_ROUTES } from '@/routes/backend-routes';
import { useAuth } from '@/providers/AuthContext';
import { ROUTES } from '@/types/routes.type';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/PageHeader';

export const ChangePasswordPage = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = pollaChangePasswordSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? 'Datos inválidos');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post(BACKEND_ROUTES.auth.changePassword, parsed.data);
      toast.success('Contraseña actualizada');
      await refreshUser();
      navigate(ROUTES.BETS, { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cambiar la contraseña');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <PageHeader
        description={
          user?.password_reset_required
            ? 'Tu contraseña es temporal: cambiala para seguir.'
            : undefined
        }
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl bg-card p-4 sm:p-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="current">Contraseña actual</Label>
          <Input
            id="current"
            type="password"
            value={form.current_password}
            onChange={(e) => setForm({ ...form, current_password: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new">Contraseña nueva</Label>
          <Input
            id="new"
            type="password"
            value={form.new_password}
            onChange={(e) => setForm({ ...form, new_password: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm">Repetir contraseña nueva</Label>
          <Input
            id="confirm"
            type="password"
            value={form.confirm_password}
            onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
          />
        </div>

        <Button type="submit" disabled={submitting}>
          {submitting ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </div>
  );
};

export default ChangePasswordPage;
