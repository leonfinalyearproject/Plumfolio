import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency, CURRENCIES } from '../context/CurrencyContext';
import { useInsights } from '../context/InsightsContext';
import { supabase } from '../lib/supabase';
import { validateFullName, validateEmail } from '../utils/validation';
import { User, Mail, Lock, Shield, Trash2, Save, Globe, Check, Search, KeyRound, Activity, ScanLine, LayoutDashboard } from 'lucide-react';
import './Settings.css';

const Settings = () => {
  const { user, profile, updateProfile, signOut } = useAuth();
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
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteTyped, setDeleteTyped] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (deleteTyped !== 'DELETE') return;
    setDeleting(true);
    try {
      const uid = user.id;
      // Delete all user data from every app table.
      // Supabase client returns { error } rather than throwing, so we check each.
      const deletes = await Promise.all([
        supabase.from('transactions').delete().eq('user_id', uid),
        supabase.from('budgets').delete().eq('user_id', uid),
        supabase.from('savings_goals').delete().eq('user_id', uid),
        supabase.from('scan_usage').delete().eq('user_id', uid),
        supabase.from('profiles').delete().eq('id', uid),
      ]);
      const firstError = deletes.find(r => r.error);
      if (firstError) {
        console.error('Delete error:', firstError.error);
      }
      // Attempt to call server-side function to remove the auth user (optional)
      try { await supabase.rpc('delete_own_account'); } catch (_) {}
      // Clear any local storage scoped to this user
      Object.keys(localStorage)
        .filter(k => k.includes(uid) || k.startsWith('plumfolio:'))
        .forEach(k => localStorage.removeItem(k));
      // Sign out
      await signOut();
      // Force redirect to sign-in page (respects GitHub Pages basename)
      window.location.href = (process.env.PUBLIC_URL || '') + '/signin';
    } catch (err) {
      console.error('Account deletion failed:', err);
      if (addToast) addToast({ type: 'warning', title: 'Deletion Failed', message: err.message || 'Something went wrong. Please try again.' });
      setDeleting(false);
    }
  };

  // Dashboard preferences (stored in localStorage, scoped per user).
  // `showAllTimeNet` controls whether the all-time net sub-label is shown on
  // the Balance card. Default: off, since the card is primarily month-focused.
  const dashPrefsKey = user ? `plumfolio:dashboardPrefs:${user.id}` : null;
  const [showAllTimeNet, setShowAllTimeNet] = useState(false);
  useEffect(() => {
    if (!dashPrefsKey) return;
    try {
      const raw = localStorage.getItem(dashPrefsKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setShowAllTimeNet(!!parsed.showAllTimeNet);
      }
    } catch (_) { /* ignore parse errors */ }
  }, [dashPrefsKey]);

  const toggleShowAllTimeNet = () => {
    const next = !showAllTimeNet;
    setShowAllTimeNet(next);
    if (dashPrefsKey) {
      try {
        localStorage.setItem(dashPrefsKey, JSON.stringify({ showAllTimeNet: next }));
      } catch (_) { /* ignore quota errors */ }
    }
  };

  // AI scan usage — mirror of the logic in Transactions.js. We query
  // scan_usage directly (RLS already restricts to the current user) and
  // compute hours remaining until the next Pacific-midnight quota reset.
  const AI_SCANS_PER_DAY = 50;
  const [aiScansToday, setAiScansToday] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [nowTick, setNowTick] = useState(Date.now());

  const lastPacificMidnightIso = () => {
    const now = new Date();
    const pacificDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now);
    const probe = new Date(`${pacificDate}T00:00:00-08:00`);
    const probeHour = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      hour: '2-digit', hourCycle: 'h23',
    }).format(probe);
    if (probeHour !== '00') {
      return new Date(`${pacificDate}T00:00:00-07:00`).toISOString();
    }
    return probe.toISOString();
  };

  const resetCountdown = () => {
    const next = new Date(lastPacificMidnightIso());
    next.setUTCDate(next.getUTCDate() + 1);
    const diffMs = next.getTime() - nowTick;
    if (diffMs <= 0) return 'soon';
    const hours = Math.floor(diffMs / 3_600_000);
    const mins = Math.floor((diffMs % 3_600_000) / 60_000);
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  };

  useEffect(() => {
    if (activeTab !== 'usage' || !user) return;
    const fetch = async () => {
      try {
        const midnight = lastPacificMidnightIso();
        const { count } = await supabase
          .from('scan_usage')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', midnight);
        setAiScansToday(count ?? 0);
        const { data } = await supabase
          .from('scan_usage')
          .select('created_at, confidence, succeeded')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);
        setRecentScans(data || []);
      } catch (e) {
        console.warn('Failed to load scan usage:', e?.message);
        setAiScansToday(0);
      }
    };
    fetch();
    const id = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(id);
  }, [activeTab, user]);

  const aiScansRemaining = aiScansToday === null ? null : Math.max(0, AI_SCANS_PER_DAY - aiScansToday);
  const usagePct = aiScansToday === null ? 0 : Math.min(100, (aiScansToday / AI_SCANS_PER_DAY) * 100);


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
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'currency', label: 'Currency', icon: Globe },
    { id: 'usage', label: 'Usage', icon: Activity },
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

        {/* DASHBOARD PREFERENCES */}
        {activeTab === 'dashboard' && (
          <div className="settings-section">
            <div className="section-header">
              <h2>Dashboard Preferences</h2>
              <p>Customize what appears on your dashboard.</p>
            </div>
            <div className="settings-form">
              <button
                type="button"
                className="pref-toggle-row"
                onClick={toggleShowAllTimeNet}
                aria-pressed={showAllTimeNet}
              >
                <div className="pref-toggle-text">
                  <span className="pref-toggle-label">Show all-time net on balance card</span>
                  <span className="pref-toggle-hint">Displays your all-time net (income − expenses) as a sub-label under this month's balance. Off by default so the card stays focused on the current month.</span>
                </div>
                <span className={'pref-toggle-switch' + (showAllTimeNet ? ' on' : '')}>
                  <span className="pref-toggle-knob" />
                </span>
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

        {/* USAGE — AI scan credits tracker */}
        {activeTab === 'usage' && (
          <div className="settings-section">
            <div className="section-header">
              <h2>AI Scan Credits</h2>
              <p>Plumfolio uses its built-in AI to read tricky receipts. You get 50 AI scans per day — regular (Tesseract) scanning is always unlimited and free.</p>
            </div>

            {aiScansToday === null ? (
              <div style={{ color: 'var(--text-secondary)', padding: 16 }}>Loading usage…</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Big credit counter */}
                <div style={{
                  background: aiScansRemaining === 0 ? 'rgba(239,68,68,0.08)'
                              : aiScansRemaining <= 10 ? 'rgba(245,158,11,0.08)'
                              : 'rgba(168,85,247,0.06)',
                  border: `1px solid ${aiScansRemaining === 0 ? 'rgba(239,68,68,0.25)'
                              : aiScansRemaining <= 10 ? 'rgba(245,158,11,0.25)'
                              : 'rgba(168,85,247,0.18)'}`,
                  borderRadius: 12,
                  padding: '18px 20px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                        AI Scans Remaining Today
                      </div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 700, color: aiScansRemaining === 0 ? '#EF4444' : aiScansRemaining <= 10 ? '#F59E0B' : 'var(--text-primary)' }}>
                        {aiScansRemaining} <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-muted)' }}>of {AI_SCANS_PER_DAY}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <div>Resets in <strong style={{ color: 'var(--text-primary)' }}>{resetCountdown()}</strong></div>
                      <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: 2 }}>Midnight Pacific time</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${usagePct}%`,
                      height: '100%',
                      background: aiScansRemaining === 0 ? '#EF4444' : aiScansRemaining <= 10 ? '#F59E0B' : '#A855F7',
                      transition: 'width 400ms ease',
                    }} />
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>
                    Used {aiScansToday} today
                  </div>
                </div>

                {/* How it works explainer */}
                <div style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: 12,
                  padding: '14px 18px',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--text-primary)', fontWeight: 600 }}>
                    <ScanLine size={15} /> How scanning works
                  </div>
                  Every receipt you scan is first processed locally on your device with Tesseract OCR — that's fast, free, and doesn't count toward any limit. If the local scan can't read the receipt confidently (crumpled, angled, faded), Plumfolio automatically falls back to its AI engine for better accuracy. Only the AI fallback counts as a credit. When you're out of AI credits, scanning still works — it just uses local OCR only.
                </div>

                {/* Recent scans list */}
                {recentScans.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                      Recent AI scans
                    </div>
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' }}>
                      {recentScans.map((s, i) => {
                        const dt = new Date(s.created_at);
                        const when = dt.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                        const confColor = s.confidence === 'high' ? '#22C55E' : s.confidence === 'medium' ? '#F59E0B' : s.confidence === 'low' ? '#F59E0B' : '#9CA3AF';
                        return (
                          <div key={i} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 14px',
                            borderTop: i === 0 ? 'none' : '1px solid var(--border-color)',
                            fontSize: '0.8rem',
                          }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{when}</span>
                            <span style={{
                              color: confColor,
                              fontSize: '0.72rem',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              fontWeight: 600,
                            }}>
                              {s.confidence || 'unknown'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
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
              {!deleteConfirm ? (
                <button className="delete-btn" onClick={() => setDeleteConfirm(true)}>
                  <Trash2 size={16} /> Delete Account
                </button>
              ) : (
                <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '16px 20px' }}>
                  <p style={{ color: '#EF4444', fontWeight: 600, marginBottom: 8, fontSize: '0.9rem' }}>
                    This action is irreversible. All your transactions, budgets, and goals will be permanently deleted.
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: 12 }}>
                    Type <strong style={{ color: '#EF4444' }}>DELETE</strong> to confirm:
                  </p>
                  <input
                    type="text"
                    value={deleteTyped}
                    onChange={e => setDeleteTyped(e.target.value)}
                    placeholder="Type DELETE"
                    autoComplete="off"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 6,
                      padding: '8px 12px',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      fontFamily: 'inherit',
                      width: '100%',
                      marginBottom: 12,
                    }}
                  />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      className="delete-btn"
                      disabled={deleteTyped !== 'DELETE' || deleting}
                      onClick={handleDeleteAccount}
                      style={{ opacity: deleteTyped !== 'DELETE' ? 0.5 : 1 }}
                    >
                      {deleting ? 'Deleting...' : 'Permanently Delete My Account'}
                    </button>
                    <button
                      className="save-btn outline"
                      onClick={() => { setDeleteConfirm(false); setDeleteTyped(''); }}
                      style={{ marginLeft: 'auto' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
