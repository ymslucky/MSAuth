/** 路由表 */
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AccountLayout from './routes/account/layout';
import AccountIndexPage from './routes/account/index';
import PasswordPage from './routes/account/password';
import SessionsPage from './routes/account/sessions';
import LoginPage from './routes/login';
import NotFoundPage from './routes/not-found';
import RegisterPage from './routes/register';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/account" replace /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    path: '/account',
    element: <AccountLayout />,
    children: [
      { index: true, element: <AccountIndexPage /> },
      { path: 'sessions', element: <SessionsPage /> },
      { path: 'password', element: <PasswordPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
