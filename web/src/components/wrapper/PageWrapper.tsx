import { ReactNode } from 'react';
import { FlexCol } from '../flex';

export const PageWrapper = ({children}:{children: ReactNode[]}) => {
  return (
    <FlexCol
      className={'h-full w-[356px] sm:w-[1000px] 1440:w-full overflow-y-auto sm:overflow-hidden'}
    >
      {children}
    </FlexCol>
  );
};
