import { Filter } from 'lucide-react';
import Box from '@/components/box';
import { Flex } from '@/components/flex';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SelectDayToSearch } from '@/features/plays-and-hits/select-day-to-search';
import { useIsMobile } from '@/hooks/use-mobile';
import { useState } from 'react';

interface FilterSectionProps {
  date?: string;
  onDateChange: (date?: string) => void;
  group: string;
  onGroupChange: (group: string) => void;
  employeeNumber: string;
  onEmployeeNumberChange: (num: string) => void;
}

const FilterSection = ({
  date,
  onDateChange,
  group,
  onGroupChange,
  employeeNumber,
  onEmployeeNumberChange,
}: FilterSectionProps) => {
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const isMobile = useIsMobile();

  return (
    <Box className="bg-[var(--primary-bg-content)] text-white px-3 py-6">
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

      <Box
        className={`${
          isMobile && !isFilterExpanded ? 'hidden' : 'flex'
        } flex-col md:flex-row flex-wrap gap-[36px] items-start md:items-center`}
      >
        <div className="flex items-center">
          <Label className="text-sm mr-2 text-muted-foreground">A la Fecha:</Label>
          <SelectDayToSearch selectedDay={date} onDayChange={onDateChange} />
        </div>

        <Flex className="flex items-center">
          <Label className="text-sm mr-2 text-muted-foreground">Grupo:</Label>
          <Box>
            <Select value={group} onValueChange={onGroupChange}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar Grupo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                <SelectItem value="Group 1">Group 1</SelectItem>
                <SelectItem value="Group 2">Group 2</SelectItem>
              </SelectContent>
            </Select>
          </Box>
        </Flex>

        <Flex className="items-center">
          <Label htmlFor="employee_number" className="text-sm mr-2 text-muted-foreground">
            Nro Pasador:
          </Label>
          <Input
            id="employee_number"
            type="text"
            className="border bg-card-bg rounded text-sm w-28"
            value={employeeNumber}
            onChange={(e) => onEmployeeNumberChange(e.target.value)}
          />
        </Flex>
      </Box>
    </Box>
  );
};

export default FilterSection;
