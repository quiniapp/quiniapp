import { Suspense, useState } from 'react';
import Box from '@/components/box';
import HeaderSection from '@/components/header-section';
import { Button } from '@/components/ui/button';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useSchedules } from '@/hooks/fetchs/schedule/useSchedules';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import CreateScheduleModal from '@/components/modals/CreateScheduleModal';
import UpdateScheduleModal from '@/components/modals/UpdateScheduleModal';
import DeleteScheduleModal from '@/components/modals/DeleteScheduleModal';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { LoadingState } from '@/components/molecules/LoadingState';

const ShiftsContent = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<IScheduleEntityFront | null>(null);

  const { data: schedules, isLoading } = useSchedules(true);

  const handleEdit = (schedule: IScheduleEntityFront) => {
    setSelectedSchedule(schedule);
    setUpdateModalOpen(true);
  };

  const handleDelete = (schedule: IScheduleEntityFront) => {
    setSelectedSchedule(schedule);
    setDeleteModalOpen(true);
  };
  
  if (isLoading) {
    return (
      <Box className="grid grid-rows-[auto_1fr] h-full">
        <HeaderSection title="Turnos" />
        <div className="flex items-center justify-center">
          <p className="text-muted-foreground">Cargando turnos...</p>
        </div>
      </Box>
    );
  }

  return (
    <Box className="grid grid-rows-[auto_1fr] h-full">
      <HeaderSection title="Turnos">
        <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
          <Plus size={20} />
          Nuevo Turno
        </Button>
      </HeaderSection>

      <div className="overflow-y-auto px-6 py-4">
        {!schedules || schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-center mb-4">No hay turnos creados</p>
            <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
              <Plus size={20} />
              Crear Primer Turno
            </Button>
          </div>
        ) : (
          <div className="border border-dark-lighter rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-dark-light">
                <TableRow>
                  <TableHead className="text-white">Nombre</TableHead>
                  <TableHead className="text-white">Hora</TableHead>
                  <TableHead className="text-white">Estado</TableHead>
                  <TableHead className="text-white">Editar</TableHead>
                  <TableHead className="text-white">Eliminar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow key={schedule.schedule_id} className="hover:bg-dark-lighter/50">
                    <TableCell className="font-medium">{schedule.name}</TableCell>
                    <TableCell>{schedule.time.slice(0,5)}</TableCell>
                    <TableCell>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          schedule.active
                            ? 'bg-green-500/20 text-green-500'
                            : 'bg-red-500/20 text-red-500'
                        }`}
                      >
                        {schedule.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(schedule)}
                        className="hover:text-cyan"
                      >
                        <Edit2 size={18} />
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(schedule)}
                        className="hover:text-destructive"
                      >
                        <Trash2 size={18} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Modals */}

      <Suspense fallback={<LoadingState />}>
        <CreateScheduleModal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} />
        <UpdateScheduleModal
          isOpen={updateModalOpen}
          onClose={() => setUpdateModalOpen(false)}
          schedule={selectedSchedule}
        />
        <DeleteScheduleModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          schedule={selectedSchedule}
        />
      </Suspense>
    </Box>
  );
};

export default ShiftsContent;
