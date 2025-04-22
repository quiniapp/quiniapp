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
import { ChevronRight, UserIcon } from 'lucide-react';
import MENU_ITEMS from '@/constants/SidebarMenu';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils.ts';
import { useState } from 'react';

const Aside = () => {
  const navigate = useNavigate();

  const [openId, setOpenId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <Sidebar className="h-screen min-w-[260px]">
      <SidebarHeader className={'p-6'}>quiniapp</SidebarHeader>
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

      <SidebarFooter>
        <div className="flex items-center gap-3 text-muted">
          <div className="w-8 h-8 !rounded-none bg-gray-300 flex items-center justify-center overflow-hidden">
            <UserIcon size={20} className="text-gray-700" />
          </div>
          <div>
            <div className="text-sm font-semibold">Administrador</div>
            <div className="text-xs text-gray-400">(usuario 1)</div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default Aside;
