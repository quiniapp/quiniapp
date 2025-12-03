import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Flex } from '@/components/flex';
import CheckboxSection from '@/features/make-plays/components/CheckboxSection';
import { TicketIcon } from 'lucide-react';
import { useLotteries } from '@/hooks/fetchs/lottery/useLotteries';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import Box from '@/components/box';

import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandList, CommandGroup, CommandItem } from '@/components/ui/command';
import { Button } from '@/components/ui/button';

import { Checkbox } from '@/components/ui/checkbox';
import { CheckboxWithLabel } from '@/components/button/CheckboxWithLabel';

interface ILotteriesCheckboxListProps {
  setLotteries: (lottery: ILotteryEntityFront) => void; // toggle
  checkedLotteries: Map<string, ILotteryEntityFront>;
}

const LotteriesCheckboxList = ({ setLotteries, checkedLotteries }: ILotteriesCheckboxListProps) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [triggerW, setTriggerW] = useState(0);
  useLayoutEffect(() => {
    const update = () => setTriggerW(triggerRef.current?.offsetWidth ?? 0);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  const { data: lotteries = [] } = useLotteries();
  const [open, setOpen] = useState(false);

  const selectedCount = checkedLotteries.size;
  const selectedLabel = useMemo(() => {
    if (selectedCount === 0) return 'Seleccionar loterías';
    if (selectedCount === 1) return `${Array.from(checkedLotteries.values())[0].name}`;
    return `${selectedCount} seleccionadas`;
  }, [selectedCount, checkedLotteries]);

  const toggle = (lot: ILotteryEntityFront) => {
    setLotteries(lot); // tu setter ya togglea
    // NO cerramos el popover, para seleccionar varias
  };

  const clearAll = () => {
    // deseleccionar todas las ya marcadas togglenado cada una
    Array.from(checkedLotteries.values()).forEach(setLotteries);
  };

  return (
    <CheckboxSection title="Quiniela" icon={<TicketIcon size="16px" />}>
      {/* Desktop / Tablet: grilla */}
      <Box className="hidden sm:grid grid-flow-col grid-rows-3 gap-x-6 gap-y-2 w-fit">
        {lotteries.map((lot) => (
          <CheckboxWithLabel
            key={lot.lottery_id}
            id={lot.lottery_id}
            label={lot.name}
            checked={checkedLotteries.has(lot.lottery_id)}
            onClick={() => setLotteries(lot)}
            labelClassName="min-w-[90px]"
          />
        ))}
      </Box>

      {/* Mobile: Popover + Command (multi-select sin autocerrar) */}
      <div className="sm:hidden">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              ref={triggerRef}
              type="button"
              variant="outline"
              className="w-full justify-between h-8 px-2 text-sm sm:text-base"
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
              <CommandList className="max-h-56">
                <CommandGroup heading="Loterías">
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
                          {/* ✅ check cuadrado */}
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
                  onClick={() => {
                    // limpiar: togglear todas las seleccionadas
                    clearAll();
                  }}
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
      </div>
    </CheckboxSection>
  );
};

export default LotteriesCheckboxList;
