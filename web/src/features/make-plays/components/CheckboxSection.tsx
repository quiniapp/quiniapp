import { ReactNode } from 'react';
import { FlexCol } from '@/components/flex';
import HeaderTitleSection from '@/components/header-title-section';

interface CheckboxSectionProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}

const CheckboxSection = ({ title, icon, children, className = '' }: CheckboxSectionProps) => {
  return (
    <FlexCol className={`border-2 p-2 sm:p-4 lg:p-1.5 rounded-[--rounded-form] gap-2 lg:gap-1 ${className}`}>
      <HeaderTitleSection title={title} icon={icon} variant="small" />
      {children}
    </FlexCol>
  );
};

export default CheckboxSection;
