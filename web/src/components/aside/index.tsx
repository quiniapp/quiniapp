// src/components/layout/Aside.tsx (o donde esté)
import { ChevronRight, Power } from 'lucide-react';
import { memo, useMemo, useState, useCallback } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';

import { Flex } from '@/components/flex';
import Logo from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { cn } from '@/lib/utils';
import { filterMenuItemsByRole } from '@/utils/menu-access';
import { MENU_ITEM } from '@/types/menu-item';
import { useAuth } from '@/contexts/AuthContext';
import { usePrefetchRoute } from '@/hooks/usePrefetchRoute';

interface AsideProps {
  isOpen?: boolean;
}

const Aside = memo(function Aside({ isOpen }: AsideProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { role, logout, loading } = useAuth();
  const prefetch = usePrefetchRoute();

  // Menú visible según rol (memo para evitar recalcular cada render)
  const visibleMenu = useMemo(() => filterMenuItemsByRole(role, MENU_ITEMS), [role]);

  const goTo = useCallback((route: string, id: string) => {
    setOpenId(null);
    setActiveId(id);

    if (location.pathname === route) {
      // Re-monta la misma ruta
      // (si usás Data Routers, también revalida loaders)
      navigate(route, { replace: true });
      navigate(0); // 👈 Soft reload
    } else {
      navigate(route);
    }
  }, [location.pathname, navigate]);

  // Marcar activo por URL (opcional, mejora UX si se recarga la página)
  // Si cada item tiene route único podés sincronizar activeId así:
  useMemo(() => {
    const current = visibleMenu
      .flatMap((i) => [i, ...(i.children ?? [])])
      .find((i) => i.route === location.pathname);
    setActiveId(current?.id ?? null);
  }, [location.pathname, visibleMenu]);

  const handleLogoutClick = useCallback(async () => {
    await logout();
    navigate('/login', { replace: true }); // 👈 mover la navegación acá
  }, [logout, navigate]);

  return (
    <Sidebar
      data-slot="sidebar-container"
      className={cn(
        `flex transition-transform duration-300
         ${isOpen ? ' md:static translate-x-0  ' : '-translate-x-full'}
          bg-[--background] text-sidebar-foreground shadow-lg h-screen fixed z-40`
      )}
    >
      <SidebarHeader className="p-2 lg:p-3">
        <Link to="/">
          <Logo />
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {visibleMenu.map((item: MENU_ITEM) => {
          const hasChildren = !!item.children?.length;

          if (hasChildren) {
            const isOpenCollapsible = openId === item.id;
            const isActive = activeId === item.id;

            return (
              <Collapsible
                key={item.id}
                open={isOpenCollapsible}
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
                        'cursor-pointer flex items-center gap-2 h-[36px] px-2 lg:px-3 !rounded-none transition-colors text-xs lg:text-base',
                        isActive ? 'bg-primary text-white' : 'hover:bg-muted/10 text-white'
                      )}
                    >
                      <span className="flex items-center gap-2 !h-[36px]">
                        <span className="text-gray-200 [&>svg]:w-3.5 [&>svg]:h-3.5 lg:[&>svg]:w-5 lg:[&>svg]:h-5">{item.icon}</span>
                        <span>{item.name}</span>
                      </span>
                      <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90 w-3.5 h-3.5 lg:w-4 lg:h-4" />
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <SidebarMenu className="!gap-0">
                      {item.children?.map((child) => {
                        const active = activeId === child.id;
                        return (
                          <SidebarMenuItem key={child.id}>
                            <SidebarMenuButton
                              onClick={() => {
                                goTo(child.route, child.id);
                              }}
                              onMouseEnter={() => prefetch(child.route)}
                              className={cn(
                                'text-neutral-300 !rounded-none h-[36px] bg-[--card-foreground] cursor-pointer transition-colors text-xs lg:text-base',
                                active && '!bg-primary'
                              )}
                              asChild
                            >
                              <a className="flex items-center gap-2 h-[36px] px-2 lg:px-3 w-full">
                                <span className="[&>svg]:w-3.5 [&>svg]:h-3.5 lg:[&>svg]:w-5 lg:[&>svg]:h-5">{child.icon}</span>
                                <span>{child.name}</span>
                              </a>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
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
                      setOpenId(null);goTo(item.route, item.id)
                    }}
                    onMouseEnter={() => prefetch(item.route)}
                    className={cn(
                      'h-[36px] px-3 !rounded-none transition-colors cursor-pointer text-xs lg:text-base',
                      isActive ? 'bg-primary text-white' : 'hover:bg-muted/10 text-white'
                    )}
                    asChild
                  >
                    <a className="flex items-center gap-2 h-[36px] w-full">
                      <span className="[&>svg]:w-3.5 [&>svg]:h-3.5 lg:[&>svg]:w-5 lg:[&>svg]:h-5">{item.icon}</span>
                      <span>{item.name}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t-2 1440:h-[100px] h-[70px] flex justify-center items-center">
        <Button variant="ghost" onClick={handleLogoutClick} disabled={loading}>
          <Flex className="items-center gap-2 h-[48px] text-xs lg:text-base">
            {loading ? 'Cerrando Sesión…' : 'Cerrar Sesión'}
            <Power className="w-3.5 h-3.5 lg:w-5 lg:h-5" />
          </Flex>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
});

export default Aside;
