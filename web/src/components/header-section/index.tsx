import type { ReactNode } from 'react';
import Flex from '@/components/flex';
import { cn } from '@/lib/utils.ts';

interface HeaderSectionProps {
  title?: string;
  children: ReactNode;
}

const HeaderSection = ({ title, children }: HeaderSectionProps) => {
  return (
    <Flex className={`${cn()}   items-center justify-between py-[16px] border-b`}>
      <Flex>
        <p>{title}</p>
      </Flex>
      <Flex>{children}</Flex>
    </Flex>
  );
};

export default HeaderSection;
