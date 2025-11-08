import { ReactNode } from 'react';
import { FlexCol } from '../flex';

export const PageWrapper = ({children}:{children: ReactNode[]}) => {
  return (
    <FlexCol
      className={'h-full  overflow-y-auto sm:overflow-hidden'}
    >
      {children}
    </FlexCol>
  );
};
