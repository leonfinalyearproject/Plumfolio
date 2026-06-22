// src/components/Sidebar.js
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, ArrowLeftRight, Target, BarChart3,
  Brain, Settings, LogOut, FileText
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
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, index: '01' },
    { path: '/transactions', label: 'Transactions', icon: ArrowLeftRight, index: '02' },
    { path: '/budgets', label: 'Budgets', icon: Target, index: '03' },
    { path: '/analytics', label: 'Analytics', icon: BarChart3, index: '04' },
    { path: '/insights', label: 'Forecasts', icon: Brain, index: '05' },
    { path: '/reports', label: 'Reports', icon: FileText, index: '06' },
    { path: '/settings', label: 'Settings', icon: Settings, index: '07' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src={process.env.PUBLIC_URL + '/logo.png'} alt="Plumfolio" className="sidebar-logo-img" />
        <span className="sidebar-logo-text">Plumfolio</span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ path, label, icon: Icon, index }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <span className="sidebar-index">{index}</span>
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
