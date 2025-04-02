import SETTLEMENTS_DATA from '@/constants/SettlementPayrollTableMenuContent';
import { ChevronRight } from 'lucide-react';

const SettlementPayrollTable = () => {
  return (
    <div className="overflow-auto  bg-[var(--primary-bg-content)] text-white">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-[#2A3042] text-white">
            <th className="px-2 py-[20px] text-left">Liquidar</th>
            <th className="px-2 py-1 text-left">Numero</th>
            <th className="px-2 py-1 text-left">Nombre</th>
            <th className="px-2 py-1 text-right">Pase</th>
            <th className="px-2 py-1 text-right">Aciertos</th>
            <th className="px-2 py-1 text-right">Reclamos</th>
            <th className="px-2 py-1 text-right">Subtotal</th>
            <th className="px-2 py-1 text-right">Saldo Anterior</th>
            <th className="px-2 py-1 text-right">Cobros</th>
            <th className="px-2 py-1 text-right">Pagos</th>
            <th className="px-2 py-1 text-right">Total</th>
            <th className="px-2 py-1 text-right">Arrastre</th>
            <th className="px-2 py-1 text-right">Debe</th>
            <th className="px-2 py-1 text-left">Grupo</th>
          </tr>
        </thead>
        <tbody>
          {SETTLEMENTS_DATA.map((row, index) => (
            <tr
              key={row.id}
              className={`${index % 2 === 0 ? 'bg-[var(--primary-bg-content)]' : 'bg-[var(--primary-bg-content-light)]'} p-3`}
            >
              <td className="px-2 py-[20px] border-b border-gray-700">
                <div className="flex items-center">
                  <ChevronRight size={16} className="mr-1" />
                  <span className="text-muted">Liquidar</span>
                </div>
              </td>
              <td className="px-2 py-1 text-muted border-b border-gray-700">{row.numero}</td>
              <td className="px-2 py-1 text-muted border-b border-gray-700">{row.nombre}</td>
              <td className="px-2 py-1 text-muted border-b border-gray-700 text-right">
                {row.pase}
              </td>
              <td className="px-2 py-1 text-muted border-b border-gray-700 text-right">
                {row.aciertos}
              </td>
              <td className="px-2 py-1 text-muted border-b border-gray-700 text-right">
                {row.reclamos}
              </td>
              <td className="px-2 py-1 text-muted border-b border-gray-700 text-right">
                {row.subtotal}
              </td>
              <td className="px-2 py-1 text-muted border-b border-gray-700 text-right">
                {row.saldoAnterior}
              </td>
              <td className="px-2 py-1 text-muted border-b border-gray-700 text-right">
                {row.cobros}
              </td>
              <td className="px-2 py-1 text-muted border-b border-gray-700 text-right">
                {row.pagos}
              </td>
              <td className="px-2 py-1 text-muted border-b border-gray-700 text-right">
                {row.total}
              </td>
              <td className="px-2 py-1 text-muted border-b border-gray-700 text-right">
                {row.arrastre}
              </td>
              <td className="px-2 py-1 text-muted border-b border-gray-700 text-right">
                {row.debe}
              </td>
              <td className="px-2 py-1 text-muted border-b border-gray-700">{row.grupo}</td>
            </tr>
          ))}
          <tr className="bg-blue-900 font-semibold ">
            <td className="px-2 py-[14px]  border-b border-gray-700" colSpan={2}>
              Total
            </td>
            <td className="px-2 py-[14px]  border-b border-gray-700"></td>
            <td className="px-2 py-[14px]  border-b border-gray-700 text-right">$1,568</td>
            <td className="px-2 py-[14px]  border-b border-gray-700 text-right">$684.9</td>
            <td className="px-2 py-[14px]  border-b border-gray-700 text-right">$213.0</td>
            <td className="px-2 py-[14px]  border-b border-gray-700 text-right">$354.7</td>
            <td className="px-2 py-[14px]  border-b border-gray-700 text-right">$358.6</td>
            <td className="px-2 py-[14px]  border-b border-gray-700 text-right">$130.0</td>
            <td className="px-2 py-[14px]  border-b border-gray-700 text-right">$240.0</td>
            <td className="px-2 py-[14px]  border-b border-gray-700 text-right">$823.3</td>
            <td className="px-2 py-[14px]  border-b border-gray-700 text-right">$6,042</td>
            <td className="px-2 py-[14px]  border-b border-gray-700 text-right">$0.00</td>
            <td className="px-2 py-[14px]  border-b border-gray-700"></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default SettlementPayrollTable;
