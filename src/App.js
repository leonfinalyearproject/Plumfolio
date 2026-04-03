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
import Settings from './pages/Settings';
import Reports from './pages/Reports';
import Reports from './pages/Reports';
import DashboardLayout from './components/DashboardLayout';
import AIInsightWidget from './components/AIInsightWidget';
import MobileNav from './components/MobileNav';

import './styles/globals.css';
import './styles/mobile.css';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  // Show spinner while auth is loading — NOT black screen
  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: '#030305',
      }}>
        <div style={{
          width: 28, height: 28,
          border: '2px solid rgba(168,85,247,0.15)',
          borderTopColor: '#A855F7',
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite',
        }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // Not loading, no user — redirect to sign in
  if (!user) return <Navigate to="/signin" />;

  return <DashboardLayout>{children}</DashboardLayout>;
};

const GlobalAIWidget = () => {
  const { user } = useAuth();
  const location = useLocation();
  const authPages = ['/', '/signin', '/signup', '/verified', '/forgot-password', '/reset-password'];
  if (!user || authPages.includes(location.pathname)) return null;
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
                <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
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
