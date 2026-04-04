import { TicketIcon } from 'lucide-react';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import Box from '@/components/box';
import CheckboxSection from '@/features/make-plays/components/CheckboxSection';
import { CheckboxWithLabel } from '@/components/button/CheckboxWithLabel';
import { Checkbox } from '@/components/ui/checkbox';
import { Text } from '@/components/atoms/Text';
import { useMemo } from 'react';

interface ILotteriesCheckboxListDesktopProps {
  lotteries: ILotteryEntityFront[];
  setLotteries: (lottery: ILotteryEntityFront) => void;
  checkedLotteries: Map<string, ILotteryEntityFront>;
}

const LotteriesCheckboxListDesktop = ({
  lotteries,
  setLotteries,
  checkedLotteries,
}: ILotteriesCheckboxListDesktopProps) => {
  // Verificar si todas las loterías disponibles están seleccionadas
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

  const selectAllCheckbox = lotteries.length > 0 && (
    <div className="flex items-center gap-2">
      <Checkbox
        checked={allSelected}
        onCheckedChange={handleSelectAll}
        className="h-4 w-4 rounded-[4px] border-2 border-primary"
      />
      <Text size="sm" className="text-white font-semibold">
        Todos
      </Text>
    </div>
  );

  return (
    <CheckboxSection
      title="Quiniela"
      icon={<TicketIcon size="16px" />}
      headerAction={selectAllCheckbox}
    >
      {lotteries.length > 0 ? (
        <Box className="grid grid-flow-col grid-rows-3 gap-x-6 gap-y-2 w-fit">
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
      ) : (
        <div className="min-h-[68px] flex items-center">
          <Text size="sm" className="text-muted-foreground">
            Seleccioná un turno para ver las loterías
          </Text>
        </div>
      )}
    </CheckboxSection>
  );
};

export default LotteriesCheckboxListDesktop;
