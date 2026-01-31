import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Menu, Bell, Search, ChevronDown, User, Settings, LogOut } from 'lucide-react';
import './Header.css';

const Header = ({ title, onMenuClick }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <button className="menu-toggle" onClick={onMenuClick}>
          <Menu size={22} />
        </button>
        <h1 className="page-title">{title}</h1>
      </div>
      
      <div className="header-right">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input type="text" placeholder="Search transactions..." />
        </div>
        
        <button className="notification-btn">
          <Bell size={20} />
          <span className="notification-dot" />
        </button>
        
        <div className="user-menu" ref={dropdownRef}>
          <button 
            className="user-menu-trigger"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <div className="user-avatar">{userInitials}</div>
            <div className="user-info">
              <span className="user-name">{userName}</span>
              <span className="user-email">{user?.email}</span>
            </div>
            <ChevronDown size={16} className={`chevron ${dropdownOpen ? 'open' : ''}`} />
          </button>
          
          {dropdownOpen && (
            <div className="user-dropdown">
              <button onClick={() => { navigate('/settings'); setDropdownOpen(false); }}>
                <User size={16} />
                Profile
              </button>
              <button onClick={() => { navigate('/settings'); setDropdownOpen(false); }}>
                <Settings size={16} />
                Settings
              </button>
              <div className="dropdown-divider" />
              <button onClick={handleLogout} className="logout">
                <LogOut size={16} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
