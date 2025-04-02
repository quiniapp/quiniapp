import NotFound from '@/pages/NotFound';
import { Index } from '../pages';
export const RoutesContent = [
  {
    path: '/',
    id: 'Home',
    element: <Index />,
  },
  {
    path: '/not-found',
    id: 'NotFound',
    element: <NotFound />,
  },
];
