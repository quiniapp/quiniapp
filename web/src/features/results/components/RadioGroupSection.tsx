import { ReactNode } from 'react';

import Box from '@/components/box';
import HeaderTitleSection from '@/components/header-title-section';
import { RadioGroup } from '@/components/ui/radio-group';
import { RadioButtonWithLabel } from '@/components/button/RadioButtonWithLabel';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface RadioItem {
  id: string;
  label: string;
}

interface RadioGroupSectionProps<T extends RadioItem> {
  title: string;
  icon: ReactNode;
  items?: T[];
  onValueChange: (value: string) => void;
  keyboardRefs?: React.RefObject<HTMLButtonElement | null>[];
  getItemLabel?: (item: T, index: number) => string;
  className?: string;
}

export function RadioGroupSection<T extends RadioItem>({
  title,
  icon,
  items = [],
  onValueChange,
  keyboardRefs,
  getItemLabel,
  className = '',
}: RadioGroupSectionProps<T>) {
  const isLargeScreen = useMediaQuery('(min-width: 1440px)');

  return (
    <Box className={`rounded-lg bg-card p-2 min-w-fit w-full ${className} `}>
      <HeaderTitleSection
        title={title}
        icon={icon}
        variant={isLargeScreen ? 'large' : 'small'}
      />
      <RadioGroup onValueChange={onValueChange}>
        <Box className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-2 gap-1 md:gap-2 xl:gap-3">
          {items.map((item, index) => {
            const ref = keyboardRefs?.[index];
            const label = getItemLabel ? getItemLabel(item, index) : item.label;

            return (
              <RadioButtonWithLabel
                key={item.id}
                ref={ref}
                id={item.id}
                value={item.id}
                label={label}
                radioClassName="border border-primary"
                labelClassName="text-xs xl:text-base xl:font-semibold  md:whitespace-nowrap 2xl:whitespace-normal"
              />
            );
          })}
        </Box>
      </RadioGroup>
    </Box>
  );
}
