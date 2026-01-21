import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { StudioPage } from './pages/StudioPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/project/:projectId',
    element: <StudioPage />,
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
