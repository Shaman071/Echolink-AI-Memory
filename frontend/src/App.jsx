import PasswordReset from './pages/PasswordReset';
import EmailVerification from './pages/EmailVerification';
import PrivacyPolicy from './pages/PrivacyPolicy';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClientProvider } from 'react-query';
import { queryClient } from './services/api';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import UploadsPage from './pages/UploadsPage';
import QueryPage from './pages/QueryPage';
import FragmentsListPage from './pages/FragmentsListPage';
import FragmentPage from './pages/FragmentPage';
import LinksPage from './pages/LinksPage';
import Settings from './pages/Settings';
import Login from './pages/Login';
import AdminPage from './pages/AdminPage';
import { AuthProvider, useAuth } from './context/AuthContext';

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function AppContent() {
  return (
    <Routes>
      <Route path="/reset-password" element={<PasswordReset />} />
      <Route path="/verify-email" element={<EmailVerification />} />
      <Route path="/privacy" element={<ErrorBoundary><PrivacyPolicy /></ErrorBoundary>} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
        <Route path="uploads" element={<ErrorBoundary><UploadsPage /></ErrorBoundary>} />
        <Route path="query" element={<ErrorBoundary><QueryPage /></ErrorBoundary>} />
        <Route path="links" element={<ErrorBoundary><LinksPage /></ErrorBoundary>} />
        <Route path="fragments" element={<ErrorBoundary><FragmentsListPage /></ErrorBoundary>} />
        <Route path="fragments/:id" element={<ErrorBoundary><FragmentPage /></ErrorBoundary>} />
        <Route path="settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
        <Route path="admin" element={<ErrorBoundary><AdminPage /></ErrorBoundary>} />
      </Route>
    </Routes>
  );
}

export default function App() {
  // Ensure dark mode is applied if intended by the design
  if (typeof window !== 'undefined') {
    document.documentElement.classList.add('dark');
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppContent />
          <Toaster position="top-right" />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
