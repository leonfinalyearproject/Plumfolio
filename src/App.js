// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SlideshowProvider } from './context/SlideshowContext';
import { InsightsProvider } from './context/InsightsContext';

import Landing from './pages/Landing';
import SignUp from './pages/SignUp';
import SignIn from './pages/SignIn';
import EmailVerified from './pages/EmailVerified';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Budgets from './pages/Budgets';
import Analytics from './pages/Analytics';
import Insights from './pages/Insights';
import ReceiptScanner from './pages/ReceiptScanner';
import Settings from './pages/Settings';
import DashboardLayout from './components/DashboardLayout';
import AIInsightWidget from './components/AIInsightWidget';
import MobileNav from './components/MobileNav';

import './styles/globals.css';
import './styles/mobile.css';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/signin" />;
  return (
    <DashboardLayout>
      {children}
    </DashboardLayout>
  );
};

const GlobalAIWidget = () => {
  const { user } = useAuth();
  if (!user) return null;
  return <AIInsightWidget />;
};

const GlobalMobileNav = () => {
  const { user } = useAuth();
  if (!user) return null;
  return <MobileNav />;
};

function App() {
  return (
    <Router basename="/Plumfolio">
      <AuthProvider>
        <SlideshowProvider>
          <InsightsProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/verified" element={<EmailVerified />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
              <Route path="/budgets" element={<ProtectedRoute><Budgets /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
              <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
              <Route path="/receipt-scanner" element={<ProtectedRoute><ReceiptScanner /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
            <GlobalAIWidget />
            <GlobalMobileNav />
          </InsightsProvider>
        </SlideshowProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
