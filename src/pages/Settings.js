import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency, CURRENCIES } from '../context/CurrencyContext';
import { useInsights } from '../context/InsightsContext';
import { supabase } from '../lib/supabase';
import { validateFullName, validateEmail } from '../utils/validation';
import { User, Mail, Lock, Shield, Trash2, Save, Globe, Check, Search, KeyRound } from 'lucide-react';
import './Settings.css';

const Settings = () => {
  const { user, profile, updateProfile } = useAuth();
  const { currencyCode, formatCurrency, rate, ratesLoaded } = useCurrency();
  const { addToast } = useInsights();
  const [activeTab, setActiveTab] = useState('profile');
  const [profileData, setProfileData] = useState({
    fullName: user?.user_metadata?.full_name || profile?.full_name || '',
    email: user?.email || '',
  });
  const [profileError, setProfileError] = useState('');
  const [resetEmail, setResetEmail] = useState(user?.email || '');
  const [resetEmailError, setResetEmailError] = useState('');
  const [currencySearch, setCurrencySearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [switchingTo, setSwitchingTo] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [resetSent, setResetSent] = useState(false);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const handleProfileSave = async () => {
    const nameError = validateFullName(profileData.fullName);
    if (nameError) {
      setProfileError(nameError);
      return;
    }
    setProfileError('');
    setSaving(true);
    try {
      const { error } = await updateProfile({ full_name: profileData.fullName.trim() });
      if (error) throw error;
      showMessage('success', 'Profile updated');
      if (addToast) addToast({ type: 'success', title: 'Profile Updated', message: 'Your profile changes have been saved.' });
    } catch (error) {
      showMessage('error', 'Failed: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    const emailError = validateEmail(resetEmail);
    if (emailError) {
      setResetEmailError(emailError);
      return;
    }
    setResetEmailError('');
    setSaving(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin + '/Plumfolio/reset-password',
      });
      if (error) throw error;
      setResetSent(true);
      showMessage('success', 'Password reset link sent! Check your email.');
      if (addToast) addToast({ type: 'info', title: 'Reset Link Sent', message: `Password reset email sent to ${resetEmail}.` });
    } catch (error) {
      showMessage('error', 'Failed to send reset email: ' + error.message);
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
        if (addToast) addToast({ type: 'success', title: 'Currency Changed', message: `All amounts now display in ${code}.` });
      }
    } catch (err) {
      showMessage('error', 'Failed to switch currency');
    } finally {
      setSwitchingTo(null);
    }
  };

  const filteredCurrencies = CURRENCIES.filter(c => {
    const q = currencySearch.toLowerCase();
    return c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.symbol.toLowerCase().includes(q);
  });

  const africanCodes = ['BWP','ZAR','NGN','KES','GHS','TZS','UGX','ZMW','NAD','MWK','LSL','SZL','EGP'];
  const activeCurrency = CURRENCIES.find(c => c.code === currencyCode);
  const africanList = filteredCurrencies.filter(c => africanCodes.includes(c.code) && c.code !== currencyCode);
  const internationalList = filteredCurrencies.filter(c => !africanCodes.includes(c.code) && c.code !== currencyCode);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'currency', label: 'Currency', icon: Globe },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  const renderCurrencyItem = (c) => {
    const isActive = c.code === currencyCode;
    const isSwitching = c.code === switchingTo;
    return (
      <button
        key={c.code}
        className={'currency-item' + (isActive ? ' active' : '') + (isSwitching ? ' switching' : '')}
        onClick={() => handleCurrencySelect(c.code)}
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
        {tabs.map(tab => (
          <button key={tab.id} className={'settings-tab' + (activeTab === tab.id ? ' active' : '')} onClick={() => setActiveTab(tab.id)}>
            <tab.icon size={18} />
            <span>{tab.label}</span>
          </button>
        ))}
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
              <div className={`form-group ${profileError ? 'has-error' : ''}`}>
                <label><User size={14} /> Full Name</label>
                <input type="text" value={profileData.fullName} onChange={(e) => { setProfileData({ ...profileData, fullName: e.target.value }); if (profileError) setProfileError(''); }} placeholder="Your full name" maxLength={60} />
                {profileError ? <span className="field-error">{profileError}</span> : <span className="field-hint">Letters, spaces, hyphens and apostrophes only</span>}
              </div>
              <div className="form-group">
                <label><Mail size={14} /> Email Address</label>
                <input type="email" value={profileData.email} disabled />
                <span className="field-hint">Email cannot be changed here</span>
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
              <input type="text" placeholder="Search currencies..." value={currencySearch} onChange={(e) => setCurrencySearch(e.target.value)} />
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

        {/* SECURITY — Forgot Password */}
        {activeTab === 'security' && (
          <div className="settings-section">
            <div className="section-header">
              <h2>Password & Security</h2>
              <p>Reset your password via email.</p>
            </div>

            {!resetSent ? (
              <div className="settings-form">
                <div className="reset-info">
                  <KeyRound size={32} className="reset-icon" />
                  <p>We'll send a password reset link to your email. Click the link in the email to set a new password.</p>
                </div>
                <div className={`form-group ${resetEmailError ? 'has-error' : ''}`}>
                  <label><Mail size={14} /> Email Address</label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => { setResetEmail(e.target.value); if (resetEmailError) setResetEmailError(''); }}
                    placeholder="your@email.com"
                    maxLength={254}
                  />
                  {resetEmailError ? <span className="field-error">{resetEmailError}</span> : <span className="field-hint">We'll send a secure reset link to this email</span>}
                </div>
                <button className="save-btn" onClick={handlePasswordReset} disabled={saving}>
                  {saving ? <span className="spinner" /> : <Mail size={16} />} Send Reset Link
                </button>
              </div>
            ) : (
              <div className="reset-sent">
                <div className="reset-sent-icon">✓</div>
                <h3>Reset Link Sent!</h3>
                <p>Check your email at <strong>{resetEmail}</strong> for the password reset link. It may take a minute to arrive.</p>
                <button className="save-btn outline" onClick={() => setResetSent(false)}>
                  Send Again
                </button>
              </div>
            )}

            <div className="danger-zone">
              <div className="section-header"><h2>Danger Zone</h2><p>Permanently delete your account and all data.</p></div>
              <button className="delete-btn"><Trash2 size={16} /> Delete Account</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
