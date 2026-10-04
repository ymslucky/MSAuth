/** 路由表 */
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AccountLayout from './routes/account/layout';
import AccountIndexPage from './routes/account/index';
import ClientsPage from './routes/account/clients';
import LoginPage from './routes/login';
import NotFoundPage from './routes/not-found';
import OAuthConsentPage from './routes/oauth-consent';
import PasswordPage from './routes/account/password';
import RegisterPage from './routes/register';
import SessionsPage from './routes/account/sessions';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/account" replace /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  // OAuth 同意页：独立直出，不套 AppShell（authorize 302 直达）
  { path: '/oauth/consent', element: <OAuthConsentPage /> },
  {
    path: '/account',
    element: <AccountLayout />,
    children: [
      { index: true, element: <AccountIndexPage /> },
      { path: 'sessions', element: <SessionsPage /> },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'password', element: <PasswordPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
