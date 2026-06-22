import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, LogOut, Settings, ChevronDown } from 'lucide-react';
import LiveSyncBadge from './LiveSyncBadge';
import './Header.css';

/**
 * Header Component
 * Implements FR-1.3: The system shall allow a logged-in user to log out.
 */
const Header = ({ title, folio }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // FR-1.3: Logout functionality
  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="dashboard-header">
      <div className="page-title-wrap">
        <span className="page-folio-id">Folio {folio || 'I'}</span>
        <h1 className="page-title">{title}</h1>
      </div>
      
      <div className="header-actions">
        <LiveSyncBadge />
        {/* User Menu */}
        <div className="user-menu" ref={dropdownRef}>
          <button 
            className="user-menu-trigger"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <div className="user-avatar">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name} />
              ) : (
                <User size={18} />
              )}
            </div>
            <span className="user-name">{profile?.full_name || 'User'}</span>
            <ChevronDown size={16} className={`chevron ${dropdownOpen ? 'open' : ''}`} />
          </button>
          
          {dropdownOpen && (
            <div className="user-dropdown">
              <div className="dropdown-header">
                <span className="dropdown-name">{profile?.full_name}</span>
                <span className="dropdown-email">{profile?.email}</span>
              </div>
              
              <div className="dropdown-divider" />
              
              <button 
                className="dropdown-item"
                onClick={() => {
                  navigate('/settings');
                  setDropdownOpen(false);
                }}
              >
                <Settings size={16} />
                <span>Settings</span>
              </button>
              
              <button 
                className="dropdown-item logout"
                onClick={handleLogout}
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
