import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import Header from './Header';
import './DashboardLayout.css';

const DashboardLayout = ({ children }) => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Timeout protection - if loading takes more than 5 seconds, something is wrong
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        console.warn('Loading timeout - redirecting to signin');
        setLoadingTimeout(true);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [loading]);

  // Redirect to signin if not authenticated or timeout
  useEffect(() => {
    if (loadingTimeout) {
      // Force sign out and redirect
      signOut().then(() => {
        navigate('/signin');
      });
    } else if (!loading && !user) {
      navigate('/signin');
    }
  }, [user, loading, loadingTimeout, navigate, signOut]);

  if (loading && !loadingTimeout) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('dashboard')) return 'Dashboard';
    if (path.includes('transactions')) return 'Transactions';
    if (path.includes('budgets')) return 'Budgets';
    if (path.includes('analytics')) return 'Analytics';
    if (path.includes('insights')) return 'Forecasts';
    if (path.includes('reports')) return 'Reports';
    if (path.includes('settings')) return 'Settings';
    return 'Dashboard';
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-main">
        <Header title={getPageTitle()} />
        <main className="dashboard-content">
          {children}
        </main>
        <footer className="dashboard-footer">
          <p>&copy; {new Date().getFullYear()} Futurify Designs</p>
        </footer>
      </div>
    </div>
  );
};

export default DashboardLayout;
