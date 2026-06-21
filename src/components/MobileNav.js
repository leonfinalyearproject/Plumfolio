// src/components/MobileNav.js
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, ArrowLeftRight, Target, BarChart3,
  Brain, Settings, LogOut, FileText
} from 'lucide-react';

const MobileNav = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      sessionStorage.clear();
      localStorage.clear();
      window.location.href = window.location.origin + '/Plumfolio/signin';
    } catch (err) {
      console.error('Sign out error:', err);
      window.location.href = window.location.origin + '/Plumfolio/signin';
    }
  };

  const navItems = [
    { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { path: '/transactions', label: 'Txns', icon: ArrowLeftRight },
    { path: '/budgets', label: 'Budgets', icon: Target },
    { path: '/analytics', label: 'Stats', icon: BarChart3 },
    { path: '/insights', label: 'Forecast', icon: Brain },
    { path: '/reports', label: 'Reports', icon: FileText },
    { path: '/settings', label: 'More', icon: Settings },
  ];

  return (
    <>
      {/* Logout confirmation overlay */}
      {showLogout && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
        }}>
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
            borderRadius: '16px', padding: '24px', maxWidth: '300px', width: '100%',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(15, 23, 42, 0.12)',
          }}>
            <LogOut size={32} style={{ color: '#e74c3c', marginBottom: '12px' }} />
            <h3 style={{ color: 'var(--text-primary)', margin: '0 0 8px', fontSize: '1.1rem' }}>Sign Out?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 20px' }}>
              Are you sure you want to sign out of Plumfolio?
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowLogout(false)}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)',
                  background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                  fontSize: '0.9rem', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                  background: '#e74c3c', color: 'white',
                  fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer',
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="mobile-nav">
        <div className="mobile-nav-inner">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
          {/* Logout button */}
          <button
            className="mobile-nav-link"
            onClick={() => setShowLogout(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <LogOut />
            <span>Out</span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default MobileNav;
