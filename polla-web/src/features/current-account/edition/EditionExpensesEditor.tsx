import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { useOrgExpenses } from '@/hooks/fetchs/usePollaData';
import { useCreateExpense } from '@/hooks/mutations/usePollaMutations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExpenseItems } from '../dialogs/shared';

/**
 * Gastos de una edición: los de la organización o, con `groupId`, los de ese
 * grupo. Se guardan al agregarlos y entran en los tickets de la edición.
 */
export const EditionExpensesEditor = ({
  editionId,
  groupId,
  organizationId,
}: {
  editionId: string;
  groupId: string | null;
  organizationId: string | null;
}) => {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');

  const { data: expenses = [] } = useOrgExpenses({
    polla_edition_id: editionId,
    polla_group_id: groupId,
    polla_organization_id: organizationId,
  });
  const { mutate: createExpense, isPending } = useCreateExpense();

  const handleAdd = () => {
    const value = Number(amount.replace(',', '.'));
    if (!name.trim() || !Number.isFinite(value) || value <= 0) {
      toast.error('Ingresá nombre y monto');
      return;
    }
    createExpense(
      {
        polla_edition_id: editionId,
        name: name.trim(),
        amount: value,
        polla_group_id: groupId,
        ...(organizationId ? { polla_organization_id: organizationId } : {}),
      },
      {
        onSuccess: () => {
          setName('');
          setAmount('');
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <Label>Gastos de la edición</Label>
      <ExpenseItems expenses={expenses} organizationId={organizationId} />
      <div className="flex gap-2">
        <Input
          aria-label="Nombre del gasto"
          placeholder="Concepto"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          aria-label="Monto del gasto"
          placeholder="Monto"
          inputMode="decimal"
          className="w-28"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Agregar gasto"
          onClick={handleAdd}
          disabled={isPending}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
};
