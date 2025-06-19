import { Collapsible } from '@radix-ui/react-collapsible';
import { ChevronRight, Power } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

import { Flex } from '@/components/flex';
import Logo from '@/components/logo';
import { Button } from '@/components/ui/button.tsx';
import { CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import MENU_ITEMS from '@/constants/SidebarMenu';
import { cn } from '@/lib/utils.ts';
import { useLogout } from '@/features/auth/use-logout';

import { useSessionStore } from '@/stores/sessionStore';
import { filterMenuItemsByRole } from '@/utils/menu-access.ts';
import { MENU_ITEM } from '@/types/menu-item.tsx';

interface AsideProps {
  isOpen?: boolean;
}

const Aside = ({ isOpen }: AsideProps) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { mutate: logoutMutation, isPending: isLoggingOut, isError: logoutError } = useLogout();
  const role = useSessionStore((state) => state.role);
  const visibleMenu = filterMenuItemsByRole(role, MENU_ITEMS);
  const handleLogoutClick = () => {
    logoutMutation();
  };
  {
    /*
  <button className="ml-2 hover:bg-red-600 p-1">
          <MinusIcon size={16} />
        </button>
        <button className="ml-2 hover:bg-red-600 p-1">
          <Maximize size={16} />
        </button>
        */
  }

  return (
    <Sidebar
      data-slot="sidebar-container"
      className={cn(
        'fixed top-0 left-0 z-40 h-screen transition-transform block md:block ',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        'w-64 bg-[--background] text-sidebar-foreground shadow-lg'
      )}
    >
      <SidebarHeader className={'p-6'}>
        <Link to={'/'}>
          <Logo />
        </Link>
      </SidebarHeader>
      <SidebarContent className="gap-0">
        {visibleMenu.map((item: MENU_ITEM) => {
          const hasChildren = !!item.children?.length;

          if (hasChildren) {
            const isOpen = openId === item.id;
            const isActive = activeId === item.id;

            return (
              <Collapsible
                key={item.id}
                open={isOpen}
                onOpenChange={(open) => {
                  setOpenId(open ? item.id : null);
                  setActiveId(open ? item.id : null);
                }}
                className="group/collapsible"
              >
                <SidebarGroup>
                  <CollapsibleTrigger asChild>
                    <SidebarGroupLabel
                      className={cn(
                        'cursor-pointer !text-[14px] flex items-center gap-2 h-[36px] px-3 !rounded-none transition-colors',
                        isActive ? 'bg-primary text-white' : 'hover:bg-muted/10 text-white'
                      )}
                    >
                      <div className="flex items-center gap-2 !h-[36px]">
                        <span className="text-gray-200">{item.icon}</span>
                        <span>{item.name}</span>
                      </div>
                      <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <SidebarMenu className="!gap-0">
                      {item?.children?.map((child) => (
                        <SidebarMenuItem key={child.id}>
                          <SidebarMenuButton
                            onClick={() => {
                              setActiveId(child.id);
                              navigate(child.route);
                            }}
                            className={cn(
                              'text-neutral-300 !text-[14px] !rounded-none h-[36px] bg-[--card-foreground] cursor-pointer transition-colors',
                              activeId === child.id && '!bg-primary'
                            )}
                            asChild
                          >
                            <a className="flex !text-[14px] items-center gap-2 h-[36px] px-3 w-full">
                              <span>{child.icon}</span>
                              <span>{child.name}</span>
                            </a>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            );
          }

          const isActive = activeId === item.id;

          return (
            <SidebarGroup key={item.id}>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => {
                      setOpenId(null);
                      setActiveId(item.id);
                      navigate(item.route);
                    }}
                    className={cn(
                      'h-[36px] !text-[14px] px-3 !rounded-none transition-colors cursor-pointer',
                      isActive ? 'bg-primary text-white' : 'hover:bg-muted/10 text-white'
                    )}
                    asChild
                  >
                    <a className="flex items-center gap-2 h-[36px] !text-[14px] w-full">
                      <span>{item.icon}</span>
                      <span>{item.name}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter
        className={'border-t-2 1440:h-[100px] h-[70px]   flex justify-center items-center'}
      >
        <Button variant={'ghost'} onClick={handleLogoutClick} disabled={isLoggingOut}>
          <Flex className="items-center gap-2 h-[48px]  ">
            {isLoggingOut ? 'Cerrando Sesión...' : 'Cerrar Sesión'}
            <Power />
          </Flex>
        </Button>
        {logoutError && <p style={{ color: 'red' }}>Error al cerrar sesión: </p>}
      </SidebarFooter>
    </Sidebar>
  );
};

export default Aside;
