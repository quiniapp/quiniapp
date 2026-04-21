import { ReactNode } from 'react';
import { FlexCol } from '../flex';

export const PageWrapper = ({children}:{children: ReactNode[]}) => {
  return (
    <FlexCol
      className={'h-full w-full max-w-full overflow-y-auto overflow-x-hidden gap-2 sm:gap-3 2xl:gap-4'}
    >
      {children}
    </FlexCol>
  );
};
