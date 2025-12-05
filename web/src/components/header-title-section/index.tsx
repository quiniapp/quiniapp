import React from 'react';

import { Flex } from '@/components/flex';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils.ts';

type TextSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl';
type TextWeight = 'light' | 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold';

interface HeaderTitleSectionProps {
  title?: string;
  icon?: React.ReactNode;
  size?: TextSize;
  weight?: TextWeight;
  className?: string;
  iconClassName?: string;
  titleClassName?: string;
}

const HeaderTitleSection = ({
  title,
  icon,
  size = 'sm',
  weight = 'medium',
  className,
  iconClassName = '',
  titleClassName,
}: HeaderTitleSectionProps) => {
  return (
    <Flex className={`${cn(className)} gap-2  items-center mb-1  xl:mb-2`}>
      {icon && <span className={`${iconClassName} text-[--text-secondary]`}>{icon}</span>}
      <Text size={size} weight={weight} className={titleClassName}>
        {title}
      </Text>
    </Flex>
  );
};

export default HeaderTitleSection;
