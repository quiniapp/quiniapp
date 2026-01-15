import { useState, useEffect } from 'react';
import Modal from './custom-modal';
import { FlexCol } from '../flex';
import { Button } from '../ui/button';
import { GripVertical, X, Save } from 'lucide-react';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import { useUpdateLottery } from '@/hooks/mutations/lottery/useUpdateLottery';
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

interface ReorderLotteriesModalProps {
  isOpen: boolean;
  onClose: VoidFunction;
  lotteries: ILotteryEntityFront[];
}

function SortableItem({ lottery }: { lottery: ILotteryEntityFront }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lottery.lottery_id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-[#10121A] border border-border rounded-lg p-4 mb-2"
    >
      <div className="flex items-center gap-4">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-white"
        >
          <GripVertical size={20} />
        </div>

        <div className="flex-shrink-0">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-semibold text-sm">
            #{lottery.order + 1}
          </span>
        </div>

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
        </div>
      </div>
    </div>
  );
}

const ReorderLotteriesModal = ({ isOpen, onClose, lotteries }: ReorderLotteriesModalProps) => {
  const [tempLotteries, setTempLotteries] = useState<ILotteryEntityFront[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // ✅ usar mutateAsync
  const { mutateAsync: updateLotteryAsync } = useUpdateLottery(undefined, { suppressToast: true });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ✅ inicializar SOLO al abrir + resetear isSaving
  useEffect(() => {
    if (isOpen) {
      const sorted = [...(lotteries ?? [])].sort((a, b) => a.order - b.order);
      setTempLotteries(sorted);
      setIsSaving(false);
    } else {
      // opcional: limpiar al cerrar
      setTempLotteries([]);
      setIsSaving(false);
    }
  }, [isOpen]); // a propósito: no dependemos de lotteries para que no te resetee mientras guardás

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId === overId) return;

    const oldIndex = tempLotteries.findIndex((i) => i.lottery_id === activeId);
    const newIndex = tempLotteries.findIndex((i) => i.lottery_id === overId);
    if (oldIndex === -1 || newIndex === -1) return;

    const moved = arrayMove(tempLotteries, oldIndex, newIndex).map((l, idx) => ({
      ...l,
      order: idx,
    }));

    setTempLotteries(moved);
  };

  const handleSave = async () => {
    if (isSaving) return;

    setIsSaving(true);

    try {
      const changes = tempLotteries.filter((temp) => {
        const original = lotteries.find((l) => l.lottery_id === temp.lottery_id);
        return original && temp.order !== original.order;
      });

      if (changes.length === 0) {
        toast('No hay cambios para guardar', { icon: 'ℹ️' });
        onClose();
        return;
      }

      // ✅ mejor secuencial (más robusto) — si querés paralelo lo cambiamos a Promise.all
      for (const l of changes) {
        await updateLotteryAsync({
          lottery_id: l.lottery_id,
          updateLottery: { order: l.order },
        });
      }

      toast.success('Orden actualizado correctamente');
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error(`Error al actualizar el orden: ${e?.message ?? 'desconocido'}`);
      // no cerramos para que pueda reintentar
    } finally {
      // ✅ SIEMPRE vuelve a false, aunque haya error
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isSaving) return; // bloquea cerrar mientras guarda
    onClose();
  };

  return (
    <Modal
      title="Reordenar Loterías"
      isOpen={isOpen}
      onClose={handleClose}
      className="flex flex-col items-center !max-w-[90vw] sm:!max-w-[600px] w-full m-auto bg-[#060813] pt-4 sm:pt-6"
    >
      <FlexCol className="w-full px-4 gap-4">
        <p className="text-sm text-muted-foreground text-center">
          Arrastra las loterías para cambiar su orden
        </p>

        <div className="max-h-[60vh] overflow-y-auto">
          {tempLotteries.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={tempLotteries.map((i) => i.lottery_id)}
                strategy={verticalListSortingStrategy}
              >
                {tempLotteries.map((lottery) => (
                  <SortableItem key={lottery.lottery_id} lottery={lottery} />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>

        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleClose}
            variant="outline"
            className="w-full gap-2"
            disabled={isSaving}
          >
            <X size={18} />
            Cancelar
          </Button>

          <Button onClick={handleSave} className="w-full gap-2" disabled={isSaving}>
            <Save size={18} />
            {isSaving ? 'Guardando...' : 'Guardar Orden'}
          </Button>
        </div>
      </FlexCol>
    </Modal>
  );
};

export default ReorderLotteriesModal;
