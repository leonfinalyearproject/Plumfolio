// src/components/Sidebar.js
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, ArrowLeftRight, Target, BarChart3,
  Brain, Receipt, Settings, LogOut
} from 'lucide-react';
import './Sidebar.css';

const Sidebar = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
    { path: '/budgets', label: 'Budgets', icon: Target },
    { path: '/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/insights', label: 'AI Insights', icon: Brain },
    { path: '/receipt-scanner', label: 'Scan Receipt', icon: Receipt },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src={process.env.PUBLIC_URL + '/logo.png'} alt="Plumfolio" className="sidebar-logo-img" />
        <span className="sidebar-logo-text">Plumfolio</span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-logout" onClick={handleSignOut}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
