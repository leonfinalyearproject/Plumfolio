import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateSignUpForm, getPasswordRequirements } from '../utils/validation';
import { Check, AlertCircle } from 'lucide-react';
import AuthField from '../components/AuthField';
import PasswordChecklist from '../components/PasswordChecklist';
import './Auth.css';

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
  const strengthColors = ['', '#991B1B', '#A16207', '#3B1858', '#166534'];

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

  const panel = (
    <aside className="auth-ledger-panel auth-ledger-panel--signup">
      <Link to="/" className="auth-ledger-mark">
        <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="" />
        <span>Plumfolio</span>
      </Link>
      <div className="auth-ledger-panel-body">
        <p className="auth-ledger-tag">New account</p>
        <h1>Open a personal ledger.</h1>
        <p className="auth-ledger-lead">
          Free to use. No card. Verify your email, then record your first figures.
        </p>
        <ol className="auth-ledger-steps">
          <li><span>01</span> Register below</li>
          <li><span>02</span> Confirm via email</li>
          <li><span>03</span> Set currency &amp; budgets</li>
        </ol>
      </div>
      <p className="auth-ledger-copy">© Plumfolio 2026</p>
    </aside>
  );

  if (success) {
    return (
      <div className="auth-ledger auth-ledger--signup">
        {panel}
        <main className="auth-ledger-main">
          <div className="auth-ledger-form-wrap auth-ledger-form-wrap--success">
            <div className="auth-ledger-success-mark">✓</div>
            <header className="auth-ledger-form-head">
              <span className="auth-ledger-form-id">Confirmation</span>
              <h2>Check your inbox</h2>
            </header>
            <p className="auth-ledger-success-text">
              Verification sent to <strong>{formData.email.trim()}</strong>.
              Click the link, then sign in.
            </p>
            <p className="auth-ledger-success-note">Redirecting shortly…</p>
            <Link to="/signin" className="auth-btn auth-btn--ledger auth-btn--ready">
              Go to sign in →
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="auth-ledger auth-ledger--signup">
      {panel}

      <main className="auth-ledger-main">
        <Link to="/" className="auth-ledger-mark auth-ledger-mark--mobile">
          <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="" />
          <span>Plumfolio</span>
        </Link>

        <div className="auth-ledger-form-wrap">
          <div className="auth-ledger-progress" aria-hidden="true">
            <div className="auth-ledger-progress-fill" style={{ width: `${formProgress}%` }} />
          </div>

          <header className="auth-ledger-form-head">
            <span className="auth-ledger-form-id">Form · Registration</span>
            <h2>Account details</h2>
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
              id="fullName"
              name="fullName"
              label="Full name"
              type="text"
              value={formData.fullName}
              onChange={handleChange}
              onBlur={handleBlur}
              error={errors.fullName}
              touched={touched.fullName}
              hint="As it appears on your records"
              required
              autoComplete="name"
              maxLength={60}
              placeholder="Leon Maunge"
            />

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
              hint="We'll send a verification link here"
              required
              autoComplete="email"
              maxLength={254}
              placeholder="you@example.com"
            >
              {errors.email?.includes('already registered') && touched.email && (
                <span className="field-hint field-hint--action">
                  Already registered? <Link to="/signin">Sign in</Link>
                </span>
              )}
            </AuthField>

            <AuthField
              variant="ledger"
              id="password"
              name="password"
              label="Password"
              value={formData.password}
              onChange={handleChange}
              onBlur={(e) => { setPasswordFocused(false); handleBlur(e); }}
              onFocus={() => setPasswordFocused(true)}
              error={errors.password}
              touched={touched.password}
              required
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              placeholder="••••••••"
              showToggle
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((v) => !v)}
            >
              <PasswordChecklist
                password={formData.password}
                visible={passwordFocused || Boolean(formData.password)}
              />
              {formData.password && passwordStrength > 0 && (
                <div className="password-strength password-strength--ledger">
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
              variant="ledger"
              id="confirmPassword"
              name="confirmPassword"
              label="Confirm password"
              value={formData.confirmPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              error={errors.confirmPassword}
              touched={touched.confirmPassword}
              hint={passwordsMatch ? undefined : 'Must match password above'}
              required
              autoComplete="new-password"
              maxLength={128}
              placeholder="••••••••"
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
              className={`auth-btn auth-btn--ledger ${formReady ? 'auth-btn--ready' : ''}`}
              disabled={loading}
            >
              {loading ? <span className="spinner" aria-label="Creating account" /> : 'Create account →'}
            </button>
          </form>

          <p className="auth-switch auth-switch--ledger">
            Already registered? <Link to="/signin">Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default SignUp;
