import { ChevronDown, ChevronUp } from 'lucide-react';
import { type MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { Flex } from '@/components/flex';
import type { MENU_ITEM } from '@/types/menu-item';

type SidebarItemProps = {
  data: MENU_ITEM;
};

const SidebarItem = ({ data }: SidebarItemProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const hasChildren = !!data.children?.length;

  const isChildRouteActive = useMemo(
    () => data.children?.some((child) => location.pathname.startsWith(child.route)) ?? false,
    [data.children, location.pathname]
  );

  const isRouteActive = useCallback(
    (route: string) => location.pathname === route || location.pathname.startsWith(route + '/'),
    [location.pathname]
  );

  useEffect(() => {
    if (hasChildren && isChildRouteActive) {
      setOpen(true);
    }
  }, [hasChildren, isChildRouteActive]);

  const parentIsActive = useMemo(
    () => isRouteActive(data.route) || isChildRouteActive,
    [isRouteActive, data.route, isChildRouteActive]
  );

  const handleParentClick = useCallback(() => {
    navigate(data.route);
  }, [navigate, data.route]);

  const toggleOpen = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    setOpen((prev) => !prev);
  }, []);
  return (
    <div className="w-full">
      <Flex
        onClick={handleParentClick}
        className={` items-center justify-between p-3 text-sm ${parentIsActive ? '' : 'hover:bg-[var(--menu-bg-hover)]'}  cursor-pointer transition-all ${
          parentIsActive ? 'bg-[var(--isActive)]' : ''
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-200">{data.icon}</span>
          <span className=" leading-none">{data.name}</span>
        </div>
        {hasChildren && (
          <span
            className="text-muted hover:bg-[var(--primary-bg-hover)] w-[24px] h-[24px] justify-center flex items-center transition-all rounded-full "
            onClick={toggleOpen}
          >
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        )}
      </Flex>
      {hasChildren && open && (
        <div className="border-b-1 border-b-muted ">
          {data.children?.map((child) => (
            <Flex
              key={child.id}
              onClick={() => navigate(child.route)}
              className={` items-center gap-2 text-sm p-3 rounded hover:bg-[var(--primary-bg-hover)] cursor-pointer ${
                isRouteActive(child.route) ? 'bg-[var(--bg-card)]' : ''
              }`}
            >
              <span className="text-gray-400">{child.icon}</span>
              <span className="leading-none text-[hsl(0,0%,80%)]">{child.name}</span>
            </Flex>
          ))}
        </div>
      )}
    </div>
  );
};

export default SidebarItem;
