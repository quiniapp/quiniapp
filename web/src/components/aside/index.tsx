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

import { Collapsible } from '@radix-ui/react-collapsible';
import { CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight, Power } from 'lucide-react';
import MENU_ITEMS from '@/constants/SidebarMenu';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils.ts';
import { useState } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Flex } from '@/components/flex';
import Logo from '@/components/logo';

const Aside = () => {
  const [openId, setOpenId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const navigate = useNavigate();
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

  const handleLogout = () => {
    localStorage.removeItem('isAuth');
    navigate('/login');
  };

  return (
    <Sidebar className="h-screen min-w-[260px]">
      <SidebarHeader className={'p-6'}>
        <Logo />
      </SidebarHeader>
      <SidebarContent className="gap-0">
        {MENU_ITEMS.map((item) => {
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
                        'cursor-pointer flex items-center gap-2 h-[48px] px-3 !rounded-none transition-colors',
                        isActive ? 'bg-primary text-white' : 'hover:bg-muted/10 text-white'
                      )}
                    >
                      <div className="flex items-center gap-2 !h-[48px]">
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
                              'text-neutral-300 !rounded-none h-[48px] bg-[var(--bg-card)] cursor-pointer transition-colors',
                              activeId === child.id && '!bg-primary'
                            )}
                            asChild
                          >
                            <a className="flex items-center gap-2 h-[48px] px-3 w-full">
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
                      'h-[48px] px-3 !rounded-none transition-colors cursor-pointer',
                      isActive ? 'bg-primary text-white' : 'hover:bg-muted/10 text-white'
                    )}
                    asChild
                  >
                    <a className="flex items-center gap-2 h-[48px] w-full">
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

      <SidebarFooter className={'border-t-2'}>
        <Button variant={'ghost'} onClick={handleLogout}>
          <Flex className="items-center gap-2 h-[48px]  ">
            Cerrar Sesión
            <Power />
          </Flex>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
};

export default Aside;
