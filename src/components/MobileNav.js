// src/components/MobileNav.js
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, ArrowLeftRight, Target, BarChart3,
  Brain, Settings, LogOut
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
    { path: '/insights', label: 'AI', icon: Brain },
    { path: '/settings', label: 'Settings', icon: Settings },
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
            background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px', padding: '24px', maxWidth: '300px', width: '100%',
            textAlign: 'center',
          }}>
            <LogOut size={32} style={{ color: '#e74c3c', marginBottom: '12px' }} />
            <h3 style={{ color: '#f2ede5', margin: '0 0 8px', fontSize: '1.1rem' }}>Sign Out?</h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', margin: '0 0 20px' }}>
              Are you sure you want to sign out of Plumfolio?
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowLogout(false)}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)',
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
