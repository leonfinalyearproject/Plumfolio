import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency, CURRENCIES } from '../context/CurrencyContext';
import { User, Mail, Lock, Bell, Shield, Trash2, Save, Globe, Check, Search } from 'lucide-react';
import './Settings.css';

const Settings = () => {
  const { user, profile, updateProfile, updatePassword } = useAuth();
  const { currencyCode, formatCurrency } = useCurrency();
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
  const [currencySearch, setCurrencySearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingCurrency, setSavingCurrency] = useState(false);
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
      return showMessage('error', 'Passwords do not match');
    }
    if (passwordData.newPassword.length < 6) {
      return showMessage('error', 'Password must be at least 6 characters');
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

  // Auto-save currency on click — instant switch
  const handleCurrencySelect = async (code) => {
    if (code === currencyCode || savingCurrency) return;
    setSavingCurrency(true);
    try {
      const { error } = await updateProfile({ currency: code });
      if (error) throw error;
      showMessage('success', `Currency switched to ${code}`);
    } catch (error) {
      showMessage('error', 'Failed to update currency');
    } finally {
      setSavingCurrency(false);
    }
  };

  const filteredCurrencies = CURRENCIES.filter(c =>
    c.name.toLowerCase().includes(currencySearch.toLowerCase()) ||
    c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
    c.symbol.toLowerCase().includes(currencySearch.toLowerCase())
  );

  // Group currencies: active first, then African, then international
  const africanCodes = ['BWP', 'ZAR', 'NGN', 'KES', 'GHS', 'TZS', 'UGX', 'ZMW', 'NAD', 'MWK', 'LSL', 'SZL', 'EGP'];
  const activeCurrency = filteredCurrencies.find(c => c.code === currencyCode);
  const africanCurrencies = filteredCurrencies.filter(c => africanCodes.includes(c.code) && c.code !== currencyCode);
  const internationalCurrencies = filteredCurrencies.filter(c => !africanCodes.includes(c.code) && c.code !== currencyCode);

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
        <div className={`settings-message ${message.type}`}>{message.text}</div>
      )}

      <div className="settings-content">
        {/* ==================== PROFILE ==================== */}
        {activeTab === 'profile' && (
          <div className="settings-section">
            <div className="section-header">
              <h2>Profile Information</h2>
              <p>Update your personal information.</p>
            </div>
            <div className="settings-form">
              <div className="form-group">
                <label><User size={14} /> Full Name</label>
                <input type="text" value={profileData.fullName} onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })} placeholder="Your full name" />
              </div>
              <div className="form-group">
                <label><Mail size={14} /> Email Address</label>
                <input type="email" value={profileData.email} disabled />
              </div>
              <button className="save-btn" onClick={handleProfileSave} disabled={saving}>
                {saving ? <span className="spinner" /> : <Save size={16} />}
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* ==================== CURRENCY ==================== */}
        {activeTab === 'currency' && (
          <div className="settings-section">
            <div className="section-header">
              <h2>Currency</h2>
              <p>Select your currency — changes apply instantly across all pages.</p>
            </div>

            {/* Preview */}
            <div className="currency-preview">
              <div className="currency-preview-amount">{formatCurrency(12345.67)}</div>
              <div className="currency-preview-label">Preview with current currency</div>
            </div>

            {/* Search */}
            <div className="currency-search-box">
              <Search size={15} />
              <input
                type="text"
                placeholder="Search by name, code, or symbol..."
                value={currencySearch}
                onChange={(e) => setCurrencySearch(e.target.value)}
              />
            </div>

            {savingCurrency && (
              <div className="currency-saving">
                <span className="spinner" /> Switching currency...
              </div>
            )}

            {/* Active currency */}
            {activeCurrency && !currencySearch && (
              <div className="currency-group">
                <div className="currency-group-label">Active</div>
                <div className="currency-list">
                  <div className="currency-item active">
                    <span className="currency-item-flag">{activeCurrency.flag}</span>
                    <div className="currency-item-info">
                      <span className="currency-item-code">{activeCurrency.code}</span>
                      <span className="currency-item-name">{activeCurrency.name}</span>
                    </div>
                    <span className="currency-item-symbol">{activeCurrency.symbol}</span>
                    <Check size={16} className="currency-item-check" />
                  </div>
                </div>
              </div>
            )}

            {/* African currencies */}
            {africanCurrencies.length > 0 && (
              <div className="currency-group">
                {!currencySearch && <div className="currency-group-label">African Currencies</div>}
                <div className="currency-list">
                  {africanCurrencies.map((c) => (
                    <button
                      key={c.code}
                      className={`currency-item ${currencyCode === c.code ? 'active' : ''}`}
                      onClick={() => handleCurrencySelect(c.code)}
                      disabled={savingCurrency}
                    >
                      <span className="currency-item-flag">{c.flag}</span>
                      <div className="currency-item-info">
                        <span className="currency-item-code">{c.code}</span>
                        <span className="currency-item-name">{c.name}</span>
                      </div>
                      <span className="currency-item-symbol">{c.symbol}</span>
                      {currencyCode === c.code && <Check size={16} className="currency-item-check" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* International currencies */}
            {internationalCurrencies.length > 0 && (
              <div className="currency-group">
                {!currencySearch && <div className="currency-group-label">International</div>}
                <div className="currency-list">
                  {internationalCurrencies.map((c) => (
                    <button
                      key={c.code}
                      className={`currency-item ${currencyCode === c.code ? 'active' : ''}`}
                      onClick={() => handleCurrencySelect(c.code)}
                      disabled={savingCurrency}
                    >
                      <span className="currency-item-flag">{c.flag}</span>
                      <div className="currency-item-info">
                        <span className="currency-item-code">{c.code}</span>
                        <span className="currency-item-name">{c.name}</span>
                      </div>
                      <span className="currency-item-symbol">{c.symbol}</span>
                      {currencyCode === c.code && <Check size={16} className="currency-item-check" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== SECURITY ==================== */}
        {activeTab === 'security' && (
          <div className="settings-section">
            <div className="section-header">
              <h2>Change Password</h2>
              <p>Keep your account secure.</p>
            </div>
            <div className="settings-form">
              <div className="form-group">
                <label><Lock size={14} /> Current Password</label>
                <input type="password" value={passwordData.currentPassword} onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })} placeholder="Enter current password" />
              </div>
              <div className="form-group">
                <label><Lock size={14} /> New Password</label>
                <input type="password" value={passwordData.newPassword} onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })} placeholder="Enter new password" />
              </div>
              <div className="form-group">
                <label><Lock size={14} /> Confirm Password</label>
                <input type="password" value={passwordData.confirmPassword} onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} placeholder="Confirm new password" />
              </div>
              <button className="save-btn" onClick={handlePasswordChange} disabled={saving}>
                {saving ? <span className="spinner" /> : <Shield size={16} />}
                Update Password
              </button>
            </div>
            <div className="danger-zone">
              <div className="section-header">
                <h2>Danger Zone</h2>
                <p>Permanently delete your account and all data.</p>
              </div>
              <button className="delete-btn"><Trash2 size={16} /> Delete Account</button>
            </div>
          </div>
        )}

        {/* ==================== NOTIFICATIONS ==================== */}
        {activeTab === 'notifications' && (
          <div className="settings-section">
            <div className="section-header">
              <h2>Notifications</h2>
              <p>Control what notifications you receive.</p>
            </div>
            <div className="notification-options">
              {[
                { key: 'budgetAlerts', title: 'Budget Alerts', desc: 'Notified when approaching budget limits' },
                { key: 'weeklyReport', title: 'Weekly Summary', desc: 'Weekly spending summary' },
                { key: 'monthlyReport', title: 'Monthly Report', desc: 'Detailed monthly financial report' },
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
