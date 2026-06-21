import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateSignInForm } from '../utils/validation';
import {
  ArrowRight, AlertCircle, Shield, Zap, BarChart3, Lock, Mail,
} from 'lucide-react';
import AuthField from '../components/AuthField';
import './Auth.css';

const HIGHLIGHTS = [
  { icon: Shield, text: 'Encrypted sign-in keeps your data private' },
  { icon: Zap, text: 'Balances and budgets sync in real time' },
  { icon: BarChart3, text: 'Pick up right where you left off' },
];

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
    <div className="auth-shell auth-shell--signin">
      <aside className="auth-aside auth-aside--signin">
        <Link to="/" className="auth-aside-brand">
          <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="" className="auth-aside-logo" />
          <span>Plumfolio</span>
        </Link>

        <div className="auth-aside-body">
          <p className="auth-aside-eyebrow">Welcome back</p>
          <h1 className="auth-aside-title">Sign in to manage your money with clarity.</h1>
          <p className="auth-aside-lead">
            Your dashboard, budgets, and forecasts are ready whenever you are.
          </p>

          <ul className="auth-aside-list">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text}>
                <span className="auth-aside-list-icon"><Icon size={18} /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="auth-aside-foot">&copy; Plumfolio 2026</p>
      </aside>

      <main className="auth-main">
        <Link to="/" className="auth-mobile-brand">
          <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="" />
          <span>Plumfolio</span>
        </Link>

        <div className="auth-card auth-card--interactive">
          <div className="auth-header">
            <div className="auth-header-icon auth-header-icon--signin">
              <Lock size={20} />
            </div>
            <h2>Sign in</h2>
            <p>Enter your account credentials</p>
          </div>

          {serverError && (
            <div className="auth-error auth-error--shake" role="alert">
              <AlertCircle size={16} />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <AuthField
              id="email"
              name="email"
              label="Email address"
              type="email"
              value={formData.email}
              onChange={handleChange}
              onBlur={handleBlur}
              error={errors.email}
              touched={touched.email}
              hint="Use the email you registered with"
              icon={Mail}
              required
              autoComplete="email"
              autoCapitalize="off"
              maxLength={254}
              placeholder="you@example.com"
            />

            <AuthField
              id="password"
              name="password"
              label="Password"
              value={formData.password}
              onChange={handleChange}
              onBlur={handleBlur}
              error={errors.password}
              touched={touched.password}
              hint="Minimum 6 characters"
              icon={Lock}
              required
              autoComplete="current-password"
              maxLength={128}
              placeholder="Your password"
              showToggle
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((v) => !v)}
            />

            <div className="forgot-password-link">
              <Link to="/forgot-password">Forgot your password?</Link>
            </div>

            <button
              type="submit"
              className={`auth-btn ${formReady ? 'auth-btn--ready' : ''}`}
              disabled={loading}
            >
              {loading ? (
                <span className="spinner" aria-label="Signing in" />
              ) : (
                <>
                  Sign in
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="auth-switch">
            Don&apos;t have an account? <Link to="/signup">Create one free</Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default SignIn;
