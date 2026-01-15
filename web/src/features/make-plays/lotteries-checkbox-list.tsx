import { ILotteryEntityFront } from '@helper/types/lottery.type';
import LotteriesCheckboxListDesktop from './lotteries-checkbox-list-desktop';
import LotteriesCheckboxListMobile from './lotteries-checkbox-list-mobile';

// TODO: Agregar botón para seleccionar/deseleccionar todas las loterías
// - Ubicación: Arriba de la lista de checkboxes
// - Funcionalidad: Toggle para marcar/desmarcar todas las loterías disponibles
// - UI: Botón con texto "Seleccionar todas" / "Deseleccionar todas"

interface ILotteriesCheckboxListProps {
  lotteries: ILotteryEntityFront[];
  setLotteries: (lottery: ILotteryEntityFront) => void;
  checkedLotteries: Map<string, ILotteryEntityFront>;
}

const LotteriesCheckboxList = ({
  lotteries,
  setLotteries,
  checkedLotteries,
}: ILotteriesCheckboxListProps) => {
  return (
    <>
      {/* Desktop / Tablet: con CheckboxSection */}
      <div className="hidden sm:block">
        <LotteriesCheckboxListDesktop
          lotteries={lotteries}
          setLotteries={setLotteries}
          checkedLotteries={checkedLotteries}
        />
      </div>

      {/* Mobile: sin CheckboxSection para ahorrar espacio */}
      <div className="sm:hidden">
        <LotteriesCheckboxListMobile
          lotteries={lotteries}
          setLotteries={setLotteries}
          checkedLotteries={checkedLotteries}
        />
      </div>
    </>
  );
};

export default LotteriesCheckboxList;
