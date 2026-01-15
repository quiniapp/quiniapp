import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Flex } from '@/components/flex';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandList, CommandGroup, CommandItem } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

interface ILotteriesCheckboxListMobileProps {
  lotteries: ILotteryEntityFront[];
  setLotteries: (lottery: ILotteryEntityFront) => void;
  checkedLotteries: Map<string, ILotteryEntityFront>;
}

const LotteriesCheckboxListMobile = ({
  lotteries,
  setLotteries,
  checkedLotteries,
}: ILotteriesCheckboxListMobileProps) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [triggerW, setTriggerW] = useState(0);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const update = () => setTriggerW(triggerRef.current?.offsetWidth ?? 0);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const selectedCount = checkedLotteries.size;
  const selectedLabel = useMemo(() => {
    if (selectedCount === 0) return 'Seleccionar loterías';
    if (selectedCount === 1) return `${Array.from(checkedLotteries.values())[0].name}`;
    return `${selectedCount} seleccionadas`;
  }, [selectedCount, checkedLotteries]);

  const toggle = (lot: ILotteryEntityFront) => {
    setLotteries(lot);
  };

  const clearAll = () => {
    Array.from(checkedLotteries.values()).forEach(setLotteries);
  };

  // Verificar si todas las loterías están seleccionadas
  const allSelected = useMemo(() => {
    if (lotteries.length === 0) return false;
    return lotteries.every((lot) => checkedLotteries.has(lot.lottery_id));
  }, [lotteries, checkedLotteries]);

  // Función para seleccionar/deseleccionar todas las loterías
  const handleSelectAll = () => {
    if (allSelected) {
      // Deseleccionar todas
      lotteries.forEach((lot) => {
        if (checkedLotteries.has(lot.lottery_id)) {
          setLotteries(lot);
        }
      });
    } else {
      // Seleccionar todas
      lotteries.forEach((lot) => {
        if (!checkedLotteries.has(lot.lottery_id)) {
          setLotteries(lot);
        }
      });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          className="w-full justify-between h-8 px-2 text-sm"
        >
          {selectedLabel}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="p-0"
        style={{ width: triggerW || undefined, maxWidth: '92vw' }}
      >
        <Command>
          <CommandList className="max-h-80">
            <CommandGroup heading="Loterías">
              {/* Checkbox "Seleccionar todos" como primer elemento */}
              {lotteries.length > 0 && (
                <CommandItem
                  onSelect={handleSelectAll}
                  className="text-base font-medium border-b"
                >
                  <Flex className="items-center gap-2">
                    <Checkbox
                      checked={allSelected}
                      className="h-4 w-4 rounded-[4px] pointer-events-none"
                    />
                    <span className="text-base">Seleccionar todos</span>
                  </Flex>
                </CommandItem>
              )}
              {lotteries.map((lot) => {
                const checked = checkedLotteries.has(lot.lottery_id);
                return (
                  <CommandItem
                    key={lot.lottery_id}
                    value={lot.name}
                    onSelect={() => toggle(lot)}
                    className="text-base"
                  >
                    <Flex className="items-center gap-2">
                      <Checkbox
                        checked={checked}
                        className="h-4 w-4 rounded-[4px] pointer-events-none"
                      />
                      <span className="text-base">{lot.name}</span>
                    </Flex>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>

          <div className="flex items-center justify-between gap-2 px-2 py-2 border-t">
            <Button
              type="button"
              variant="ghost"
              className="h-8 px-2 text-base"
              onClick={clearAll}
              disabled={checkedLotteries.size === 0}
            >
              Limpiar
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-8 px-2 text-base"
              onClick={() => setOpen(false)}
            >
              Listo
            </Button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default LotteriesCheckboxListMobile;
