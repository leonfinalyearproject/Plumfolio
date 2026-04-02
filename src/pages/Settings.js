import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { User, Mail, Lock, Bell, Shield, Trash2, Save, Globe, Check } from 'lucide-react';
import './Settings.css';

const Settings = () => {
  const { user, updateProfile, updatePassword } = useAuth();
  const { currency, updateCurrency, currencies, currencyInfo } = useCurrency();
  const [activeTab, setActiveTab] = useState('profile');
  const [profileData, setProfileData] = useState({
    fullName: user?.user_metadata?.full_name || '',
    email: user?.email || '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '', newPassword: '', confirmPassword: '',
  });
  const [notifications, setNotifications] = useState({
    budgetAlerts: true, weeklyReport: false, monthlyReport: true,
  });
  const [currencySearch, setCurrencySearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const showMsg = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleProfileSave = async () => {
    setSaving(true);
    try {
      if (updateProfile) await updateProfile({ full_name: profileData.fullName });
      showMsg('success', 'Profile updated successfully');
    } catch { showMsg('error', 'Failed to update profile'); }
    finally { setSaving(false); }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) { showMsg('error', 'Passwords do not match'); return; }
    if (passwordData.newPassword.length < 6) { showMsg('error', 'Password must be at least 6 characters'); return; }
    setSaving(true);
    try {
      if (updatePassword) { const { error } = await updatePassword(passwordData.newPassword); if (error) throw error; }
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showMsg('success', 'Password changed successfully');
    } catch { showMsg('error', 'Failed to change password'); }
    finally { setSaving(false); }
  };

  const handleCurrencySelect = async (code) => {
    await updateCurrency(code);
    showMsg('success', `Currency changed to ${code}`);
  };

  const filteredCurrencies = currencies.filter(c =>
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
          <button key={tab.id} className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            <tab.icon size={18} /><span>{tab.label}</span>
          </button>
        ))}
      </div>

      {message.text && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="settings-content">
        {activeTab === 'profile' && (
          <div className="settings-section">
            <div className="section-header"><h2>Profile Information</h2><p>Update your personal information and email address.</p></div>
            <div className="settings-form">
              <div className="form-group"><label htmlFor="fullName"><User size={16} /> Full Name</label><input type="text" id="fullName" value={profileData.fullName} onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })} placeholder="Your full name" /></div>
              <div className="form-group"><label htmlFor="email"><Mail size={16} /> Email Address</label><input type="email" id="email" value={profileData.email} onChange={(e) => setProfileData({ ...profileData, email: e.target.value })} placeholder="you@example.com" /></div>
              <button className="save-btn" onClick={handleProfileSave} disabled={saving}>{saving ? <span className="spinner" /> : <Save size={18} />} Save Changes</button>
            </div>
          </div>
        )}

        {activeTab === 'currency' && (
          <div className="settings-section">
            <div className="section-header"><h2>Currency Settings</h2><p>Choose your preferred currency. All amounts across the app will update.</p></div>

            <div className="current-currency-card">
              <div className="current-currency-left">
                <span className="current-currency-flag">{currencyInfo.flag}</span>
                <div className="current-currency-text">
                  <span className="current-currency-code">{currency}</span>
                  <span className="current-currency-name">{currencyInfo.name}</span>
                </div>
              </div>
              <span className="current-currency-symbol">{currencyInfo.symbol}</span>
            </div>

            <div className="currency-search-wrap">
              <input type="text" className="currency-search" placeholder="Search currencies..." value={currencySearch} onChange={(e) => setCurrencySearch(e.target.value)} />
            </div>

            <div className="currency-grid">
              {filteredCurrencies.map((c) => (
                <button key={c.code} className={`currency-option ${currency === c.code ? 'selected' : ''}`} onClick={() => handleCurrencySelect(c.code)}>
                  <span className="currency-option-flag">{c.flag}</span>
                  <div className="currency-option-info">
                    <span className="currency-option-code">{c.code}</span>
                    <span className="currency-option-name">{c.name}</span>
                  </div>
                  <span className="currency-option-symbol">{c.symbol}</span>
                  {currency === c.code && <Check size={16} className="currency-check" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="settings-section">
            <div className="section-header"><h2>Change Password</h2><p>Update your password to keep your account secure.</p></div>
            <div className="settings-form">
              <div className="form-group"><label htmlFor="currentPassword"><Lock size={16} /> Current Password</label><input type="password" id="currentPassword" value={passwordData.currentPassword} onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })} placeholder="Enter current password" /></div>
              <div className="form-group"><label htmlFor="newPassword"><Lock size={16} /> New Password</label><input type="password" id="newPassword" value={passwordData.newPassword} onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })} placeholder="Enter new password" /></div>
              <div className="form-group"><label htmlFor="confirmPassword"><Lock size={16} /> Confirm New Password</label><input type="password" id="confirmPassword" value={passwordData.confirmPassword} onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} placeholder="Confirm new password" /></div>
              <button className="save-btn" onClick={handlePasswordChange} disabled={saving}>{saving ? <span className="spinner" /> : <Shield size={18} />} Update Password</button>
            </div>
            <div className="danger-zone">
              <div className="section-header"><h2>Danger Zone</h2><p>Permanently delete your account and all associated data.</p></div>
              <button className="delete-btn"><Trash2 size={18} /> Delete Account</button>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="settings-section">
            <div className="section-header"><h2>Notification Preferences</h2><p>Choose what notifications you want to receive.</p></div>
            <div className="notification-options">
              {[
                { key: 'budgetAlerts', title: 'Budget Alerts', desc: 'Get notified when approaching budget limits' },
                { key: 'weeklyReport', title: 'Weekly Summary', desc: 'Receive a weekly spending summary' },
                { key: 'monthlyReport', title: 'Monthly Report', desc: 'Get a detailed monthly financial report' },
              ].map(({ key, title, desc }) => (
                <div key={key} className="notification-item">
                  <div className="notification-info"><span className="notification-title">{title}</span><span className="notification-desc">{desc}</span></div>
                  <label className="toggle"><input type="checkbox" checked={notifications[key]} onChange={(e) => setNotifications({ ...notifications, [key]: e.target.checked })} /><span className="toggle-slider" /></label>
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
