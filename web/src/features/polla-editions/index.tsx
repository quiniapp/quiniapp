import { useState, useMemo, Suspense, lazy } from 'react';
import dayjs from 'dayjs';
import Box from '@/components/box';
import HeaderSection from '@/components/header-section';
import { Button } from '@/components/ui/button';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { USER_TYPE } from '@helper/types/user.type';
import { usePollaEditions } from '@/hooks/fetchs/polla-edition/usePollaEditions';
import { useLotteries } from '@/hooks/fetchs/lottery/useLotteries';
import { useSchedules } from '@/hooks/fetchs/schedule/useSchedules';
import { IPollaEditionEntityFront, POLLA_EDITION_STATUS } from '@helper/types/polla-edition.type';
import { LoadingState } from '@/components/molecules/LoadingState';

interface PollaEditionCardProps {
  edition: IPollaEditionEntityFront;
  lotteryName: string;
  scheduleName: string;
  onEdit: (edition: IPollaEditionEntityFront) => void;
  onDelete: (edition: IPollaEditionEntityFront) => void;
  canEdit?: boolean;
}

const fmtDate = (d: string) => dayjs(d).format('DD-MM-YYYY');

const statusLabel: Record<POLLA_EDITION_STATUS, string> = {
  [POLLA_EDITION_STATUS.ACTIVE]: 'Activa',
  [POLLA_EDITION_STATUS.FINISHED]: 'Finalizada',
};

function PollaEditionCard({
  edition,
  lotteryName,
  scheduleName,
  onEdit,
  onDelete,
  canEdit = true,
}: PollaEditionCardProps) {
  const isActive = edition.status === POLLA_EDITION_STATUS.ACTIVE;

  return (
    <div className="bg-[#10121A] border border-border rounded-lg p-4 mb-2">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">
              {lotteryName} · {scheduleName}
            </h3>
            <span
              className={`text-xs px-2 py-1 rounded ${
                isActive ? 'bg-green-500/20 text-green-500' : 'bg-muted text-muted-foreground'
              }`}
            >
              {statusLabel[edition.status]}
              {edition.status === POLLA_EDITION_STATUS.FINISHED &&
                (edition.winner_date ? ' con ganador' : ' sin ganador')}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Del {fmtDate(edition.start_date)} al {fmtDate(edition.end_date)} · Carga hasta{' '}
            {fmtDate(edition.load_limit_date)}
          </p>
          <p className="text-sm text-muted-foreground">
            Pozo: ${edition.pool_amount.toLocaleString('es-AR')} · Ticket: $
            {edition.ticket_price.toLocaleString('es-AR')}
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(edition)}
              className="hover:text-cyan"
            >
              <Edit2 size={18} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(edition)}
              className="hover:text-destructive"
            >
              <Trash2 size={18} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

const PollaEditionsContent = () => {
  const { role } = useAuth();
  const canEdit = role !== USER_TYPE.ADMIN && role !== USER_TYPE.CASHIER;

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedEdition, setSelectedEdition] = useState<IPollaEditionEntityFront | null>(null);

  const { data: editions, isLoading } = usePollaEditions();
  const { data: lotteries } = useLotteries({ all: true });
  const { data: schedules } = useSchedules({ all: true });

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

  const handleEdit = (edition: IPollaEditionEntityFront) => {
    setSelectedEdition(edition);
    setUpdateModalOpen(true);
  };

  const handleDelete = (edition: IPollaEditionEntityFront) => {
    setSelectedEdition(edition);
    setDeleteModalOpen(true);
  };

  if (isLoading) {
    return (
      <Box className="grid grid-rows-[auto_1fr] h-full">
        <HeaderSection title="Polla" />
        <div className="flex items-center justify-center">
          <p className="text-muted-foreground">Cargando ediciones de Polla...</p>
        </div>
      </Box>
    );
  }

  return (
    <Box className="grid grid-rows-[auto_1fr] h-full">
      <HeaderSection title="Polla">
        {canEdit && (
          <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
            <Plus size={20} />
            Nueva Edición
          </Button>
        )}
      </HeaderSection>

      <div className="overflow-y-auto px-6 py-4">
        {editions?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-center mb-4">
              No hay ediciones de Polla creadas
            </p>
            {canEdit && (
              <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
                <Plus size={20} />
                Crear Primera Edición
              </Button>
            )}
          </div>
        ) : (
          editions?.map((edition) => (
            <PollaEditionCard
              key={edition.polla_edition_id}
              edition={edition}
              lotteryName={lotteryNameById.get(edition.lottery_id) ?? edition.lottery_id}
              scheduleName={scheduleNameById.get(edition.schedule_id) ?? edition.schedule_id}
              onEdit={handleEdit}
              onDelete={handleDelete}
              canEdit={canEdit}
            />
          ))
        )}
      </div>

      <Suspense fallback={<LoadingState />}>
        <CreatePollaEditionModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
        />
        <UpdatePollaEditionModal
          isOpen={updateModalOpen}
          onClose={() => setUpdateModalOpen(false)}
          edition={selectedEdition}
        />
        <DeletePollaEditionModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          edition={selectedEdition}
        />
      </Suspense>
    </Box>
  );
};

const CreatePollaEditionModal = lazy(() => import('@/components/modals/CreatePollaEditionModal'));
const UpdatePollaEditionModal = lazy(() => import('@/components/modals/UpdatePollaEditionModal'));
const DeletePollaEditionModal = lazy(() => import('@/components/modals/DeletePollaEditionModal'));

export default PollaEditionsContent;
