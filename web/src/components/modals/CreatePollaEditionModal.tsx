import { useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import Modal from './custom-modal';
import { Flex, FlexCol } from '../flex';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { IconButton } from '../button/IconButton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { SelectDayToSearch } from '../button/SelectDayToSearch';
import { useLotteries } from '@/hooks/fetchs/lottery/useLotteries';
import { useSchedules } from '@/hooks/fetchs/schedule/useSchedules';
import { useCreatePollaEdition } from '@/hooks/mutations/polla-edition/useCreatePollaEdition';
import { newPollaEditionSchema } from '@helper/schemas/polla-edition.schema';

interface CreatePollaEditionModalProps {
  isOpen: boolean;
  onClose: VoidFunction;
}

const MAX_DATE = dayjs().add(2, 'year').toDate();

const emptyForm = {
  lottery_id: '',
  schedule_id: '',
  start_date: '',
  end_date: '',
  load_limit_date: '',
  pool_amount: '',
  ticket_price: '',
};

const CreatePollaEditionModal = ({ isOpen, onClose }: CreatePollaEditionModalProps) => {
  const [form, setForm] = useState(emptyForm);

  const { data: lotteries } = useLotteries({ all: true });
  const { data: schedules } = useSchedules({ all: true });

  const { mutate: createEdition, isPending } = useCreatePollaEdition(undefined, {
    onSuccess: () => {
      setForm(emptyForm);
      onClose();
    },
  });

  const handleClose = () => {
    setForm(emptyForm);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = newPollaEditionSchema.safeParse({
      lottery_id: form.lottery_id,
      schedule_id: form.schedule_id,
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

    createEdition(parsed.data);
  };

  return (
    <Modal
      title="Nueva Edición de Polla"
      isOpen={isOpen}
      onClose={handleClose}
      className="flex flex-col items-center !max-w-[90vw] sm:!max-w-[500px] w-full m-auto bg-[#060813] pt-4 sm:pt-6"
    >
      <form onSubmit={handleSubmit} className="w-full px-4">
        <FlexCol className="gap-4 w-full">
          <FlexCol className="gap-2">
            <Label>Quiniela</Label>
            <Select
              value={form.lottery_id}
              onValueChange={(v) => setForm((f) => ({ ...f, lottery_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar quiniela" />
              </SelectTrigger>
              <SelectContent>
                {lotteries?.map((l) => (
                  <SelectItem key={l.lottery_id} value={l.lottery_id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FlexCol>

          <FlexCol className="gap-2">
            <Label>Turno</Label>
            <Select
              value={form.schedule_id}
              onValueChange={(v) => setForm((f) => ({ ...f, schedule_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar turno" />
              </SelectTrigger>
              <SelectContent>
                {schedules?.map((s) => (
                  <SelectItem key={s.schedule_id} value={s.schedule_id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FlexCol>

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
              placeholder="Ej: 500000"
              disabled={isPending}
            />
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
              placeholder="Ej: 500"
              disabled={isPending}
            />
          </FlexCol>

          <Flex className="gap-2 pt-4">
            <IconButton
              type="button"
              label="Cancelar"
              variant="outline"
              onClick={handleClose}
              disabled={isPending}
              className="w-full"
            />
            <IconButton
              type="submit"
              label={isPending ? 'Creando...' : 'Crear'}
              disabled={isPending}
              className="w-full"
            />
          </Flex>
        </FlexCol>
      </form>
    </Modal>
  );
};

export default CreatePollaEditionModal;
