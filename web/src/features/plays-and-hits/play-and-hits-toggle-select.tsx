import { useState } from 'react';
import { Flex, FlexCol } from '@/components/flex';
import { TypographyMuted } from '@/components/ui/typography-muted';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface PlayAndHitsToggleSelectOptions {
  filters: {
    view: 'jugadas' | 'aciertos';
    mode: 'individual' | 'agrupados';
  };
}

const PlayAndHitsToggleSelect = ({ filters }: PlayAndHitsToggleSelectOptions) => {
  const [viewMode, setViewMode] = useState(filters.view);
  const [groupMode, setGroupMode] = useState(filters.mode);

  return (
    <Flex className={'space-x-5'}>

      <FlexCol className={'flex-1 border bg-[var(--bg-card)] rounded-sm p-4 gap-3'}>
        <TypographyMuted label={'Ver'} />
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => {
            if (value) setViewMode(value as 'jugadas' | 'aciertos');
          }}
          className="p-1 rounded-md gap-2"
        >
          <ToggleGroupItem
            value="jugadas"
            className="data-[state=on]:bg-primary rounded-sm hover:cursor-pointer data-[state=on]:shadow-sm"
          >
            Jugadas
          </ToggleGroupItem>
          <ToggleGroupItem
            value="aciertos"
            className="data-[state=on]:bg-primary rounded-sm hover:cursor-pointer data-[state=on]:shadow-sm"
          >
            Aciertos
          </ToggleGroupItem>
        </ToggleGroup>
      </FlexCol>


      <FlexCol className={'flex-1 border bg-[var(--bg-card)] rounded-sm p-4 gap-3'}>
        <TypographyMuted label={'Agrupado'} />
        <ToggleGroup
          type="single"
          value={groupMode}
          onValueChange={(value) => {
            if (value) setGroupMode(value as 'individual' | 'agrupados');
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
            value="agrupados"
            className="data-[state=on]:bg-primary rounded-sm hover:cursor-pointer data-[state=on]:shadow-sm"
          >
            Agrupados
          </ToggleGroupItem>
        </ToggleGroup>
      </FlexCol>
    </Flex>
  );
};

export default PlayAndHitsToggleSelect;