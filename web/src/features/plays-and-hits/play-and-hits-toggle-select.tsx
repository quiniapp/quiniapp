import { EyeIcon, UsersIcon } from 'lucide-react';

import { Flex } from '@/components/flex';
import HeaderTitleSection from '@/components/header-title-section';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useMediaQuery } from '@/hooks/useMediaQuery.ts';
import { useSearchParams } from 'react-router-dom';

const PlayAndHitsToggleSelect = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Convertimos el string de la URL a booleano
  const grouped = searchParams.get('grouped') === 'true';
  const winners = searchParams.get('winners') === 'true';

  const handleChangeWinners = () => {
    // Creamos una copia de los params actuales
    const newParams = new URLSearchParams(searchParams);
    // Alternamos entre 'true' y 'false'
    newParams.set('winners', (!winners).toString());
    // Aplicamos la copia al hook
    setSearchParams(newParams);
  };

  const handleChangeGrouped = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('grouped', (!grouped).toString());
    setSearchParams(newParams);
  };
  return (
    <Flex className={'flex-col sm:flex sm:space-x-5'}>
      <Flex className={'flex-1 border bg-card rounded-sm p1 sm:p-3 gap-3'}>
        <HeaderTitleSection
          title={'Ver'}
          icon={<EyeIcon size={useMediaQuery('(min-width: 1440px)') ? '24px' : '16px'} />}
          variant={useMediaQuery('(min-width: 1440px)') ? 'large' : 'small'}
          className={'!mb-[8px]'}
        />

        <ToggleGroup
          type="single"
          value={winners ? 'hits' : 'plays'}
          onClick={(value) => {
            if (value) handleChangeWinners();
          }}
          className="p-1 rounded-md gap-2"
        >
          <ToggleGroupItem
            value="plays"
            className="data-[state=on]:bg-primary rounded-sm hover:cursor-pointer data-[state=on]:shadow-sm"
          >
            Jugadas
          </ToggleGroupItem>
          <ToggleGroupItem
            value="hits"
            className="data-[state=on]:bg-primary rounded-sm hover:cursor-pointer data-[state=on]:shadow-sm"
          >
            Aciertos
          </ToggleGroupItem>
        </ToggleGroup>
      </Flex>

      <Flex className={'flex-1 border bg-card rounded-sm p1 sm:p-3  gap-3'}>
        <HeaderTitleSection
          title={'Agrupado'}
          icon={<UsersIcon size="16px" />}
          variant={'small'}
          className={'!mb-[8px]'}
        />
        <ToggleGroup
          type="single"
          value={grouped ? 'grouped' : 'individual'}
          onClick={(value) => {
            if (value) handleChangeGrouped();
          }}
          className="p-1 rounded-md gap-2"
        >
          <ToggleGroupItem
            value="individual"
            className="data-[state=on]:bg-primary rounded-sm hover:cursor-pointer data-[state=on]:shadow-sm"
          >
            Individual
          </ToggleGroupItem>
          <ToggleGroupItem
            value="grouped"
            className="data-[state=on]:bg-primary rounded-sm hover:cursor-pointer data-[state=on]:shadow-sm"
          >
            Agrupados
          </ToggleGroupItem>
        </ToggleGroup>
      </Flex>
    </Flex>
  );
};

export default PlayAndHitsToggleSelect;
