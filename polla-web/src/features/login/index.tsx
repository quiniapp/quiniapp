import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { pollaLoginSchema } from '@helper/polla/schemas/auth.schema';
import { useAuth } from '@/providers/AuthContext';
import { ROUTES } from '@/types/routes.type';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const LoginPage = () => {
  const { login, isAuth, loading } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isAuth) navigate(ROUTES.BETS, { replace: true });
  }, [isAuth, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = pollaLoginSchema.safeParse({ username, password });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? 'Datos inválidos');
      return;
    }

    setSubmitting(true);
    try {
      await login(parsed.data.username, parsed.data.password);
      navigate(ROUTES.BETS, { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo iniciar sesión');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl bg-card p-4 shadow-lg sm:p-6"
      >
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-wide text-foreground">POLLA</h1>
          <p className="text-sm text-muted-foreground">Ingresá con tu usuario</p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="username">Usuario</Label>
          <Input
            id="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <Button type="submit" disabled={submitting}>
          {submitting ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </form>
    </div>
  );
};

export default LoginPage;
