import { FormEvent, useState } from 'react';
import { toast } from 'react-hot-toast';
import { KeyRound, Pencil, Plus, Trash2 } from 'lucide-react';
import { newPollaOrganizationWithCapitalistSchema } from '@helper/polla/schemas/user.schema';
import { IPollaOrganizationWithCapitalist } from '@helper/polla/types/catalog.type';
import { useOrganizations } from '@/hooks/fetchs/useCatalogs';
import {
  useCreateOrganization,
  useDeleteOrganization,
  useResetCapitalistPassword,
  useUpdateOrganization,
} from '@/hooks/mutations/usePollaMutations';
import { useAuth } from '@/providers/AuthContext';
import { EmptyState, PageHeader } from '@/components/PageHeader';
import { ResetPasswordDialog } from '@/components/ResetPasswordDialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const emptyForm = {
  organization: '',
  name: '',
  last_name: '',
  username: '',
  password: '',
  email: '',
  phone: '',
};

/** Alta de la organización junto con su capitalista, como en QuiniApp. */
const CreateOrganizationDialog = ({ onClose }: { onClose: () => void }) => {
  const [form, setForm] = useState(emptyForm);
  const { mutate: createOrganization, isPending } = useCreateOrganization();

  const field = (key: keyof typeof emptyForm) => ({
    id: `new-org-${key}`,
    value: form[key],
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value }),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const payload = {
      organization: { name: form.organization.trim() },
      capitalist: {
        name: form.name.trim(),
        last_name: form.last_name.trim() || null,
        username: form.username.trim(),
        password: form.password,
        email: form.email.trim() || null,
        phone: form.phone ? Number(form.phone) : null,
      },
    };

    const parsed = newPollaOrganizationWithCapitalistSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? 'Revisá los datos');
      return;
    }

    createOrganization(payload, { onSuccess: onClose });
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Nueva organización con capitalista</DialogTitle>
          <DialogDescription>
            El capitalista entra con este usuario y administra su organización.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <fieldset className="rounded-md border px-4 pb-4 pt-2">
            <legend className="px-2 text-sm font-semibold">Organización</legend>
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-org-organization">Nombre de la organización</Label>
              <Input {...field('organization')} autoFocus />
            </div>
          </fieldset>

          <fieldset className="rounded-md border px-4 pb-4 pt-2">
            <legend className="px-2 text-sm font-semibold">Capitalista</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="new-org-name">Nombre</Label>
                <Input {...field('name')} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="new-org-last_name">Apellido</Label>
                <Input {...field('last_name')} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="new-org-username">Usuario</Label>
                <Input {...field('username')} autoComplete="off" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="new-org-password">Contraseña (mínimo 6 caracteres)</Label>
                <Input {...field('password')} type="password" autoComplete="new-password" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="new-org-email">Email</Label>
                <Input {...field('email')} type="email" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="new-org-phone">Teléfono</Label>
                <Input
                  {...field('phone')}
                  inputMode="tel"
                  onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })}
                />
              </div>
            </div>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creando…' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const RenameOrganizationDialog = ({
  organization,
  onClose,
}: {
  organization: IPollaOrganizationWithCapitalist;
  onClose: () => void;
}) => {
  const [name, setName] = useState(organization.name);
  const { mutate: updateOrganization, isPending } = useUpdateOrganization();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Poné un nombre');
      return;
    }
    updateOrganization(
      { id: organization.polla_organization_id, name: name.trim() },
      { onSuccess: onClose }
    );
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Editar organización</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="edit-org-name">Nombre</Label>
            <Input id="edit-org-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const capitalistLabel = (organization: IPollaOrganizationWithCapitalist) => {
  const capitalist = organization.capitalist;
  if (!capitalist) return 'Sin capitalista';
  const fullName = `${capitalist.name} ${capitalist.last_name ?? ''}`.trim();
  return capitalist.username ? `${fullName} (${capitalist.username})` : fullName;
};

/** Una organización = un capitalista, con su pozo, sus usuarios y su liquidación. */
export const OrganizationsPage = () => {
  const { activeOrganizationId, setActiveOrganizationId } = useAuth();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<IPollaOrganizationWithCapitalist | null>(null);
  const [resetting, setResetting] = useState<IPollaOrganizationWithCapitalist | null>(null);

  const { data } = useOrganizations({ limit: 200 });
  const { mutate: deleteOrganization } = useDeleteOrganization();
  const { mutate: resetCapitalist, isPending: isResetting } = useResetCapitalistPassword();

  return (
    <div>
      <PageHeader
        description="Cada organización es un capitalista: corre su propia Polla, con su pozo y su liquidación."
        actions={
          <Button type="button" onClick={() => setCreating(true)}>
            <Plus />
            Nueva organización
          </Button>
        }
      />

      {data?.data.length === 0 ? (
        <EmptyState message="Todavía no hay organizaciones" />
      ) : (
        <div className="overflow-x-auto rounded-md border bg-card text-card-foreground">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Capitalista</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data.map((organization) => (
                <TableRow key={organization.polla_organization_id}>
                  <TableCell className="font-medium">{organization.name}</TableCell>
                  <TableCell>{capitalistLabel(organization)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant={
                          activeOrganizationId === organization.polla_organization_id
                            ? 'default'
                            : 'outline'
                        }
                        size="sm"
                        onClick={() => setActiveOrganizationId(organization.polla_organization_id)}
                      >
                        Trabajar acá
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Editar"
                        aria-label={`Editar ${organization.name}`}
                        onClick={() => setRenaming(organization)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Blanquear contraseña del capitalista"
                        aria-label={`Blanquear la contraseña del capitalista de ${organization.name}`}
                        disabled={!organization.capitalist}
                        onClick={() => setResetting(organization)}
                      >
                        <KeyRound />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Eliminar"
                        aria-label={`Eliminar ${organization.name}`}
                        onClick={() => {
                          if (window.confirm(`¿Eliminar ${organization.name}?`)) {
                            deleteOrganization({ id: organization.polla_organization_id });
                          }
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {creating && <CreateOrganizationDialog onClose={() => setCreating(false)} />}
      {renaming && (
        <RenameOrganizationDialog organization={renaming} onClose={() => setRenaming(null)} />
      )}
      {resetting && (
        <ResetPasswordDialog
          title={`${resetting.capitalist?.name ?? 'el capitalista'} (${resetting.name})`}
          isPending={isResetting}
          onConfirm={(password) =>
            resetCapitalist(
              { id: resetting.polla_organization_id, password },
              { onSuccess: () => setResetting(null) }
            )
          }
          onClose={() => setResetting(null)}
        />
      )}
    </div>
  );
};

export default OrganizationsPage;
