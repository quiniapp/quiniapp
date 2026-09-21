import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import Modal from './custom-modal';
import { Flex, FlexCol } from '../flex';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { IconButton } from '../button/IconButton';
import { SelectDayToSearch } from '../button/SelectDayToSearch';
import { useUpdatePollaEdition } from '@/hooks/mutations/polla-edition/useUpdatePollaEdition';
import { updatePollaEditionSchema } from '@helper/schemas/polla-edition.schema';
import { IPollaEditionEntityFront } from '@helper/types/polla-edition.type';

const MAX_DATE = dayjs().add(2, 'year').toDate();

interface UpdatePollaEditionModalProps {
  isOpen: boolean;
  onClose: VoidFunction;
  edition: IPollaEditionEntityFront | null;
}

const UpdatePollaEditionModal = ({ isOpen, onClose, edition }: UpdatePollaEditionModalProps) => {
  const [form, setForm] = useState({
    start_date: '',
    end_date: '',
    load_limit_date: '',
    pool_amount: '',
    ticket_price: '',
  });

  useEffect(() => {
    if (edition) {
      setForm({
        start_date: edition.start_date,
        end_date: edition.end_date,
        load_limit_date: edition.load_limit_date,
        pool_amount: String(edition.pool_amount),
        ticket_price: String(edition.ticket_price),
      });
    }
  }, [edition]);

  const { mutate: updateEdition, isPending } = useUpdatePollaEdition(undefined, {
    onSuccess: () => onClose(),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!edition) return;

    const parsed = updatePollaEditionSchema.safeParse({
      start_date: form.start_date,
      end_date: form.end_date,
      load_limit_date: form.load_limit_date,
      pool_amount: Number(form.pool_amount),
      ticket_price: Number(form.ticket_price),
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }

    updateEdition({ polla_edition_id: edition.polla_edition_id, updateEdition: parsed.data });
  };

  if (!edition) return null;

  return (
    <Modal
      title="Editar Edición de Polla"
      isOpen={isOpen}
      onClose={onClose}
      className="flex flex-col items-center !max-w-[90vw] sm:!max-w-[500px] w-full m-auto bg-[#060813] pt-4 sm:pt-6"
    >
      <form onSubmit={handleSubmit} className="w-full px-4">
        <FlexCol className="gap-4 w-full">
          <FlexCol className="gap-2">
            <Label>Fecha límite de carga</Label>
            <SelectDayToSearch
              selectedDay={form.load_limit_date}
              onDayChange={(d) => d && setForm((f) => ({ ...f, load_limit_date: d }))}
              className="w-full"
              toDate={MAX_DATE}
            />
          </FlexCol>

          <FlexCol className="gap-2">
            <Label>Fecha de inicio</Label>
            <SelectDayToSearch
              selectedDay={form.start_date}
              onDayChange={(d) => d && setForm((f) => ({ ...f, start_date: d }))}
              className="w-full"
              toDate={MAX_DATE}
            />
          </FlexCol>

          <FlexCol className="gap-2">
            <Label>Fecha de fin</Label>
            <SelectDayToSearch
              selectedDay={form.end_date}
              onDayChange={(d) => d && setForm((f) => ({ ...f, end_date: d }))}
              className="w-full"
              toDate={MAX_DATE}
            />
          </FlexCol>

          <FlexCol className="gap-2">
            <Label htmlFor="pool_amount">Pozo total</Label>
            <Input
              id="pool_amount"
              type="number"
              min={0}
              value={form.pool_amount}
              onChange={(e) => setForm((f) => ({ ...f, pool_amount: e.target.value }))}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Si la edición anterior quedó sin ganador, sumá acá el sobrante manualmente.
            </p>
          </FlexCol>

          <FlexCol className="gap-2">
            <Label htmlFor="ticket_price">Valor del ticket</Label>
            <Input
              id="ticket_price"
              type="number"
              min={0}
              step="0.01"
              value={form.ticket_price}
              onChange={(e) => setForm((f) => ({ ...f, ticket_price: e.target.value }))}
              disabled={isPending}
            />
          </FlexCol>

          <Flex className="gap-2 pt-4">
            <IconButton
              type="button"
              label="Cancelar"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
              className="w-full"
            />
            <IconButton
              type="submit"
              label={isPending ? 'Guardando...' : 'Guardar'}
              disabled={isPending}
              className="w-full"
            />
          </Flex>
        </FlexCol>
      </form>
    </Modal>
  );
};

export default UpdatePollaEditionModal;
