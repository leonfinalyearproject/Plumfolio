import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateSignInForm } from '../utils/validation';
import { AlertCircle } from 'lucide-react';
import AuthField from '../components/AuthField';
import './Auth.css';

const SignIn = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const navigate = useNavigate();
  const { signIn, user } = useAuth();

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  const { isValid: formReady } = useMemo(
    () => validateSignInForm({ email: formData.email.trim(), password: formData.password }),
    [formData.email, formData.password],
  );

  const validateField = (name, value) => {
    const result = validateSignInForm({
      email: name === 'email' ? value.trim() : formData.email.trim(),
      password: name === 'password' ? value : formData.password,
    });
    return result.errors[name] || '';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setServerError('');
    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
  };

  const validateAll = () => {
    const result = validateSignInForm({
      email: formData.email.trim(),
      password: formData.password,
    });
    setErrors(result.errors);
    setTouched({ email: true, password: true });
    return result.isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateAll()) return;

    setLoading(true);
    setServerError('');

    const { error } = await signIn(formData.email.trim(), formData.password);
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setServerError('Invalid email or password. Double-check your details and try again.');
      } else if (error.message.includes('Email not confirmed')) {
        setServerError('Please verify your email before signing in. Check your inbox for the verification link.');
      } else {
        setServerError(error.message);
      }
      setLoading(false);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="auth-ledger auth-ledger--signin">
      <aside className="auth-ledger-panel">
        <Link to="/" className="auth-ledger-mark">
          <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="" />
          <span>Plumfolio</span>
        </Link>

        <div className="auth-ledger-panel-body">
          <p className="auth-ledger-tag">Account access</p>
          <h1>Sign back<br />into your ledger.</h1>
          <p className="auth-ledger-lead">
            Your budgets, transactions, and forecasts pick up exactly where you left them.
          </p>

          <div className="auth-ledger-slip">
            <div className="auth-ledger-slip-row">
              <span>Session</span>
              <span>Encrypted</span>
            </div>
            <div className="auth-ledger-slip-row">
              <span>Sync</span>
              <span>Real-time</span>
            </div>
            <div className="auth-ledger-slip-row">
              <span>Ref</span>
              <span>PF-ACC-{new Date().getFullYear()}</span>
            </div>
          </div>
        </div>

        <p className="auth-ledger-copy">© Plumfolio 2026</p>
      </aside>

      <main className="auth-ledger-main">
        <Link to="/" className="auth-ledger-mark auth-ledger-mark--mobile">
          <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="" />
          <span>Plumfolio</span>
        </Link>

        <div className="auth-ledger-form-wrap">
          <header className="auth-ledger-form-head">
            <span className="auth-ledger-form-id">Form · Sign-in</span>
            <h2>Credentials</h2>
          </header>

          {serverError && (
            <div className="auth-error auth-error--shake" role="alert">
              <AlertCircle size={16} />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form auth-form--ledger" noValidate>
            <AuthField
              variant="ledger"
              id="email"
              name="email"
              label="Email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              onBlur={handleBlur}
              error={errors.email}
              touched={touched.email}
              hint="The address you registered with"
              required
              autoComplete="email"
              autoCapitalize="off"
              maxLength={254}
              placeholder="you@example.com"
            />

            <AuthField
              variant="ledger"
              id="password"
              name="password"
              label="Password"
              value={formData.password}
              onChange={handleChange}
              onBlur={handleBlur}
              error={errors.password}
              touched={touched.password}
              hint="Minimum 6 characters"
              required
              autoComplete="current-password"
              maxLength={128}
              placeholder="••••••••"
              showToggle
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((v) => !v)}
            />

            <div className="forgot-password-link">
              <Link to="/forgot-password">Forgot password?</Link>
            </div>

            <button
              type="submit"
              className={`auth-btn auth-btn--ledger ${formReady ? 'auth-btn--ready' : ''}`}
              disabled={loading}
            >
              {loading ? <span className="spinner" aria-label="Signing in" /> : 'Sign in →'}
            </button>
          </form>

          <p className="auth-switch auth-switch--ledger">
            No account yet? <Link to="/signup">Open one free</Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default SignIn;
