import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { useOrganizations } from '@/hooks/fetchs/useCatalogs';
import { useCreateOrganization, useDeleteOrganization } from '@/hooks/mutations/usePollaMutations';
import { useAuth } from '@/providers/AuthContext';
import { EmptyState, PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
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

/** Una organización = un capitalist, con su pozo, sus usuarios y su liquidación. */
export const OrganizationsPage = () => {
  const { activeOrganizationId, setActiveOrganizationId } = useAuth();
  const [name, setName] = useState('');

  const { data } = useOrganizations({ limit: 100 });
  const { mutate: createOrganization, isPending } = useCreateOrganization();
  const { mutate: deleteOrganization } = useDeleteOrganization();

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error('Poné un nombre');
      return;
    }
    createOrganization({ name: name.trim() }, { onSuccess: () => setName('') });
  };

  return (
    <div>
      <PageHeader description="Cada organización es un capitalist: corre su propia Polla, con su pozo y su liquidación." />

      <div className="mb-6 flex flex-wrap items-end gap-2 rounded-xl bg-card p-4">
        <div className="flex flex-1 flex-col gap-1">
          <Label>Nombre</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button type="button" onClick={handleCreate} disabled={isPending}>
          Crear organización
        </Button>
      </div>

      {data?.data.length === 0 ? (
        <EmptyState message="Todavía no hay organizaciones" />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data.map((organization) => (
                <TableRow key={organization.polla_organization_id}>
                  <TableCell>{organization.name}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
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
                        title="Eliminar"
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
    </div>
  );
};

export default OrganizationsPage;
