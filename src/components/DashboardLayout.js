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

  const getFolioRef = () => {
    const path = location.pathname;
    if (path.includes('transactions')) return 'II';
    if (path.includes('budgets')) return 'III';
    if (path.includes('analytics')) return 'IV';
    if (path.includes('insights')) return 'V';
    if (path.includes('reports')) return 'VI';
    if (path.includes('settings')) return 'VII';
    return 'I';
  };

  const folioMonth = new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-main">
        <Header title={getPageTitle()} folio={getFolioRef()} />
        <main className="dashboard-content">
          <div className="book-spread">
            <div className="book-holes" aria-hidden="true">
              <span /><span /><span />
            </div>
            <div className="book-inner">
              <div className="book-folio" aria-hidden="true">
                <span>{folioMonth}</span>
                <strong>Folio {getFolioRef()}</strong>
              </div>
              {children}
            </div>
          </div>
        </main>
        <footer className="dashboard-footer">
          <p>&copy; {new Date().getFullYear()} Futurify Designs</p>
        </footer>
      </div>
    </div>
  );
};

export default DashboardLayout;
