import { lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/layout/Layout.jsx';
import { ToastProvider } from './components/ui/Toast.jsx';
import { AuthProvider } from './context/AuthContext.jsx';

// Each page is its own chunk, so the first paint only downloads the shell and the page being visited.
const Home = lazy(() => import('./pages/Home.jsx'));
const CreateMystery = lazy(() => import('./pages/CreateMystery.jsx'));
const Investigation = lazy(() => import('./pages/Investigation.jsx'));
const Accusation = lazy(() => import('./pages/Accusation.jsx'));
const Results = lazy(() => import('./pages/Results.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const History = lazy(() => import('./pages/History.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));
// Component gallery: dev server only. In a production build this is a dead branch, so the page is not shipped.
const Kit = import.meta.env.DEV ? lazy(() => import('./pages/Kit.jsx')) : null;

export function Providers({ children }) {
  return (
    <ToastProvider>
      <AuthProvider>{children}</AuthProvider>
    </ToastProvider>
  );
}

// Routes only, so tests can mount them inside a MemoryRouter.
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="create" element={<CreateMystery />} />
        <Route path="case/:id" element={<Investigation />} />
        <Route path="case/:id/accuse" element={<Accusation />} />
        <Route path="case/:id/result" element={<Results />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="history" element={<History />} />
        {Kit && <Route path="__kit" element={<Kit />} />}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Providers>
        <AppRoutes />
      </Providers>
    </BrowserRouter>
  );
}
