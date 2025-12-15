import { useState, useMemo, Suspense, lazy, } from 'react';
import Box from '@/components/box';
import HeaderSection from '@/components/header-section';
import { Button } from '@/components/ui/button';
import { Plus, GripVertical, Edit2, Trash2 } from 'lucide-react';
import { useLotteries } from '@/hooks/fetchs/lottery/useLotteries';
import { useScheduleLottery } from '@/hooks/fetchs/schedule-lottery/useScheduleLottery';
import { useUpdateLottery } from '@/hooks/mutations/lottery/useUpdateLottery';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import { toast } from 'react-hot-toast';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LoadingState } from '@/components/molecules/LoadingState';
import { IScheduleLotteryEntityFront } from '@helper/types/schedule-lottery.type';

interface SortableItemProps {
  lottery: ILotteryEntityFront;
  onEdit: (lottery: ILotteryEntityFront) => void;
  onDelete: (lottery: ILotteryEntityFront) => void;
  scheduleLotteries?: IScheduleLotteryEntityFront;
}

function SortableItem({ lottery, onEdit, onDelete, scheduleLotteries }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lottery.lottery_id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Get schedules for this lottery
  const schedules = useMemo(() => {
    if (!scheduleLotteries) return [];

    const values = Object.values(scheduleLotteries) as Array<Record<string, string[]>>;

    const found = new Set<string>();

    for (const dayObj of values) {
      for (const [lotteryId, scheduleIds] of Object.entries(dayObj)) {
        // si en el string[] está el lottery_id actual
        if (scheduleIds.includes(lottery.lottery_id)) {
          found.add(lotteryId); // guardo el id (key string)
        }
      }
    }

    return Array.from(found);
  }, [scheduleLotteries, lottery.lottery_id]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-[#10121A] border border-border rounded-lg p-4 mb-2"
    >
      <div className="flex lotteries-center gap-4">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-white"
        >
          <GripVertical size={20} />
        </div>

        {/* Lottery Info */}
        <div className="flex-1">
          <div className="flex lotteries-center gap-2">
            <h3 className="text-lg font-semibold">{lottery.name}</h3>
            <span
              className={`text-xs px-2 py-1 rounded ${
                lottery.active ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
              }`}
            >
              {lottery.active ? 'Activa' : 'Inactiva'}
            </span>
          </div>

          {schedules?.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              Turnos:{' '}
              {schedules.length > 0 && (
                <p className="text-sm text-muted-foreground mt-1">Turnos: {schedules.join(', ')}</p>
              )}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex lotteries-center gap-2">
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
  const [selectedLottery, setSelectedLottery] = useState<ILotteryEntityFront | null>(null);

  const { data: lotteries, isLoading } = useLotteries(true); // Get all lotteries for admin
  const { data: scheduleLotteries } = useScheduleLottery();
  const { mutate: updateLottery } = useUpdateLottery();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = lotteries?.findIndex((item) => item.lottery_id === active.id);
      const newIndex = lotteries?.findIndex((item) => item.lottery_id === over.id);

      const newLotteries = arrayMove(lotteries ?? [], oldIndex ?? 0, newIndex ?? 0);

      // Update order in backend
      newLotteries.forEach((lottery, index) => {
        if (lottery.order !== index) {
          updateLottery(
            {
              lottery_id: lottery.lottery_id,
              updateLottery: { order: index },
            },
            {
              onError: () => {
                toast.error('Error al actualizar orden');
              },
            }
          );
        }
      });
    }
  };

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
        <div className="flex lotteries-center justify-center">
          <p className="text-muted-foreground">Cargando loterías...</p>
        </div>
      </Box>
    );
  }

  return (
    <Box className="grid grid-rows-[auto_1fr] h-full">
      <HeaderSection title="Loterías">
        <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
          <Plus size={20} />
          Nueva Lotería
        </Button>
      </HeaderSection>

      <div className="overflow-y-auto px-6 py-4">
        {lotteries?.length === 0 ? (
          <div className="flex flex-col lotteries-center justify-center py-12">
            <p className="text-muted-foreground text-center mb-4">No hay loterías creadas</p>
            <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
              <Plus size={20} />
              Crear Primera Lotería
            </Button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={lotteries?.map((item) => item.lottery_id) ?? []}
              strategy={verticalListSortingStrategy}
            >
              {lotteries?.map((lottery) => (
                <SortableItem
                  key={lottery.lottery_id}
                  lottery={lottery}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  scheduleLotteries={scheduleLotteries}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}

        <div className="mt-4 text-xs text-muted-foreground text-center">
          Arrastra las loterías para cambiar el orden
        </div>
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
      </Suspense>
    </Box>
  );
};

const CreateLotteryModal = lazy(() => import('@/components/modals/CreateLotteryModal'));
const UpdateLotteryModal = lazy(() => import('@/components/modals/UpdateLotteryModal'));
const DeleteLotteryModal = lazy(() => import('@/components/modals/DeleteLotteryModal'));

export default LotteriesContent;
