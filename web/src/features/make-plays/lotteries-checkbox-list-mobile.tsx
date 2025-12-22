import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Flex } from '@/components/flex';
import { useLotteries } from '@/hooks/fetchs/lottery/useLotteries';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandList, CommandGroup, CommandItem } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

interface ILotteriesCheckboxListMobileProps {
  setLotteries: (lottery: ILotteryEntityFront) => void;
  checkedLotteries: Map<string, ILotteryEntityFront>;
}

const LotteriesCheckboxListMobile = ({
  setLotteries,
  checkedLotteries,
}: ILotteriesCheckboxListMobileProps) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [triggerW, setTriggerW] = useState(0);
  const { data: lotteries = [] } = useLotteries();
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
