import React from 'react';

import { Flex } from '@/components/flex';
import { Typography } from '@/components/typography';
import { TypographyVariant } from '@/types/typography.type.ts';
import { cn } from '@/lib/utils.ts';

interface HeaderTitleSectionProps {
  title?: string;
  icon?: React.ReactNode;
  variant?: TypographyVariant ;
  className?: string;
  iconClassName?: string;
  titleClassName?: string;
}

const HeaderTitleSection = ({
  title,
  icon,
                              variant,
  className,
  iconClassName,
  titleClassName,
}: HeaderTitleSectionProps) => {
  return (
    <Flex className={`${cn(className)} gap-2  items-center mb-4`}>
      {icon && <span className={iconClassName}>{icon}</span>}
      <Typography variant={variant || 'small'} className={titleClassName}>
        {title}
      </Typography>
    </Flex>
  );
};

export default HeaderTitleSection;
