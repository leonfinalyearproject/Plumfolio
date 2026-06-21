import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import DashboardLayout from './components/DashboardLayout';
import AIInsightWidget from './components/AIInsightWidget';
import MobileNav from './components/MobileNav';

import './styles/globals.css';
import './styles/scrollAnimations.css';
import './styles/mobile.css';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
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

  return <DashboardLayout>{children}</DashboardLayout>;
};

const GlobalAIWidget = () => {
  const { user } = useAuth();
  const location = useLocation();
  const hiddenPages = ['/', '/signin', '/signup', '/verified', '/forgot-password', '/reset-password', '/settings'];
  if (!user || hiddenPages.includes(location.pathname)) return null;
  return <AIInsightWidget />;
};

const GlobalMobileNav = () => {
  const { user } = useAuth();
  const location = useLocation();
  const authPages = ['/', '/signin', '/signup', '/verified', '/forgot-password', '/reset-password'];
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
