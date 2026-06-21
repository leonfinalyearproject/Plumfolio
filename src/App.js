import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useInsights } from './context/InsightsContext';
import { SlideshowProvider } from './context/SlideshowContext';
import { InsightsProvider } from './context/InsightsContext';
import { CurrencyProvider } from './context/CurrencyContext';

import Landing from './pages/Landing';
import SignUp from './pages/SignUp';
import SignIn from './pages/SignIn';
import EmailVerified from './pages/EmailVerified';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Budgets from './pages/Budgets';
import Analytics from './pages/Analytics';
import Insights from './pages/Insights';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Onboarding from './pages/Onboarding';
import DashboardLayout from './components/DashboardLayout';
import { shouldShowOnboarding } from './utils/onboardingStorage';
import AIInsightWidget from './components/AIInsightWidget';
import MobileNav from './components/MobileNav';

import './styles/globals.css';
import './styles/scrollAnimations.css';
import './styles/mobile.css';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const { transactions, budgets, loading: insightsLoading } = useInsights();
  const location = useLocation();

  if (loading || (user && insightsLoading)) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--bg-primary, #F4F6F9)',
      }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (!user) return <Navigate to="/signin" />;

  const onOnboarding = location.pathname === '/onboarding';
  const needsOnboarding = shouldShowOnboarding(user.id, { transactions, budgets });

  if (needsOnboarding && !onOnboarding) return <Navigate to="/onboarding" replace />;
  if (!needsOnboarding && onOnboarding) return <Navigate to="/dashboard" replace />;

  if (onOnboarding) return children;

  return <DashboardLayout>{children}</DashboardLayout>;
};

const OnboardingRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const { transactions, budgets, loading: insightsLoading } = useInsights();

  if (loading || insightsLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--bg-primary, #F4F6F9)',
      }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (!user) return <Navigate to="/signin" />;

  if (!shouldShowOnboarding(user.id, { transactions, budgets })) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const GlobalAIWidget = () => {
  const { user } = useAuth();
  const location = useLocation();
  const hiddenPages = ['/', '/signin', '/signup', '/verified', '/forgot-password', '/reset-password', '/settings', '/onboarding'];
  if (!user || hiddenPages.includes(location.pathname)) return null;
  return <AIInsightWidget />;
};

const GlobalMobileNav = () => {
  const { user } = useAuth();
  const location = useLocation();
  const authPages = ['/', '/signin', '/signup', '/verified', '/forgot-password', '/reset-password', '/onboarding'];
  if (!user || authPages.includes(location.pathname)) return null;
  return <MobileNav />;
};

function App() {
  return (
    <Router basename="/Plumfolio">
      <AuthProvider>
        <CurrencyProvider>
          <SlideshowProvider>
            <InsightsProvider>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/signin" element={<SignIn />} />
                <Route path="/verified" element={<EmailVerified />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/onboarding" element={<OnboardingRoute><Onboarding /></OnboardingRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
                <Route path="/budgets" element={<ProtectedRoute><Budgets /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
              <GlobalAIWidget />
              <GlobalMobileNav />
            </InsightsProvider>
          </SlideshowProvider>
        </CurrencyProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
