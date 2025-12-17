import { useState, useMemo, Suspense, lazy } from 'react';
import Box from '@/components/box';
import HeaderSection from '@/components/header-section';
import { Button } from '@/components/ui/button';
import { Plus, Edit2, Trash2, ArrowUpDown } from 'lucide-react';
import { useLotteries } from '@/hooks/fetchs/lottery/useLotteries';
import { useScheduleLottery } from '@/hooks/fetchs/schedule-lottery/useScheduleLottery';
import { useScheduleMap } from '@/hooks/useScheduleMap';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import { LoadingState } from '@/components/molecules/LoadingState';
import { IScheduleLotteryEntityFront } from '@helper/types/schedule-lottery.type';

interface LotteryCardProps {
  lottery: ILotteryEntityFront;
  onEdit: (lottery: ILotteryEntityFront) => void;
  onDelete: (lottery: ILotteryEntityFront) => void;
  scheduleLotteries?: IScheduleLotteryEntityFront;
  scheduleMap: Map<string, { schedule_id: string; name: string; time: string }>;
}

function LotteryCard({
  lottery,
  onEdit,
  onDelete,
  scheduleLotteries,
  scheduleMap,
}: LotteryCardProps) {
  // Get schedules for this lottery
  const scheduleIds = useMemo(() => {
    if (!scheduleLotteries) return [];

    const values = Object.values(scheduleLotteries) as Array<Record<string, string[]>>;
    const found = new Set<string>();

    // scheduleLotteries structure: { DAY: { schedule_id: [lottery_id, ...] } }
    for (const dayObj of values) {
      for (const [scheduleId, lotteryIds] of Object.entries(dayObj)) {
        // Check if this lottery is in the lotteries array for this schedule
        if (lotteryIds.includes(lottery.lottery_id)) {
          found.add(scheduleId); // Collect schedule_id
        }
      }
    }

    return Array.from(found);
  }, [scheduleLotteries, lottery.lottery_id]);

  // Map schedule IDs to names with times
  const scheduleNames = useMemo(() => {
    const ids = new Set(scheduleIds);

    return Array.from(scheduleMap.entries())
      .filter(([scheduleId]) => ids.has(scheduleId))
      .map(([, schedule]) => `${schedule.name} (${schedule.time.slice(0, 5)})`);
  }, [scheduleIds, scheduleMap]);

  return (
    <div className="bg-[#10121A] border border-border rounded-lg p-4 mb-2">
      <div className="flex items-center gap-4">
        {/* Numbered Badge */}
        <div className="flex-shrink-0">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-semibold text-sm">
            #{lottery.order + 1}
          </span>
        </div>

        {/* Lottery Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{lottery.name}</h3>
            <span
              className={`text-xs px-2 py-1 rounded ${
                lottery.active ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
              }`}
            >
              {lottery.active ? 'Activa' : 'Inactiva'}
            </span>
          </div>

          {scheduleNames.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">Turnos: {scheduleNames.join(', ')}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(lottery)}
            className="hover:text-cyan"
          >
            <Edit2 size={18} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(lottery)}
            className="hover:text-destructive"
          >
            <Trash2 size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}

const LotteriesContent = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [reorderModalOpen, setReorderModalOpen] = useState(false);
  const [selectedLottery, setSelectedLottery] = useState<ILotteryEntityFront | null>(null);

  const { data: lotteries, isLoading } = useLotteries(true); // Get all lotteries for admin
  const { data: scheduleLotteries } = useScheduleLottery();
  const scheduleMap = useScheduleMap(); // Get schedule lookup map

  const handleEdit = (lottery: ILotteryEntityFront) => {
    setSelectedLottery(lottery);
    setUpdateModalOpen(true);
  };

  const handleDelete = (lottery: ILotteryEntityFront) => {
    setSelectedLottery(lottery);
    setDeleteModalOpen(true);
  };

  const nextOrder = useMemo(() => {
    if (!lotteries || lotteries.length === 0) return 0;
    return Math.max(...lotteries.map((l) => l.order)) + 1;
  }, [lotteries]);

  if (isLoading) {
    return (
      <Box className="grid grid-rows-[auto_1fr] h-full">
        <HeaderSection title="Loterías" />
        <div className="flex items-center justify-center">
          <p className="text-muted-foreground">Cargando loterías...</p>
        </div>
      </Box>
    );
  }

  return (
    <Box className="grid grid-rows-[auto_1fr] h-full">
      <HeaderSection title="Loterías">
        <div className="flex gap-2">
          <Button onClick={() => setReorderModalOpen(true)} variant="outline" className="gap-2">
            <ArrowUpDown size={18} />
            Cambiar orden
          </Button>
          <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
            <Plus size={20} />
            Nueva Lotería
          </Button>
        </div>
      </HeaderSection>

      <div className="overflow-y-auto px-6 py-4">
        {lotteries?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-center mb-4">No hay loterías creadas</p>
            <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
              <Plus size={20} />
              Crear Primera Lotería
            </Button>
          </div>
        ) : (
          <>
            {lotteries?.map((lottery) => (
              <LotteryCard
                key={lottery.lottery_id}
                lottery={lottery}
                onEdit={handleEdit}
                onDelete={handleDelete}
                scheduleLotteries={scheduleLotteries}
                scheduleMap={scheduleMap}
              />
            ))}
            <div className="mt-4 text-xs text-muted-foreground text-center">
              Click en "Cambiar orden" para reorganizar las loterías
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      <Suspense fallback={<LoadingState />}>
        <CreateLotteryModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          nextOrder={nextOrder}
        />
        <UpdateLotteryModal
          isOpen={updateModalOpen}
          onClose={() => setUpdateModalOpen(false)}
          lottery={selectedLottery}
        />
        <DeleteLotteryModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          lottery={selectedLottery}
        />
        <ReorderLotteriesModal
          isOpen={reorderModalOpen}
          onClose={() => setReorderModalOpen(false)}
          lotteries={lotteries || []}
        />
      </Suspense>
    </Box>
  );
};

const CreateLotteryModal = lazy(() => import('@/components/modals/CreateLotteryModal'));
const UpdateLotteryModal = lazy(() => import('@/components/modals/UpdateLotteryModal'));
const DeleteLotteryModal = lazy(() => import('@/components/modals/DeleteLotteryModal'));
const ReorderLotteriesModal = lazy(() => import('@/components/modals/ReorderLotteriesModal'));

export default LotteriesContent;
