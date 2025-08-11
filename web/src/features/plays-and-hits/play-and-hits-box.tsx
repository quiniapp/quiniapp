import { FlexCol } from '@/components/flex';
import PlayAndHitsSelect from '@/features/plays-and-hits/play-and-hits-select.tsx';
import PlayAndHitsToggleSelect from '@/features/plays-and-hits/play-and-hits-toggle-select.tsx';

const PlayAndHitsBox = () => {
  return (
    <FlexCol className={'gap-2 rounded-md '}>
      <PlayAndHitsToggleSelect />
      <PlayAndHitsSelect />
    </FlexCol>
  );
};

export default PlayAndHitsBox;
