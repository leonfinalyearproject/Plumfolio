import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Lock, Bell, Shield, Trash2, Save } from 'lucide-react';
import './Settings.css';

const Settings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [profileData, setProfileData] = useState({
    fullName: user?.user_metadata?.full_name || '',
    email: user?.email || '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [notifications, setNotifications] = useState({
    budgetAlerts: true,
    weeklyReport: false,
    monthlyReport: true,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleProfileSave = async () => {
    setSaving(true);
    // Simulated save
    setTimeout(() => {
      setSaving(false);
      setMessage({ type: 'success', text: 'Profile updated successfully' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }, 1000);
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }
    
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage({ type: 'success', text: 'Password changed successfully' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }, 1000);
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="settings-page">
      {/* Tabs */}
      <div className="settings-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={18} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Message */}
      {message.text && (
        <div className={`settings-message ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Content */}
      <div className="settings-content">
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="settings-section">
            <div className="section-header">
              <h2>Profile Information</h2>
              <p>Update your personal information and email address.</p>
            </div>
            
            <div className="settings-form">
              <div className="form-group">
                <label htmlFor="fullName">
                  <User size={16} />
                  Full Name
                </label>
                <input
                  type="text"
                  id="fullName"
                  value={profileData.fullName}
                  onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                  placeholder="Your full name"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="email">
                  <Mail size={16} />
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  placeholder="you@example.com"
                />
              </div>
              
              <button 
                className="save-btn" 
                onClick={handleProfileSave}
                disabled={saving}
              >
                {saving ? <span className="spinner" /> : <Save size={18} />}
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="settings-section">
            <div className="section-header">
              <h2>Change Password</h2>
              <p>Update your password to keep your account secure.</p>
            </div>
            
            <div className="settings-form">
              <div className="form-group">
                <label htmlFor="currentPassword">
                  <Lock size={16} />
                  Current Password
                </label>
                <input
                  type="password"
                  id="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  placeholder="Enter current password"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="newPassword">
                  <Lock size={16} />
                  New Password
                </label>
                <input
                  type="password"
                  id="newPassword"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Enter new password"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="confirmPassword">
                  <Lock size={16} />
                  Confirm New Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                />
              </div>
              
              <button 
                className="save-btn" 
                onClick={handlePasswordChange}
                disabled={saving}
              >
                {saving ? <span className="spinner" /> : <Shield size={18} />}
                Update Password
              </button>
            </div>

            <div className="danger-zone">
              <div className="section-header">
                <h2>Danger Zone</h2>
                <p>Permanently delete your account and all associated data.</p>
              </div>
              <button className="delete-btn">
                <Trash2 size={18} />
                Delete Account
              </button>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="settings-section">
            <div className="section-header">
              <h2>Notification Preferences</h2>
              <p>Choose what notifications you want to receive.</p>
            </div>
            
            <div className="notification-options">
              <div className="notification-item">
                <div className="notification-info">
                  <span className="notification-title">Budget Alerts</span>
                  <span className="notification-desc">Get notified when you're approaching your budget limits</span>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={notifications.budgetAlerts}
                    onChange={(e) => setNotifications({ ...notifications, budgetAlerts: e.target.checked })}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
              
              <div className="notification-item">
                <div className="notification-info">
                  <span className="notification-title">Weekly Summary</span>
                  <span className="notification-desc">Receive a weekly summary of your spending</span>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={notifications.weeklyReport}
                    onChange={(e) => setNotifications({ ...notifications, weeklyReport: e.target.checked })}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
              
              <div className="notification-item">
                <div className="notification-info">
                  <span className="notification-title">Monthly Report</span>
                  <span className="notification-desc">Get a detailed monthly financial report</span>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={notifications.monthlyReport}
                    onChange={(e) => setNotifications({ ...notifications, monthlyReport: e.target.checked })}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
