import { createContext, useContext, useState, ReactNode } from 'react';
import { USER_TYPE } from '@helper/types/user.type';

interface UserListContextType {
  filterUserType: USER_TYPE | undefined;
  setFilterUserType: (type: USER_TYPE | undefined) => void;
}

const UserListContext = createContext<UserListContextType | undefined>(undefined);

export const UserListProvider = ({ children }: { children: ReactNode }) => {
  const [filterUserType, setFilterUserType] = useState<USER_TYPE | undefined>(USER_TYPE.CASHIER);

  return (
    <UserListContext.Provider value={{ filterUserType, setFilterUserType }}>
      {children}
    </UserListContext.Provider>
  );
};

export const useUserListContext = () => {
  const context = useContext(UserListContext);
  if (context === undefined) {
    throw new Error('useUserListContext must be used within UserListProvider');
  }
  return context;
};
