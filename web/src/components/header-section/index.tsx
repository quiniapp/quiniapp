import { Combine } from 'lucide-react';
import type { ReactNode } from 'react';

import { Flex } from '@/components/flex';
import { useMediaQuery } from '@/hooks/useMediaQuery.ts';
import { cn } from '@/lib/utils.ts';

interface HeaderSectionProps {
  title?: string;
  children?: ReactNode;
  className?: string;
}

const HeaderSection = ({ title, children, className }: HeaderSectionProps) => {
  const isLarge = useMediaQuery('(min-width: 1440px)');
  return (
    <Flex
      className={`${cn(className)} items-center lg:flex-row justify-between border-b p-1 2xl:p-2 bg-background z-10`}
    >
      <Flex className={'flex items-center gap-2 sm:gap-4'}>
        <span className="hidden sm:inline">
          <Combine
            className={'text-[--text-secondary]'}
            size={isLarge ? '24px' : '16px'}
          />
        </span>
        <p className={'1440:text-2xl text-sm sm:text-base font-medium text-nowrap'}>{title}</p>
      </Flex>
      {children}
    </Flex>
  );
};

export default HeaderSection;
