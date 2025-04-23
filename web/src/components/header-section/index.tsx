import type { ReactNode } from 'react';
import { Flex } from '@/components/flex';
import { cn } from '@/lib/utils.ts';
import { Layout } from 'lucide-react';

interface HeaderSectionProps {
  title?: string;
  children?: ReactNode;
  className?: string;
}

const HeaderSection = ({ title, children, className }: HeaderSectionProps) => {
  return (
    <Flex
      className={`${cn(className)} items-center justify-between py-[16px] border-b min-h-[90px]`}
    >
      <Flex className={' items-center gap-4'}>
        <span>
          <Layout className={'text-neutral-700'} />
        </span>
        <p className={'text-lg font-medium '}>{title}</p>
      </Flex>
      <Flex className={''}>{children}</Flex>
    </Flex>
  );
};

export default HeaderSection;
