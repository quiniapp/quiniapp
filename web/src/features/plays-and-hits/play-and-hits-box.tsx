import { FlexCol } from '@/components/flex';

import PlayAndHitsToggleSelect from '@/features/plays-and-hits/play-and-hits-toggle-select.tsx';
import PlayAndHitsSelect from '@/features/plays-and-hits/play-and-hits-select.tsx';

const PlayAndHitsBox = () => {
  return (
    <FlexCol className={'border gap-8  p-4 rounded-md '}>
      <PlayAndHitsToggleSelect
        filters={{
          view: 'jugadas',
          mode: 'individual',
        }}
      />
      <PlayAndHitsSelect />
    </FlexCol>
  );
};

export default PlayAndHitsBox;
