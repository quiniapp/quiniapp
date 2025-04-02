import { useState } from 'react';
import { Calendar, Filter } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const FilterSection = () => {
  const [date, setDate] = useState('25/3/2025');
  const [group, setGroup] = useState('Todos');
  const [numDataEntry, setNumDataEntry] = useState('');
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const isMobile = useIsMobile();
  return (
    <div className="bg-[var(--primary-bg-content)] text-white px-3 py-6">
      {isMobile && (
        <div className="flex justify-between items-center mb-2">
          <button
            className="flex items-center bg-[#2A3042] px-3 py-1 rounded"
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
          >
            <Filter size={16} className="mr-2" />
            {isFilterExpanded ? 'Ocultar filtros' : 'Mostrar filtros'}
          </button>
        </div>
      )}

      <div
        className={`${isMobile && !isFilterExpanded ? 'hidden' : 'block'} flex flex-col md:flex-row flex-wrap gap-4 items-start md:items-center`}
      >
        <div className="flex items-center">
          <span className="text-sm mr-2 text-muted">A la Fecha:</span>
          <div className="relative flex items-center">
            <input
              type="text"
              className="bg-[#2A3042] border border-gray-700 p-1 pl-7 rounded text-sm w-28"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Calendar size={16} className="absolute left-2 text-gray-400" />
          </div>
        </div>

        <div className="flex items-center">
          <span className="text-sm mr-2 text-muted">Groupo:</span>
          <div className="relative">
            <select
              className="bg-[#2A3042] border border-gray-700 p-1 rounded text-sm w-28"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            >
              <option value="Todos">Todos</option>
              <option value="Group 1">Group 1</option>
              <option value="Group 2">Group 2</option>
            </select>
          </div>
        </div>

        <div className="flex items-center">
          <span className="text-sm mr-2 text-muted">Nro Pasador:</span>
          <input
            type="text"
            className="bg-[#2A3042] border border-gray-700 p-1 rounded text-sm w-28"
            value={numDataEntry}
            onChange={(e) => setNumDataEntry(e.target.value)}
          />
        </div>

        <div className="flex md:ml-auto flex-wrap gap-2 mt-2 md:mt-0">
          <button className="bg-green-500 hover:bg-green-600 text-white text-sm px-3 py-1 rounded">
            Exportar Diario
          </button>
          <button className="bg-green-500 hover:bg-green-600 text-white text-sm px-3 py-1 rounded">
            Exportar liquidaciones
          </button>
          <button className="bg-gray-600 hover:bg-gray-700 text-white text-sm px-6 py-1 rounded">
            Actualizar
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterSection;
