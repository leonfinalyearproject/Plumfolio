import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCurrency, CURRENCIES, getCurrencyInfo } from '../context/CurrencyContext';
import { useInsights } from '../context/InsightsContext';
import { supabase } from '../lib/supabase';
import { validateFullName, validateAmount } from '../utils/validation';
import { markOnboardingComplete, clearOnboardingReplay, isOnboardingReplayRequested } from '../utils/onboardingStorage';
import {
  Sparkles, Globe, Wallet, Target, ArrowRight, ArrowLeft,
  Check, TrendingUp, TrendingDown, Loader, User, Search,
} from 'lucide-react';
import './Onboarding.css';

const STEPS = ['welcome', 'profile', 'income', 'budgets', 'transaction', 'complete'];
const STEP_LABELS = ['Welcome', 'Profile', 'Income', 'Budgets', 'Transaction', 'Done'];

const AFRICAN_CURRENCY_CODES = ['BWP', 'ZAR', 'NGN', 'KES', 'GHS', 'TZS', 'UGX', 'ZMW', 'NAD', 'MWK', 'LSL', 'SZL', 'EGP'];

const EXPENSE_CATEGORIES = [
  'Food & Dining', 'Transportation', 'Housing', 'Utilities',
  'Entertainment', 'Shopping', 'Health & Fitness', 'Education',
  'Groceries', 'Subscriptions', 'Personal Care', 'Travel',
  'Savings', 'Investments', 'Gifts & Donations', 'Other',
];

const DEFAULT_BUDGETS = [
  { category: 'Food & Dining', hint: 'Groceries & meals', pct: 0.25 },
  { category: 'Transportation', hint: 'Fuel & travel', pct: 0.15 },
  { category: 'Housing', hint: 'Rent & utilities', pct: 0.3 },
  { category: 'Entertainment', hint: 'Fun & leisure', pct: 0.1 },
  { category: 'Savings', hint: 'Monthly savings', pct: 0.2 },
];

const INCOME_PRESETS = [5000, 10000, 15000, 25000];

const OnboardingPreview = ({
  compact,
  currencyLabel,
  isLive,
  syncing,
  balance,
  budgetTotal,
  budgetRows,
  transactionCount,
  formatCurrency,
  flash,
}) => {
  const body = (
    <>
      <div className="onboarding-preview-header">
        <h3>Live preview</h3>
        <span className="onboarding-live-badge">
          <span className="dot" />
          {syncing ? 'Syncing' : isLive ? 'Live' : 'Ready'}
        </span>
      </div>

      <div className={`onboarding-preview-card ${flash ? 'updated' : ''}`}>
        <div className="onboarding-preview-label">Balance this month</div>
        <div className="onboarding-preview-balance">{formatCurrency(balance)}</div>
        <div className="onboarding-preview-label" style={{ marginTop: 8 }}>
          Currency · {currencyLabel}
        </div>
      </div>

      <div className="onboarding-preview-stats">
        <div className="onboarding-preview-stat">
          <div className="val">{budgetRows.filter((b) => b.amount > 0).length}</div>
          <div className="lbl">Budgets</div>
        </div>
        <div className="onboarding-preview-stat">
          <div className="val">{formatCurrency(budgetTotal)}</div>
          <div className="lbl">Planned</div>
        </div>
        <div className="onboarding-preview-stat">
          <div className="val">{transactionCount}</div>
          <div className="lbl">Transactions</div>
        </div>
        <div className="onboarding-preview-stat">
          <div className="val">{balance >= 0 ? '+' : '−'}</div>
          <div className="lbl">Cash flow</div>
        </div>
      </div>

      {budgetRows.some((b) => b.amount > 0) ? (
        <ul className="onboarding-preview-list">
          {budgetRows.filter((b) => b.amount > 0).map((b) => (
            <li key={b.category}>
              <span>{b.category}</span>
              <strong>{formatCurrency(b.amount)}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className="onboarding-preview-empty">Budgets you set will appear here instantly.</p>
      )}
    </>
  );

  if (compact) {
    return <div className="onboarding-preview-mobile onboarding-preview-card">{body}</div>;
  }

  return <aside className="onboarding-preview">{body}</aside>;
};

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, profile, updateProfile } = useAuth();
  const { convertToBwp, rate } = useCurrency();
  const {
    refreshInsights, transactions, budgets, isLive, syncing, dataVersion,
  } = useInsights();

  const isReplay = isOnboardingReplayRequested();
  const txPrefilled = useRef(false);
  const replayHydrated = useRef(false);

  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState('');
  const [currencySearch, setCurrencySearch] = useState('');

  const [fullName, setFullName] = useState(
    profile?.full_name || user?.user_metadata?.full_name || '',
  );
  const [currency, setCurrency] = useState(profile?.currency || 'BWP');
  const [nameError, setNameError] = useState('');

  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [incomeError, setIncomeError] = useState('');

  const [budgetRows, setBudgetRows] = useState(() =>
    DEFAULT_BUDGETS.map((b) => ({ ...b, amount: 0 })),
  );
  const [budgetsSaved, setBudgetsSaved] = useState(false);

  const [txType, setTxType] = useState('income');
  const [txAmount, setTxAmount] = useState('');
  const [txDescription, setTxDescription] = useState('Salary');
  const [txCategory, setTxCategory] = useState('Food & Dining');
  const [txError, setTxError] = useState('');
  const [txSaved, setTxSaved] = useState(false);

  const step = STEPS[stepIndex];
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const currencyInfo = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];

  const previewFormat = useCallback((amount) => {
    const n = parseFloat(amount) || 0;
    const info = getCurrencyInfo(currency);
    const noDecimals = info.code === 'JPY' || info.code === 'UGX';
    const sign = n < 0 ? '−' : '';
    const abs = Math.abs(n);
    const formatted = noDecimals
      ? Math.round(abs).toLocaleString()
      : abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${sign}${info.symbol}${formatted}`;
  }, [currency]);

  const previewBalance = useMemo(() => {
    const income = parseFloat(monthlyIncome) || 0;
    const tx = txSaved && txAmount ? parseFloat(txAmount) : 0;

    if (!isReplay && transactions?.length > 0) {
      return (transactions || []).reduce((sum, t) => {
        const amt = parseFloat(t.amount) || 0;
        return sum + (t.type === 'income' ? amt : -amt);
      }, 0);
    }

    if (txType === 'income') return income + tx;
    return income - tx;
  }, [monthlyIncome, txAmount, txType, txSaved, transactions, isReplay]);

  const previewTransactionCount = isReplay
    ? (txSaved ? 1 : 0)
    : (transactions?.length || (txSaved ? 1 : 0));

  const budgetTotal = useMemo(
    () => budgetRows.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0),
    [budgetRows],
  );

  const transactionCount = previewTransactionCount;

  const filteredCurrencies = useMemo(() => {
    const q = currencySearch.trim().toLowerCase();
    if (!q) return CURRENCIES;
    return CURRENCIES.filter((c) =>
      c.name.toLowerCase().includes(q)
      || c.code.toLowerCase().includes(q)
      || c.symbol.toLowerCase().includes(q),
    );
  }, [currencySearch]);

  const africanCurrencies = filteredCurrencies.filter(
    (c) => AFRICAN_CURRENCY_CODES.includes(c.code) && (currencySearch || c.code !== currency),
  );
  const internationalCurrencies = filteredCurrencies.filter(
    (c) => !AFRICAN_CURRENCY_CODES.includes(c.code) && (currencySearch || c.code !== currency),
  );

  const triggerFlash = useCallback(() => {
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    triggerFlash();
  }, [stepIndex, currency, monthlyIncome, budgetRows, txAmount, dataVersion, triggerFlash]);

  useEffect(() => {
    if (profile?.full_name && !isReplay) setFullName(profile.full_name);
    if (profile?.currency) setCurrency(profile.currency);
  }, [profile, isReplay]);

  useEffect(() => {
    if (!isReplay || replayHydrated.current) return;

    const month = new Date().toISOString().slice(0, 7);
    const currentBudgets = (budgets || []).filter((b) => b.month_year === month);

    if (currentBudgets.length > 0) {
      setBudgetRows(currentBudgets.map((b) => ({
        category: b.category,
        hint: 'Your current budget',
        pct: 0,
        amount: parseFloat(b.allocated) || 0,
      })));
    }

    if ((transactions || []).length > 0) {
      const incomeTx = transactions.find((t) => t.type === 'income');
      if (incomeTx) {
        const bwpAmt = parseFloat(incomeTx.amount) || 0;
        const displayAmt = rate ? bwpAmt * rate : bwpAmt;
        setMonthlyIncome(String(Math.round(displayAmt)));
        setTxType('income');
        setTxDescription(incomeTx.description || 'Income');
      }
    }

    replayHydrated.current = true;
  }, [isReplay, budgets, transactions, rate]);

  useEffect(() => {
    if (step !== 'transaction' || isReplay || txPrefilled.current) return;
    if (monthlyIncome) {
      setTxType('income');
      setTxAmount(monthlyIncome);
      setTxDescription('Salary');
      txPrefilled.current = true;
    }
  }, [step, monthlyIncome, isReplay]);

  const applyIncomeToBudgets = (incomeVal) => {
    const n = parseFloat(incomeVal);
    if (!n || n <= 0) return;
    setBudgetRows((rows) =>
      rows.map((r) => ({
        ...r,
        amount: Math.round(n * r.pct),
      })),
    );
  };

  const handleIncomeChange = (val) => {
    setMonthlyIncome(val);
    setIncomeError('');
    if (val && !isNaN(parseFloat(val))) {
      applyIncomeToBudgets(val);
    }
  };

  const saveProfile = async () => {
    const nameErr = validateFullName(fullName);
    if (nameErr) {
      setNameError(nameErr);
      return false;
    }
    setNameError('');
    if (isReplay) return true;

    setSaving(true);
    setError('');
    const { error: err } = await updateProfile({
      full_name: fullName.trim(),
      currency,
    });
    setSaving(false);
    if (err) {
      setError('Could not save your profile. Please try again.');
      return false;
    }
    return true;
  };

  const saveBudgets = async () => {
    if (isReplay) return true;

    const month = new Date().toISOString().slice(0, 7);
    const toInsert = budgetRows
      .filter((b) => parseFloat(b.amount) > 0)
      .map((b) => ({
        user_id: user.id,
        category: b.category,
        allocated: parseFloat(b.amount),
        month_year: month,
      }));

    if (toInsert.length === 0) return true;

    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('budgets').insert(toInsert);
    setSaving(false);
    if (err) {
      setError('Could not create budgets. Please try again.');
      return false;
    }
    setBudgetsSaved(true);
    if (refreshInsights) refreshInsights();
    return true;
  };

  const saveTransaction = async () => {
    if (!txAmount) return true;
    if (isReplay) {
      setTxSaved(true);
      return true;
    }

    const amtErr = validateAmount(txAmount);
    if (amtErr) {
      setTxError(amtErr);
      return false;
    }
    if (!txDescription.trim()) {
      setTxError('Add a short description');
      return false;
    }

    setSaving(true);
    setError('');
    const bwpAmount = convertToBwp(parseFloat(txAmount), currency);
    const { error: err } = await supabase.from('transactions').insert([{
      user_id: user.id,
      type: txType,
      amount: bwpAmount,
      description: txDescription.trim(),
      category: txType === 'income' ? 'Income' : txCategory,
      date: new Date().toISOString().split('T')[0],
    }]);
    setSaving(false);
    if (err) {
      setTxError('Could not save transaction. Please try again.');
      return false;
    }
    setTxSaved(true);
    if (refreshInsights) refreshInsights();
    return true;
  };

  const finishOnboarding = () => {
    markOnboardingComplete(user.id, {
      currency: isReplay ? (profile?.currency || currency) : currency,
      budgets: isReplay ? (budgets?.length || 0) : budgetRows.filter((b) => b.amount > 0).length,
      transaction: isReplay ? ((transactions?.length || 0) > 0) : txSaved,
      replay: isReplay,
    });
    clearOnboardingReplay();
    navigate('/dashboard');
  };

  const goNext = async () => {
    setError('');

    if (step === 'profile') {
      const ok = await saveProfile();
      if (!ok) return;
    }
    if (step === 'income') {
      if (monthlyIncome) {
        const err = validateAmount(monthlyIncome);
        if (err) { setIncomeError(err); return; }
      }
    }
    if (step === 'budgets') {
      const ok = await saveBudgets();
      if (!ok) return;
    }
    if (step === 'transaction') {
      const ok = await saveTransaction();
      if (!ok) return;
    }
    if (step === 'complete') {
      finishOnboarding();
      return;
    }

    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setError('');
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const skipTransaction = () => {
    setTxAmount('');
    setTxError('');
    setStepIndex(STEPS.indexOf('complete'));
  };

  const previewProps = {
    currencyLabel: `${currencyInfo.flag} ${currencyInfo.code}`,
    isLive,
    syncing,
    balance: previewBalance,
    budgetTotal,
    budgetRows,
    transactionCount,
    formatCurrency: previewFormat,
    flash,
  };

  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return (
          <>
            <div className="onboarding-icon-wrap"><Sparkles size={22} /></div>
            <h1>Welcome{fullName ? `, ${fullName.split(' ')[0]}` : ''}!</h1>
            {isReplay ? (
              <p className="onboarding-replay-note">
                Tutorial mode — walk through the steps again. Nothing you change here will update your dashboard.
              </p>
            ) : (
              <p>
                Let&apos;s set up Plumfolio in a few quick steps. Your currency, budgets, and first
                transaction will appear on your dashboard exactly as you enter them here.
              </p>
            )}
            {!isReplay && (
              <ul className="onboarding-summary-list">
                <li><Check size={16} /> Choose your display currency</li>
                <li><Check size={16} /> Plan monthly budgets by category</li>
                <li><Check size={16} /> Log your first income or expense</li>
              </ul>
            )}
          </>
        );

      case 'profile':
        return (
          <>
            <div className="onboarding-icon-wrap"><User size={22} /></div>
            <h1>Your profile</h1>
            <p>
              {isReplay
                ? 'This is the same currency picker you will find in Settings. In tutorial mode your selection is preview only.'
                : 'Your name and currency are saved to your profile and used across the dashboard, budgets, and reports.'}
            </p>

            <div className="onboarding-field">
              <label htmlFor="ob-name">Full name</label>
              <input
                id="ob-name"
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); setNameError(''); }}
                placeholder="Your name"
                maxLength={60}
                readOnly={isReplay}
              />
              {nameError && <p className="onboarding-field-error">{nameError}</p>}
            </div>

            <div className="onboarding-icon-wrap" style={{ width: 36, height: 36, marginBottom: 10 }}>
              <Globe size={18} />
            </div>
            <p style={{ marginBottom: 12, fontSize: '0.85rem' }}>Display currency</p>

            <div className="onboarding-currency-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search currencies..."
                value={currencySearch}
                onChange={(e) => setCurrencySearch(e.target.value)}
              />
            </div>

            <div className="onboarding-currency-scroll">
              {!currencySearch && (
                <div className="onboarding-currency-group">
                  <span className="onboarding-currency-group-label">Selected</span>
                  <button
                    type="button"
                    className="onboarding-currency-card selected"
                    onClick={() => !isReplay && setCurrency(currency)}
                  >
                    <span className="flag">{currencyInfo.flag}</span>
                    <span className="code">{currencyInfo.code}</span>
                    <span className="name">{currencyInfo.name}</span>
                  </button>
                </div>
              )}

              {africanCurrencies.length > 0 && (
                <div className="onboarding-currency-group">
                  {!currencySearch && <span className="onboarding-currency-group-label">African</span>}
                  <div className="onboarding-currency-grid">
                    {africanCurrencies.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        className={`onboarding-currency-card ${currency === c.code ? 'selected' : ''}`}
                        onClick={() => !isReplay && setCurrency(c.code)}
                        disabled={isReplay}
                      >
                        <span className="flag">{c.flag}</span>
                        <span className="code">{c.code}</span>
                        <span className="name">{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {internationalCurrencies.length > 0 && (
                <div className="onboarding-currency-group">
                  {!currencySearch && <span className="onboarding-currency-group-label">International</span>}
                  <div className="onboarding-currency-grid">
                    {internationalCurrencies.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        className={`onboarding-currency-card ${currency === c.code ? 'selected' : ''}`}
                        onClick={() => !isReplay && setCurrency(c.code)}
                        disabled={isReplay}
                      >
                        <span className="flag">{c.flag}</span>
                        <span className="code">{c.code}</span>
                        <span className="name">{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {filteredCurrencies.length === 0 && (
                <p className="onboarding-field-hint">No currencies match your search.</p>
              )}
            </div>

            <p className="onboarding-field-hint" style={{ marginTop: 10 }}>
              Dashboard preview: {previewFormat(1000)} · same formatting as Settings
            </p>
          </>
        );

      case 'income':
        return (
          <>
            <div className="onboarding-icon-wrap"><Wallet size={22} /></div>
            <h1>Monthly income</h1>
            <p>
              {isReplay
                ? 'In the real setup, this figure suggests budget amounts on the next step.'
                : 'Optional, but helps suggest budget amounts. Your dashboard income is calculated from transactions you log — we will pre-fill your first one on the next step.'}
            </p>

            <div className="onboarding-quick-picks">
              {INCOME_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`onboarding-chip ${parseFloat(monthlyIncome) === preset ? 'active' : ''}`}
                  onClick={() => handleIncomeChange(String(preset))}
                >
                  {currencyInfo.symbol}{preset.toLocaleString()}
                </button>
              ))}
            </div>

            <div className="onboarding-field">
              <label htmlFor="ob-income">Typical monthly income ({currency})</label>
              <input
                id="ob-income"
                type="number"
                min="0"
                step="0.01"
                value={monthlyIncome}
                onChange={(e) => handleIncomeChange(e.target.value)}
                placeholder={`e.g. 12000`}
              />
              {incomeError && <p className="onboarding-field-error">{incomeError}</p>}
            </div>

            {monthlyIncome && (
              <p className="onboarding-field-hint">
                Budget suggestions on the next step will use this figure.
              </p>
            )}
          </>
        );

      case 'budgets':
        return (
          <>
            <div className="onboarding-icon-wrap"><Target size={22} /></div>
            <h1>Your first budgets</h1>
            <p>
              {isReplay
                ? 'These categories match the Budgets page. In tutorial mode, changes are preview only.'
                : 'Same categories as your Budgets page. Amounts are created for this month when you continue.'}
            </p>

            <div className="onboarding-budget-list">
              {budgetRows.map((row, idx) => (
                <div key={row.category} className="onboarding-budget-row">
                  <div>
                    <label>{row.category}</label>
                    <span>{row.hint}</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={row.amount || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBudgetRows((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, amount: val } : r)),
                      );
                    }}
                    placeholder="0"
                    aria-label={`${row.category} budget amount`}
                  />
                </div>
              ))}
            </div>

            <div className="onboarding-budget-total">
              <span>Total planned</span>
              <strong>{previewFormat(budgetTotal)}</strong>
            </div>

            {budgetsSaved && !isReplay && (
              <p className="onboarding-field-hint onboarding-field-hint--success" style={{ marginTop: 10 }}>
                <Check size={12} /> Budgets saved — visible on your Budgets page and dashboard
              </p>
            )}
            {isReplay && (
              <p className="onboarding-field-hint" style={{ marginTop: 10 }}>
                Tutorial preview — your existing budgets on the dashboard are unchanged.
              </p>
            )}
          </>
        );

      case 'transaction':
        return (
          <>
            <div className="onboarding-icon-wrap"><TrendingUp size={22} /></div>
            <h1>First transaction</h1>
            <p>
              {isReplay
                ? 'Transactions use the same categories as the Transactions page. Tutorial mode will not create new entries.'
                : 'This is saved like any transaction on your dashboard — income updates your balance and expense categories feed your spending charts.'}
            </p>

            <div className="onboarding-type-toggle">
              <button
                type="button"
                className={`onboarding-type-btn income ${txType === 'income' ? 'active' : ''}`}
                onClick={() => setTxType('income')}
              >
                <TrendingUp size={16} /> Income
              </button>
              <button
                type="button"
                className={`onboarding-type-btn expense ${txType === 'expense' ? 'active' : ''}`}
                onClick={() => setTxType('expense')}
              >
                <TrendingDown size={16} /> Expense
              </button>
            </div>

            <div className="onboarding-field">
              <label htmlFor="ob-tx-amt">Amount ({currency})</label>
              <input
                id="ob-tx-amt"
                type="number"
                min="0"
                step="0.01"
                value={txAmount}
                onChange={(e) => { setTxAmount(e.target.value); setTxError(''); }}
                placeholder="0.00"
              />
            </div>

            <div className="onboarding-field">
              <label htmlFor="ob-tx-desc">Description</label>
              <input
                id="ob-tx-desc"
                value={txDescription}
                onChange={(e) => setTxDescription(e.target.value)}
                placeholder="e.g. Salary, Groceries"
                maxLength={100}
              />
            </div>

            {txType === 'expense' && (
              <div className="onboarding-field">
                <label htmlFor="ob-tx-cat">Category</label>
                <select
                  id="ob-tx-cat"
                  value={txCategory}
                  onChange={(e) => setTxCategory(e.target.value)}
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            )}

            {txError && <p className="onboarding-field-error">{txError}</p>}
          </>
        );

      case 'complete':
        return (
          <>
            <div className="onboarding-complete-check"><Check size={32} /></div>
            <h1>{isReplay ? 'Tutorial complete!' : 'You\'re all set!'}</h1>
            <p>
              {isReplay
                ? 'You have walked through the setup flow again. Your live dashboard data is unchanged.'
                : 'Your Plumfolio workspace is ready. Here\'s what we configured:'}
            </p>
            <ul className="onboarding-summary-list">
              <li><Check size={16} /> Currency: {currencyInfo.flag} {currencyInfo.name}</li>
              {fullName && <li><Check size={16} /> Profile: {fullName.trim()}</li>}
              {!isReplay && budgetRows.filter((b) => b.amount > 0).length > 0 && (
                <li><Check size={16} /> {budgetRows.filter((b) => b.amount > 0).length} monthly budgets on Budgets page</li>
              )}
              {!isReplay && (txSaved || transactions?.length > 0) && (
                <li><Check size={16} /> First transaction on your dashboard</li>
              )}
              {isReplay && (budgets?.length > 0) && (
                <li><Check size={16} /> Your live budgets remain on the dashboard</li>
              )}
            </ul>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="onboarding-shell">
      <div className="onboarding-main">
        <div className="onboarding-top">
          <Link to="/" className="onboarding-brand">
            <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="" />
            <span>Plumfolio</span>
          </Link>
          <span className="onboarding-step-label">
            Step {stepIndex + 1} of {STEPS.length} · {STEP_LABELS[stepIndex]}
          </span>
        </div>

        <div className="onboarding-progress" aria-hidden="true">
          <div className="onboarding-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="onboarding-steps-dots" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`onboarding-dot ${i === stepIndex ? 'active' : ''} ${i < stepIndex ? 'done' : ''}`}
            />
          ))}
        </div>

        <OnboardingPreview compact {...previewProps} />

        <div className="onboarding-content" key={step}>
          {error && (
            <div className="auth-error" role="alert" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}
          {renderStep()}

          <div className="onboarding-actions">
            {stepIndex > 0 && step !== 'complete' && (
              <button type="button" className="onboarding-btn onboarding-btn-ghost" onClick={goBack} disabled={saving}>
                <ArrowLeft size={16} /> Back
              </button>
            )}

            {step === 'transaction' && (
              <button type="button" className="onboarding-btn-text" onClick={skipTransaction} disabled={saving}>
                Skip for now
              </button>
            )}

            <button
              type="button"
              className="onboarding-btn onboarding-btn-primary"
              onClick={goNext}
              disabled={saving}
              style={{ marginLeft: 'auto' }}
            >
              {saving ? (
                <Loader size={18} className="spin" />
              ) : step === 'complete' ? (
                <>{isReplay ? 'Back to dashboard' : 'Open dashboard'} <ArrowRight size={16} /></>
              ) : step === 'transaction' && !txAmount ? (
                <>Continue <ArrowRight size={16} /></>
              ) : (
                <>Continue <ArrowRight size={16} /></>
              )}
            </button>
          </div>
        </div>
      </div>

      <OnboardingPreview {...previewProps} />
    </div>
  );
};

export default Onboarding;
