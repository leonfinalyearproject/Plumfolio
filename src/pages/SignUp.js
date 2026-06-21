import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateSignUpForm, getPasswordRequirements } from '../utils/validation';
import {
  Mail, Lock, User, ArrowRight, Check, AlertCircle, Sparkles,
  MailCheck, LayoutDashboard,
} from 'lucide-react';
import AuthField from '../components/AuthField';
import PasswordChecklist from '../components/PasswordChecklist';
import './Auth.css';

const STEPS = [
  { num: '1', title: 'Create your account', desc: 'Name, email, and a secure password' },
  { num: '2', title: 'Verify your email', desc: 'One click to activate your account' },
  { num: '3', title: 'Start tracking', desc: 'Add transactions and set your first budget' },
];

const SignUp = () => {
  const [formData, setFormData] = useState({
    fullName: '', email: '', password: '', confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const formProgress = useMemo(() => {
    let filled = 0;
    if (formData.fullName.trim()) filled++;
    if (formData.email.trim()) filled++;
    if (formData.password) filled++;
    if (formData.confirmPassword) filled++;
    return (filled / 4) * 100;
  }, [formData]);

  const { isValid: formReady } = useMemo(
    () => validateSignUpForm({
      fullName: formData.fullName.trim(),
      email: formData.email.trim(),
      password: formData.password,
      confirmPassword: formData.confirmPassword,
    }),
    [formData],
  );

  const passwordStrength = useMemo(() => {
    const req = getPasswordRequirements(formData.password);
    return Object.values(req).filter(Boolean).length;
  }, [formData.password]);

  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['', '#ef4444', '#eab308', '#84cc16', '#22c55e'];

  const validateField = (name, value, allData = formData) => {
    const result = validateSignUpForm({
      fullName: name === 'fullName' ? value.trim() : allData.fullName.trim(),
      email: name === 'email' ? value.trim() : allData.email.trim(),
      password: name === 'password' ? value : allData.password,
      confirmPassword: name === 'confirmPassword' ? value : allData.confirmPassword,
    });
    return result.errors[name] || '';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...formData, [name]: value };
    setFormData(updated);
    setServerError('');
    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateField(name, value, updated) }));
    }
    if (name === 'password' && touched.confirmPassword) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: validateField('confirmPassword', updated.confirmPassword, updated),
      }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
  };

  const validateAll = () => {
    const result = validateSignUpForm({
      fullName: formData.fullName.trim(),
      email: formData.email.trim(),
      password: formData.password,
      confirmPassword: formData.confirmPassword,
    });
    setErrors(result.errors);
    setTouched({ fullName: true, email: true, password: true, confirmPassword: true });
    return result.isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateAll()) return;

    setLoading(true);
    setServerError('');

    const { data, error } = await signUp(
      formData.email.trim(),
      formData.password,
      formData.fullName.trim(),
    );

    const isDuplicateSilent =
      !error && data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;

    const isDuplicateError = error && (
      error.message?.toLowerCase().includes('user already registered') ||
      error.message?.toLowerCase().includes('already been registered') ||
      error.message?.toLowerCase().includes('email address is already') ||
      error.message?.toLowerCase().includes('already in use') ||
      error.code === '23505'
    );

    if (isDuplicateSilent || isDuplicateError) {
      setErrors((prev) => ({ ...prev, email: 'This email is already registered. Sign in instead.' }));
      setTouched((prev) => ({ ...prev, email: true }));
      setServerError('');
      setLoading(false);
    } else if (error) {
      setServerError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/signin'), 4000);
    }
  };

  const passwordsMatch =
    formData.confirmPassword &&
    formData.password === formData.confirmPassword &&
    !errors.confirmPassword;

  if (success) {
    return (
      <div className="auth-shell auth-shell--signup">
        <aside className="auth-aside auth-aside--signup">
          <Link to="/" className="auth-aside-brand">
            <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="" className="auth-aside-logo" />
            <span>Plumfolio</span>
          </Link>
          <div className="auth-aside-body">
            <p className="auth-aside-eyebrow">Almost there</p>
            <h1 className="auth-aside-title">Verify your email to activate your account.</h1>
          </div>
        </aside>
        <main className="auth-main">
          <div className="auth-card success-card auth-card--interactive">
            <div className="success-icon success-icon--animated"><MailCheck size={28} /></div>
            <h2>Check your inbox</h2>
            <p>
              We sent a verification link to <strong>{formData.email.trim()}</strong>.
              Click the link, then sign in to get started.
            </p>
            <span className="success-note">Redirecting to sign in in a few seconds…</span>
            <Link to="/signin" className="auth-btn auth-btn--ready" style={{ marginTop: 20, textDecoration: 'none' }}>
              Go to sign in
              <ArrowRight size={18} />
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="auth-shell auth-shell--signup">
      <aside className="auth-aside auth-aside--signup">
        <Link to="/" className="auth-aside-brand">
          <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="" className="auth-aside-logo" />
          <span>Plumfolio</span>
        </Link>

        <div className="auth-aside-body">
          <p className="auth-aside-eyebrow">Get started free</p>
          <h1 className="auth-aside-title">Set up your personal finance workspace in minutes.</h1>
          <p className="auth-aside-lead">
            Track spending, plan budgets, and forecast ahead — all in one place.
          </p>

          <ol className="auth-aside-steps">
            {STEPS.map(({ num, title, desc }) => (
              <li key={num}>
                <span className="auth-step-num">{num}</span>
                <div>
                  <strong>{title}</strong>
                  <span>{desc}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <p className="auth-aside-foot">&copy; Plumfolio 2026</p>
      </aside>

      <main className="auth-main">
        <Link to="/" className="auth-mobile-brand">
          <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="" />
          <span>Plumfolio</span>
        </Link>

        <div className="auth-card auth-card--interactive">
          <div className="auth-form-progress" aria-hidden="true">
            <div className="auth-form-progress-bar" style={{ width: `${formProgress}%` }} />
          </div>

          <div className="auth-header">
            <div className="auth-header-icon auth-header-icon--signup">
              <Sparkles size={20} />
            </div>
            <h2>Create account</h2>
            <p>Fill in your details below</p>
          </div>

          {serverError && (
            <div className="auth-error auth-error--shake" role="alert">
              <AlertCircle size={16} />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <AuthField
              id="fullName"
              name="fullName"
              label="Full name"
              type="text"
              value={formData.fullName}
              onChange={handleChange}
              onBlur={handleBlur}
              error={errors.fullName}
              touched={touched.fullName}
              hint="Letters, spaces, hyphens, and apostrophes only"
              icon={User}
              required
              autoComplete="name"
              maxLength={60}
              placeholder="Leon Maunge"
            />

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
              hint="We'll send a verification link to this address"
              icon={Mail}
              required
              autoComplete="email"
              maxLength={254}
              placeholder="you@example.com"
            >
              {errors.email?.includes('already registered') && touched.email && (
                <span className="field-hint field-hint--action">
                  Already registered? <Link to="/signin">Sign in instead</Link>
                </span>
              )}
            </AuthField>

            <AuthField
              id="password"
              name="password"
              label="Password"
              value={formData.password}
              onChange={handleChange}
              onBlur={(e) => { setPasswordFocused(false); handleBlur(e); }}
              onFocus={() => setPasswordFocused(true)}
              error={errors.password}
              touched={touched.password}
              icon={Lock}
              required
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              placeholder="Create a strong password"
              showToggle
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((v) => !v)}
            >
              <PasswordChecklist
                password={formData.password}
                visible={passwordFocused || Boolean(formData.password)}
              />
              {formData.password && passwordStrength > 0 && (
                <div className="password-strength">
                  <div className="strength-bar">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`strength-segment ${i <= passwordStrength ? 'active' : ''}`}
                        style={{
                          backgroundColor: i <= passwordStrength
                            ? strengthColors[passwordStrength]
                            : undefined,
                        }}
                      />
                    ))}
                  </div>
                  <span
                    className="strength-label"
                    style={{ color: strengthColors[passwordStrength] }}
                  >
                    {strengthLabels[passwordStrength]}
                  </span>
                </div>
              )}
            </AuthField>

            <AuthField
              id="confirmPassword"
              name="confirmPassword"
              label="Confirm password"
              value={formData.confirmPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              error={errors.confirmPassword}
              touched={touched.confirmPassword}
              hint={passwordsMatch ? undefined : 'Re-enter your password to confirm'}
              icon={Lock}
              required
              autoComplete="new-password"
              maxLength={128}
              placeholder="Repeat your password"
              showToggle
              showPassword={showConfirmPassword}
              onTogglePassword={() => setShowConfirmPassword((v) => !v)}
            >
              {passwordsMatch && (
                <span className="field-hint field-hint--success">
                  <Check size={12} aria-hidden="true" /> Passwords match
                </span>
              )}
            </AuthField>

            <button
              type="submit"
              className={`auth-btn ${formReady ? 'auth-btn--ready' : ''}`}
              disabled={loading}
            >
              {loading ? (
                <span className="spinner" aria-label="Creating account" />
              ) : (
                <>
                  Create account
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/signin">Sign in</Link>
          </p>

          <p className="auth-legal">
            By creating an account you agree to use Plumfolio responsibly.
            Your data stays private to your account.
          </p>
        </div>
      </main>
    </div>
  );
};

export default SignUp;
