import { FlexCol } from '@/components/flex';
import PlayAndHitsSelect from '@/features/plays-and-hits/play-and-hits-select.tsx';
import PlayAndHitsToggleSelect from '@/features/plays-and-hits/play-and-hits-toggle-select.tsx';
import SelectBetType from './select-bet-type';

const PlayAndHitsBox = () => {
  return (
    <FlexCol className={'gap-2 rounded-md '}>
      <PlayAndHitsToggleSelect />
      <PlayAndHitsSelect />
      <SelectBetType />
    </FlexCol>
  );
};

export default PlayAndHitsBox;
