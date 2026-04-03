import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency, CURRENCIES } from '../context/CurrencyContext';
import { User, Mail, Lock, Bell, Shield, Trash2, Save, Globe, Check, Search } from 'lucide-react';
import './Settings.css';

const Settings = () => {
  const { user, profile, updateProfile, updatePassword } = useAuth();
  const { currencyCode } = useCurrency();
  const [activeTab, setActiveTab] = useState('profile');
  const [profileData, setProfileData] = useState({
    fullName: user?.user_metadata?.full_name || profile?.full_name || '',
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
  const [selectedCurrency, setSelectedCurrency] = useState(currencyCode || 'BWP');
  const [currencySearch, setCurrencySearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleProfileSave = async () => {
    setSaving(true);
    try {
      const { error } = await updateProfile({ full_name: profileData.fullName });
      if (error) throw error;
      showMessage('success', 'Profile updated successfully');
    } catch (error) {
      showMessage('error', 'Failed to update profile: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showMessage('error', 'Passwords do not match');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      showMessage('error', 'Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    try {
      const { error } = await updatePassword(passwordData.newPassword);
      if (error) throw error;
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showMessage('success', 'Password changed successfully');
    } catch (error) {
      showMessage('error', 'Failed to change password: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCurrencySave = async () => {
    setSaving(true);
    try {
      const { error } = await updateProfile({ currency: selectedCurrency });
      if (error) throw error;
      showMessage('success', 'Currency changed to ' + selectedCurrency);
    } catch (error) {
      showMessage('error', 'Failed to update currency: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredCurrencies = CURRENCIES.filter(c =>
    c.name.toLowerCase().includes(currencySearch.toLowerCase()) ||
    c.code.toLowerCase().includes(currencySearch.toLowerCase())
  );

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'currency', label: 'Currency', icon: Globe },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="settings-page">
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

      {message.text && (
        <div className={`settings-message ${message.type}`}>
          {message.text}
        </div>
      )}

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
                <label htmlFor="fullName"><User size={16} /> Full Name</label>
                <input type="text" id="fullName" value={profileData.fullName} onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })} placeholder="Your full name" />
              </div>
              <div className="form-group">
                <label htmlFor="email"><Mail size={16} /> Email Address</label>
                <input type="email" id="email" value={profileData.email} disabled placeholder="you@example.com" />
              </div>
              <button className="save-btn" onClick={handleProfileSave} disabled={saving}>
                {saving ? <span className="spinner" /> : <Save size={18} />}
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* Currency Tab */}
        {activeTab === 'currency' && (
          <div className="settings-section">
            <div className="section-header">
              <h2>Currency Preferences</h2>
              <p>Choose your preferred currency for displaying amounts across the app.</p>
            </div>
            <div className="currency-selector">
              <div className="current-currency">
                <span className="current-currency-label">Current Currency</span>
                <div className="current-currency-display">
                  <span className="currency-flag">{CURRENCIES.find(c => c.code === selectedCurrency)?.flag}</span>
                  <span className="currency-code-large">{selectedCurrency}</span>
                  <span className="currency-name-large">{CURRENCIES.find(c => c.code === selectedCurrency)?.name}</span>
                </div>
              </div>

              <div className="currency-search-wrapper">
                <Search size={16} className="currency-search-icon" />
                <input type="text" className="currency-search" placeholder="Search currencies..." value={currencySearch} onChange={(e) => setCurrencySearch(e.target.value)} />
              </div>

              <div className="currency-grid">
                {filteredCurrencies.map((currency) => (
                  <button
                    key={currency.code}
                    className={`currency-option ${selectedCurrency === currency.code ? 'selected' : ''}`}
                    onClick={() => setSelectedCurrency(currency.code)}
                  >
                    <span className="currency-option-flag">{currency.flag}</span>
                    <div className="currency-option-info">
                      <span className="currency-option-code">{currency.code}</span>
                      <span className="currency-option-name">{currency.name}</span>
                    </div>
                    <span className="currency-option-symbol">{currency.symbol}</span>
                    {selectedCurrency === currency.code && <Check size={16} className="currency-check" />}
                  </button>
                ))}
              </div>

              {selectedCurrency !== currencyCode && (
                <button className="save-btn" onClick={handleCurrencySave} disabled={saving}>
                  {saving ? <span className="spinner" /> : <Globe size={18} />}
                  Save Currency ({selectedCurrency})
                </button>
              )}
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
                <label htmlFor="currentPassword"><Lock size={16} /> Current Password</label>
                <input type="password" id="currentPassword" value={passwordData.currentPassword} onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })} placeholder="Enter current password" />
              </div>
              <div className="form-group">
                <label htmlFor="newPassword"><Lock size={16} /> New Password</label>
                <input type="password" id="newPassword" value={passwordData.newPassword} onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })} placeholder="Enter new password" />
              </div>
              <div className="form-group">
                <label htmlFor="confirmPassword"><Lock size={16} /> Confirm New Password</label>
                <input type="password" id="confirmPassword" value={passwordData.confirmPassword} onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} placeholder="Confirm new password" />
              </div>
              <button className="save-btn" onClick={handlePasswordChange} disabled={saving}>
                {saving ? <span className="spinner" /> : <Shield size={18} />}
                Update Password
              </button>
            </div>
            <div className="danger-zone">
              <div className="section-header">
                <h2>Danger Zone</h2>
                <p>Permanently delete your account and all associated data.</p>
              </div>
              <button className="delete-btn"><Trash2 size={18} /> Delete Account</button>
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
              {[
                { key: 'budgetAlerts', title: 'Budget Alerts', desc: "Get notified when you're approaching your budget limits" },
                { key: 'weeklyReport', title: 'Weekly Summary', desc: 'Receive a weekly summary of your spending' },
                { key: 'monthlyReport', title: 'Monthly Report', desc: 'Get a detailed monthly financial report' },
              ].map(({ key, title, desc }) => (
                <div key={key} className="notification-item">
                  <div className="notification-info">
                    <span className="notification-title">{title}</span>
                    <span className="notification-desc">{desc}</span>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" checked={notifications[key]} onChange={(e) => setNotifications({ ...notifications, [key]: e.target.checked })} />
                    <span className="toggle-slider" />
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
