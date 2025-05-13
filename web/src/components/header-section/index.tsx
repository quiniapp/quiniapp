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
  return (
    <Flex
      className={`${cn(className)} items-center lg:flex-row flex-col justify-between  border-b min-h-[50px] 1440:min-h-[90px]`}
    >
      <Flex className={' items-center gap-4'}>
        <span>
          <Combine
            className={'text-[--text-secondary]'}
            size={useMediaQuery('(min-width: 1440px)') ? '24px' : '16px'}
          />
        </span>
        <p className={'1440:text-2xl text-md font-medium '}>{title}</p>
      </Flex>
      <Flex className={''}>{children}</Flex>
    </Flex>
  );
};

export default HeaderSection;
