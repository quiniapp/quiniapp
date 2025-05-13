import { FlexCol } from '@/components/flex';
import PlayAndHitsSelect from '@/features/plays-and-hits/play-and-hits-select.tsx';
import PlayAndHitsToggleSelect from '@/features/plays-and-hits/play-and-hits-toggle-select.tsx';

const PlayAndHitsBox = () => {
  return (
    <FlexCol className={'gap-8 rounded-md '}>
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
