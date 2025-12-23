import { memo, useCallback } from 'react';
import { LayoutIcon, UserIcon } from 'lucide-react';

import { FlexCol } from '@/components/flex';
import { useSidebar } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { userTypeDictionary } from '@helper/functions/userTypeDictionary';

interface HeaderProps {
  setIsOpen: (isOpen: (prev: boolean) => boolean) => void;
}

const Header = memo(function Header({ setIsOpen }: HeaderProps) {
  const { user } = useAuth();
  const { toggleSidebar, isMobile } = useSidebar();

  const handleToggle = useCallback(() => {
    if (isMobile) {
      toggleSidebar();
    } else {
      setIsOpen((prev) => !prev);
    }
  }, [isMobile, toggleSidebar, setIsOpen]);

  return (
    <div className="bg-primary text-white sm:min-h-[50px] flex justify-between items-center p-1 ">
      <div className="px-2 hover:cursor-pointer" onClick={handleToggle}>
        <LayoutIcon />
      </div>

      <div className="flex gap-[16px]">
        <div className="flex items-center gap-3 text-muted">
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden">
            <UserIcon size={20} className="text-gray-700" />
          </div>
          <FlexCol className="pr-4">
            <div className="text-sm text-white font-semibold uppercase">{`${user?.username}`}</div>
            <div className="hidden sm:block text-xs text-white">
              {user?.user_type && userTypeDictionary[user?.user_type]}
            </div>
          </FlexCol>
        </div>
      </div>
    </div>
  );
});

export default Header;
