import { useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import Modal from './custom-modal';
import { Flex, FlexCol } from '../flex';
import { Label } from '../ui/label';
import { IconButton } from '../button/IconButton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { PollaNumberBoxes, createEmptyPollaNumbers, pollaNumbersError } from '../PollaNumberGrid';
import { usePollaEditions } from '@/hooks/fetchs/polla-edition/usePollaEditions';
import { useLotteries } from '@/hooks/fetchs/lottery/useLotteries';
import { useSchedules } from '@/hooks/fetchs/schedule/useSchedules';
import { useCreatePollaBet } from '@/hooks/mutations/polla-bet/useCreatePollaBet';
import { POLLA_EDITION_STATUS } from '@helper/types/polla-edition.type';
import dayjs from 'dayjs';

interface CreatePollaBetModalProps {
  isOpen: boolean;
  onClose: VoidFunction;
  userId: string | null;
  userName: string;
}

const CreatePollaBetModal = ({ isOpen, onClose, userId, userName }: CreatePollaBetModalProps) => {
  const [pollaEditionId, setPollaEditionId] = useState('');
  const [numbers, setNumbers] = useState<string[]>(createEmptyPollaNumbers());

  const { data: editions } = usePollaEditions({ status: POLLA_EDITION_STATUS.ACTIVE });
  const { data: lotteries } = useLotteries({ all: true });
  const { data: schedules } = useSchedules({ all: true });

  const today = dayjs().format('YYYY-MM-DD');
  const loadableEditions = useMemo(
    () => editions?.filter((e) => e.load_limit_date >= today) ?? [],
    [editions, today]
  );

  const lotteryNameById = useMemo(() => {
    const map = new Map<string, string>();
    lotteries?.forEach((l) => map.set(l.lottery_id, l.name));
    return map;
  }, [lotteries]);

  const scheduleNameById = useMemo(() => {
    const map = new Map<string, string>();
    schedules?.forEach((s) => map.set(s.schedule_id, s.name));
    return map;
  }, [schedules]);

  const { mutate: createBet, isPending } = useCreatePollaBet(undefined, {
    onSuccess: () => {
      setNumbers(createEmptyPollaNumbers());
    },
  });

  const handleClose = () => {
    setNumbers(createEmptyPollaNumbers());
    setPollaEditionId('');
    onClose();
  };

  const handleSubmit = () => {
    if (!pollaEditionId) {
      toast.error('Seleccioná una edición de Polla');
      return;
    }
    const error = pollaNumbersError(numbers);
    if (error) {
      toast.error(error);
      return;
    }
    if (!userName) {
      toast.error('Seleccioná un pasador antes de cargar la jugada');
      return;
    }

    createBet(
      { polla_edition_id: pollaEditionId, numbers, user_id: userId, user_name: userName },
      { onSuccess: () => setNumbers(createEmptyPollaNumbers()) }
    );
  };

  return (
    <Modal
      title="Cargar Jugada de Polla"
      isOpen={isOpen}
      onClose={handleClose}
      className="flex flex-col items-center !max-w-[95vw] sm:!max-w-[560px] w-full m-auto bg-[#060813] pt-4 sm:pt-6"
    >
      <FlexCol className="gap-4 w-full px-4">
        <FlexCol className="gap-2">
          <Label>Edición</Label>
          <Select value={pollaEditionId} onValueChange={setPollaEditionId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar edición" />
            </SelectTrigger>
            <SelectContent>
              {loadableEditions.map((e) => (
                <SelectItem key={e.polla_edition_id} value={e.polla_edition_id}>
                  {lotteryNameById.get(e.lottery_id) ?? e.lottery_id} ·{' '}
                  {scheduleNameById.get(e.schedule_id) ?? e.schedule_id} (
                  {dayjs(e.start_date).format('DD-MM-YYYY')} al{' '}
                  {dayjs(e.end_date).format('DD-MM-YYYY')})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {loadableEditions.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No hay ediciones de Polla abiertas para carga en este momento.
            </p>
          )}
        </FlexCol>

        <PollaNumberBoxes values={numbers} onChange={setNumbers} />

        <Flex className="gap-2 pt-2 pb-2">
          <IconButton
            type="button"
            label="Cancelar"
            variant="outline"
            onClick={handleClose}
            disabled={isPending}
            className="w-full"
          />
          <IconButton
            type="button"
            label={isPending ? 'Cargando...' : 'Cargar Jugada'}
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full"
          />
        </Flex>
      </FlexCol>
    </Modal>
  );
};

export default CreatePollaBetModal;
