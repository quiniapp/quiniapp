import { AlertCircle, Calendar, Clock, SaveIcon, Ticket } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';

import Box from '@/components/box';
import { Flex } from '@/components/flex';
import HeaderSection from '@/components/header-section';
import HeaderTitleSection from '@/components/header-title-section';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/ui/button.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.tsx';

import { useAuth } from '@/contexts/AuthContext';
import { USER_TYPE } from '@helper/types/user.type';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { LotteryCheckboxList } from '@/features/upcoming-lotteries/lottery-checkbox-list';
import { ScheduleRadioList } from '@/features/upcoming-lotteries/schedules-list.tsx';
import { DayRadioList } from '@/features/upcoming-lotteries/day-radio-list.tsx';
import { useSaveScheduleLottery } from '@/hooks/mutations/schedule-lottery/useSaveScheduleLottery';
import { useScheduleLottery } from '@/hooks/fetchs/schedule-lottery/useScheduleLottery';
import { DayKey } from '@helper/types/schedule-lottery.type';

type DayMap = Partial<Record<DayKey, Record<string, string[]>>>;

// Helper function to detect changes between two DayMap objects
const detectChanges = (current: DayMap, server: DayMap): DayMap => {
  const changes: DayMap = {};

  // Check all days in current state
  for (const day of Object.keys(current) as DayKey[]) {
    const currentDaySchedules = current[day] || {};
    const serverDaySchedules = server[day] || {};

    for (const scheduleId of Object.keys(currentDaySchedules)) {
      const currentLotteries = currentDaySchedules[scheduleId] || [];
      const serverLotteries = serverDaySchedules[scheduleId] || [];

      // Check if arrays are different (different length or different items)
      const isDifferent =
        currentLotteries.length !== serverLotteries.length ||
        currentLotteries.some((id) => !serverLotteries.includes(id)) ||
        serverLotteries.some((id) => !currentLotteries.includes(id));

      if (isDifferent) {
        if (!changes[day]) changes[day] = {};
        changes[day]![scheduleId] = currentLotteries;
      }
    }

    // Check for deleted schedules (in server but not in current)
    for (const scheduleId of Object.keys(serverDaySchedules)) {
      if (!currentDaySchedules[scheduleId]) {
        if (!changes[day]) changes[day] = {};
        changes[day]![scheduleId] = [];
      }
    }
  }

  // Check for deleted days (in server but not in current)
  for (const day of Object.keys(server) as DayKey[]) {
    if (!current[day]) {
      changes[day] = {};
      const serverDaySchedules = server[day] || {};
      for (const scheduleId of Object.keys(serverDaySchedules)) {
        changes[day]![scheduleId] = [];
      }
    }
  }

  return changes;
};

// Helper to check if there are unsaved changes
const hasUnsavedChanges = (current: DayMap, server: DayMap): boolean => {
  return Object.keys(detectChanges(current, server)).length > 0;
};

const UpcomingLotteriesContent = () => {
  const { role } = useAuth();
  const canEdit = role !== USER_TYPE.ADMIN;
  const is1440 = useMediaQuery('(min-width: 1440px)');

  const [savedData, setSavedData] = useState<DayMap>({});
  const [serverData, setServerData] = useState<DayMap>({});
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  const { mutate: saveScheduleLottery, isPending: isPendingSave } = useSaveScheduleLottery(undefined, {
    onSuccess: (freshData) => {
      // Sync local state with server response
      setSavedData(freshData);
      setServerData(freshData);
    },
  });
  
  const { data: scheduleLottery } = useScheduleLottery();

  const [selectedDay, setSelectedDay] = useState<DayKey | ''>('');
  const [selectedSchedule, setSelectedSchedule] = useState<string>('');

  // Calculate if there are unsaved changes
  const hasChanges = hasUnsavedChanges(savedData, serverData);

  // Block navigation if there are unsaved changes
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasChanges && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state === 'blocked') {
      setShowUnsavedDialog(true);
    }
  }, [blocker.state]);

  // Toggle SIEMPRE (agrega si no está; quita si está)
  const handleLotteries = (id: string) => {
    if (!selectedDay || !selectedSchedule) return;

    setSavedData((prev) => {
      const dayMap = prev[selectedDay] ?? {};
      const current = dayMap[selectedSchedule] ?? [];
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];

      return {
        ...prev,
        [selectedDay]: {
          ...dayMap,
          [selectedSchedule]: next,
        },
      };
    });
  };

  const handleSave = () => {
    // Always send full configuration
    // The backend RPC expects complete configuration and deletes/inserts atomically
    saveScheduleLottery(savedData);
  };

  const handleSchedule = useCallback(
    (id: string) => {
      setSelectedSchedule(id);
    },
    [selectedDay]
  );

  const handleDay = (day: DayKey) => {
    setSelectedDay(day);
    setSelectedSchedule('');
  };

  const handleDiscardChanges = () => {
    setSavedData(serverData);
    setShowUnsavedDialog(false);
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  };

  const handleSaveAndContinue = () => {
    handleSave();
    setShowUnsavedDialog(false);
    if (blocker.state === 'blocked') {
      blocker.proceed?.();
    }
  };

  const handleCancelNavigation = () => {
    setShowUnsavedDialog(false);
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  };

  useEffect(() => {
    if (scheduleLottery) {
      setSavedData(scheduleLottery);
      setServerData(scheduleLottery);
    }
  }, [scheduleLottery]);
  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full '}>
      <div className="w-full sticky top-0">
        <HeaderSection title={'Quinielas a jugarse'} />
      </div>

      <Flex>
        <div className=" rounded-xl w-full overflow-hidden py-[16px] space-y-6">
          <div className="rounded-xl p-4 space-y-4">
            <div className="bg-dark-light rounded-xl space-y-6">
              <div className="space-y-6">
                <div className="border bg-card rounded-lg px-3 py-3 sm:px-4 sm:py-4 1440:py-8">
                  <HeaderTitleSection
                    title={'Día'}
                    icon={<Calendar size={is1440 ? '24px' : '16px'} />}
                    size={is1440 ? 'lg' : 'sm'}
                    className={'!mb-[36px]'}
                    />

                  <DayRadioList selectedDay={selectedDay} handleDay={handleDay} />
                </div>

                <div className="border bg-card rounded-lg px-3 py-3 sm:px-4 sm:py-4 1440:py-8">
                  <HeaderTitleSection
                    title={'Turno Seleccionado'}
                    icon={<Clock size={is1440 ? '24px' : '16px'} />}
                    size={is1440 ? 'lg' : 'sm'}
                    className={'!mb-[36px]'}
                    />

                  <ScheduleRadioList
                    selectedSchedule={selectedSchedule}
                    handleSchedule={handleSchedule}
                    />
                </div>

                <div className="border bg-card rounded-lg px-3 py-3 sm:px-4 sm:py-4 1440:py-8">
                  <HeaderTitleSection
                    title={'Quinielas'}
                    icon={<Ticket size={is1440 ? '24px' : '16px'} />}
                    size={is1440 ? 'lg' : 'sm'}
                    className={'!mb-[36px]'}
                    />

                  <LotteryCheckboxList
                    selectedDay={selectedDay}
                    selectedSchedule={selectedSchedule}
                    lotteries={
                      selectedDay && selectedSchedule
                      ? (savedData?.[selectedDay]?.[selectedSchedule] ?? [])
                      : []
                    }
                    onChange={canEdit ? handleLotteries : () => {}}
                    />
                </div>
                {canEdit && (
                  <Flex>
                    <Button
                      type="submit"
                      variant={'default'}
                      className="w-full sm:w-[200px] hover:bg-dark text-white"
                      onClick={handleSave}
                      disabled={isPendingSave}
                      >
                      <SaveIcon />
                      {isPendingSave ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </Flex>
                )}
                    {hasChanges && (
                      <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                          <Text className="text-sm text-yellow-500 font-medium">
                            Tienes cambios sin guardar
                          </Text>
                          <Badge variant="outline" className="ml-auto border-yellow-500/50 text-yellow-500">
                            {Object.keys(detectChanges(savedData, serverData)).length}{' '}
                            {Object.keys(detectChanges(savedData, serverData)).length === 1 ? 'día' : 'días'}{' '}
                            modificado{Object.keys(detectChanges(savedData, serverData)).length === 1 ? '' : 's'}
                          </Badge>
                        </div>
                      </div>
                    )}
              </div>
            </div>
          </div>
        </div>
      </Flex>

      {/* Unsaved Changes Dialog */}
      <Dialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambios sin guardar</DialogTitle>
            <DialogDescription>
              Tienes cambios sin guardar. ¿Qué deseas hacer?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={handleCancelNavigation}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDiscardChanges}>
              Descartar cambios
            </Button>
            <Button variant="default" onClick={handleSaveAndContinue}>
              Guardar y continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default UpcomingLotteriesContent;
