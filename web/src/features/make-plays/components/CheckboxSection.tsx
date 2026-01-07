import { ReactNode } from 'react';
import { FlexCol } from '@/components/flex';
import HeaderTitleSection from '@/components/header-title-section';

interface CheckboxSectionProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
  headerAction?: ReactNode;
}

const CheckboxSection = ({ title, icon, children, className = '', headerAction }: CheckboxSectionProps) => {
  return (
    <FlexCol className={`border-2 p-1 sm:p-4 lg:p-1.5 rounded-lg gap-1 lg:gap-1 ${className}`}>
      <div className="flex items-center  gap-2">
        <HeaderTitleSection title={title} icon={icon}  />
        {headerAction}
      </div>
      {children}
    </FlexCol>
  );
};

export default CheckboxSection;
