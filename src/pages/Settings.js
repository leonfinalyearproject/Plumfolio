import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency, CURRENCIES } from '../context/CurrencyContext';
import { User, Mail, Lock, Bell, Shield, Trash2, Save, Globe, Check, Search } from 'lucide-react';
import './Settings.css';

const Settings = () => {
  const { user, profile, updateProfile, updatePassword } = useAuth();
  const { currencyCode, formatCurrency, rate, ratesLoaded } = useCurrency();
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
  const [switchingTo, setSwitchingTo] = useState(null);
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
      showMessage('success', 'Profile updated');
    } catch (error) {
      showMessage('error', 'Failed: ' + error.message);
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
      showMessage('success', 'Password changed');
    } catch (error) {
      showMessage('error', 'Failed: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCurrencySelect = async (code) => {
    if (code === currencyCode || switchingTo) return;
    setSwitchingTo(code);
    try {
      const result = await updateProfile({ currency: code });
      if (result.error) {
        showMessage('error', 'Failed to switch currency');
      } else {
        showMessage('success', 'Switched to ' + code);
      }
    } catch (err) {
      showMessage('error', 'Failed to switch currency');
    } finally {
      setSwitchingTo(null);
    }
  };

  const filteredCurrencies = CURRENCIES.filter(function(c) {
    var q = currencySearch.toLowerCase();
    return c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.symbol.toLowerCase().includes(q);
  });

  var africanCodes = ['BWP','ZAR','NGN','KES','GHS','TZS','UGX','ZMW','NAD','MWK','LSL','SZL','EGP'];
  var activeCurrency = CURRENCIES.find(function(c) { return c.code === currencyCode; });
  var africanList = filteredCurrencies.filter(function(c) { return africanCodes.indexOf(c.code) >= 0 && c.code !== currencyCode; });
  var internationalList = filteredCurrencies.filter(function(c) { return africanCodes.indexOf(c.code) < 0 && c.code !== currencyCode; });

  var tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'currency', label: 'Currency', icon: Globe },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  var renderCurrencyItem = function(c) {
    var isActive = c.code === currencyCode;
    var isSwitching = c.code === switchingTo;
    return (
      <button
        key={c.code}
        className={'currency-item' + (isActive ? ' active' : '') + (isSwitching ? ' switching' : '')}
        onClick={function() { handleCurrencySelect(c.code); }}
        disabled={isActive || !!switchingTo}
      >
        <span className="currency-item-flag">{c.flag}</span>
        <div className="currency-item-info">
          <span className="currency-item-code">{c.code}</span>
          <span className="currency-item-name">{c.name}</span>
        </div>
        <span className="currency-item-symbol">{c.symbol}</span>
        {isActive && <Check size={16} className="currency-item-check" />}
        {isSwitching && <span className="spinner" style={{ width: 16, height: 16 }} />}
      </button>
    );
  };

  return (
    <div className="settings-page">
      <div className="settings-tabs">
        {tabs.map(function(tab) {
          return (
            <button key={tab.id} className={'settings-tab' + (activeTab === tab.id ? ' active' : '')} onClick={function() { setActiveTab(tab.id); }}>
              <tab.icon size={18} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {message.text && <div className={'settings-message ' + message.type}>{message.text}</div>}

      <div className="settings-content">
        {/* PROFILE */}
        {activeTab === 'profile' && (
          <div className="settings-section">
            <div className="section-header">
              <h2>Profile Information</h2>
              <p>Update your personal information.</p>
            </div>
            <div className="settings-form">
              <div className="form-group">
                <label><User size={14} /> Full Name</label>
                <input type="text" value={profileData.fullName} onChange={function(e) { setProfileData({ ...profileData, fullName: e.target.value }); }} placeholder="Your full name" />
              </div>
              <div className="form-group">
                <label><Mail size={14} /> Email Address</label>
                <input type="email" value={profileData.email} disabled />
              </div>
              <button className="save-btn" onClick={handleProfileSave} disabled={saving}>
                {saving ? <span className="spinner" /> : <Save size={16} />} Save Changes
              </button>
            </div>
          </div>
        )}

        {/* CURRENCY */}
        {activeTab === 'currency' && (
          <div className="settings-section">
            <div className="section-header">
              <h2>Currency</h2>
              <p>Tap a currency to switch. All values are converted using live exchange rates.</p>
            </div>

            <div className="currency-preview">
              <div className="currency-preview-amount">{formatCurrency(1000)}</div>
              <div className="currency-preview-label">
                P1,000.00 BWP = {formatCurrency(1000)}
              </div>
              {currencyCode !== 'BWP' && ratesLoaded && (
                <div className="currency-preview-rate">
                  Rate: 1 BWP = {rate.toFixed(4)} {currencyCode}
                </div>
              )}
            </div>

            <div className="currency-search-box">
              <Search size={15} />
              <input type="text" placeholder="Search currencies..." value={currencySearch} onChange={function(e) { setCurrencySearch(e.target.value); }} />
            </div>

            {!currencySearch && activeCurrency && (
              <div className="currency-group">
                <div className="currency-group-label">Current</div>
                <div className="currency-list">{renderCurrencyItem(activeCurrency)}</div>
              </div>
            )}

            {africanList.length > 0 && (
              <div className="currency-group">
                {!currencySearch && <div className="currency-group-label">African</div>}
                <div className="currency-list">{africanList.map(renderCurrencyItem)}</div>
              </div>
            )}

            {internationalList.length > 0 && (
              <div className="currency-group">
                {!currencySearch && <div className="currency-group-label">International</div>}
                <div className="currency-list">{internationalList.map(renderCurrencyItem)}</div>
              </div>
            )}
          </div>
        )}

        {/* SECURITY */}
        {activeTab === 'security' && (
          <div className="settings-section">
            <div className="section-header">
              <h2>Change Password</h2>
              <p>Keep your account secure.</p>
            </div>
            <div className="settings-form">
              <div className="form-group">
                <label><Lock size={14} /> Current Password</label>
                <input type="password" value={passwordData.currentPassword} onChange={function(e) { setPasswordData({ ...passwordData, currentPassword: e.target.value }); }} placeholder="Current password" />
              </div>
              <div className="form-group">
                <label><Lock size={14} /> New Password</label>
                <input type="password" value={passwordData.newPassword} onChange={function(e) { setPasswordData({ ...passwordData, newPassword: e.target.value }); }} placeholder="New password" />
              </div>
              <div className="form-group">
                <label><Lock size={14} /> Confirm Password</label>
                <input type="password" value={passwordData.confirmPassword} onChange={function(e) { setPasswordData({ ...passwordData, confirmPassword: e.target.value }); }} placeholder="Confirm password" />
              </div>
              <button className="save-btn" onClick={handlePasswordChange} disabled={saving}>
                {saving ? <span className="spinner" /> : <Shield size={16} />} Update Password
              </button>
            </div>
            <div className="danger-zone">
              <div className="section-header"><h2>Danger Zone</h2><p>Permanently delete your account.</p></div>
              <button className="delete-btn"><Trash2 size={16} /> Delete Account</button>
            </div>
          </div>
        )}

        {/* NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="settings-section">
            <div className="section-header">
              <h2>Notifications</h2>
              <p>Control what you receive.</p>
            </div>
            <div className="notification-options">
              {[
                { key: 'budgetAlerts', title: 'Budget Alerts', desc: 'When approaching budget limits' },
                { key: 'weeklyReport', title: 'Weekly Summary', desc: 'Weekly spending overview' },
                { key: 'monthlyReport', title: 'Monthly Report', desc: 'Detailed monthly report' },
              ].map(function(item) {
                return (
                  <div key={item.key} className="notification-item">
                    <div className="notification-info">
                      <span className="notification-title">{item.title}</span>
                      <span className="notification-desc">{item.desc}</span>
                    </div>
                    <label className="toggle">
                      <input type="checkbox" checked={notifications[item.key]} onChange={function(e) { setNotifications({ ...notifications, [item.key]: e.target.checked }); }} />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
