import type { ReactNode } from 'react';
import { Flex } from '@/components/flex';
import { cn } from '@/lib/utils.ts';
import { Combine } from 'lucide-react';

interface HeaderSectionProps {
  title?: string;
  children?: ReactNode;
  className?: string;
}

const HeaderSection = ({ title, children, className }: HeaderSectionProps) => {
  return (
    <Flex
      className={`${cn(className)} items-center lg:flex-row flex-col justify-between  border-b min-h-[70px] 1440:min-h-[90px]`}
    >
      <Flex className={' items-center gap-4'}>
        <span>
          <Combine className={'text-[--text-secondary]'} />
        </span>
        <p className={'text-2xl font-medium '}>{title}</p>
      </Flex>
      <Flex className={''}>{children}</Flex>
    </Flex>
  );
};

export default HeaderSection;
