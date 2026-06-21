import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  validateEmail, validatePassword, validatePasswordMatch, validateFullName,
} from '../utils/validation';
import { Mail, Lock, User, ArrowRight, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';
import Slideshow from '../components/Slideshow';
import './Auth.css';

const SignUp = () => {
  const [formData, setFormData] = useState({
    fullName: '', email: '', password: '', confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const validateField = (name, value, allData = formData) => {
    if (name === 'fullName') return validateFullName(value);
    if (name === 'email') return validateEmail(value.trim());
    if (name === 'password') return validatePassword(value);
    if (name === 'confirmPassword') return validatePasswordMatch(allData.password, value);
    return '';
  };

  // Password strength indicator
  const getPasswordStrength = (pw) => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[a-z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  };

  const passwordStrength = getPasswordStrength(formData.password);
  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...formData, [name]: value };
    setFormData(updated);
    setServerError('');
    if (touched[name]) {
      setErrors(prev => ({ ...prev, [name]: validateField(name, value, updated) }));
    }
    // Re-validate confirm password live when password changes
    if (name === 'password' && touched.confirmPassword) {
      setErrors(prev => ({
        ...prev,
        confirmPassword: validatePasswordMatch(value, updated.confirmPassword),
      }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    setErrors(prev => ({ ...prev, [name]: validateField(name, value) }));
  };

  const validateAll = () => {
    const newErrors = {
      fullName: validateFullName(formData.fullName),
      email: validateEmail(formData.email.trim()),
      password: validatePassword(formData.password),
      confirmPassword: validatePasswordMatch(formData.password, formData.confirmPassword),
    };
    setErrors(newErrors);
    setTouched({ fullName: true, email: true, password: true, confirmPassword: true });
    return !Object.values(newErrors).some(e => e);
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

    // Supabase silently "succeeds" for duplicate emails when email confirmation
    // is enabled — it returns no error but gives back a user with an empty
    // identities array. Detect and reject this case explicitly.
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
      setErrors(prev => ({ ...prev, email: 'This email is already registered. Sign in instead.' }));
      setTouched(prev => ({ ...prev, email: true }));
      setServerError('');
      setLoading(false);
    } else if (error) {
      setServerError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/signin'), 3000);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <Slideshow />
        <div className="auth-container">
          <div className="auth-card success-card">
            <div className="success-icon"><Check size={24} /></div>
            <h2>Check your email</h2>
            <p>We sent a verification link to <strong>{formData.email.trim()}</strong></p>
            <span className="success-note">Redirecting to sign in...</span>
          </div>
          <footer className="auth-footer"><p>&copy; Plumfolio 2026</p></footer>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <Slideshow />
      <div className="auth-container">
        <Link to="/" className="auth-logo-link">
          <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="Plumfolio" className="auth-logo" />
        </Link>

        <div className="auth-card">
          <div className="auth-header">
            <h1>Create account</h1>
            <p>Start tracking your finances</p>
          </div>

          {serverError && (
            <div className="auth-error">
              <AlertCircle size={16} />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {/* Full Name */}
            <div className="input-group">
              <label htmlFor="fullName">
                Full Name <span className="required">*</span>
              </label>
              <div className={`input-field ${errors.fullName && touched.fullName ? 'error' : ''}`}>
                <User size={18} />
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="John Doe"
                  autoComplete="name"
                  maxLength={60}
                  required
                />
              </div>
              {errors.fullName && touched.fullName
                ? <span className="field-error">{errors.fullName}</span>
                : <span className="field-hint">Letters, spaces, hyphens and apostrophes only</span>
              }
            </div>

            {/* Email */}
            <div className="input-group">
              <label htmlFor="email">
                Email <span className="required">*</span>
              </label>
              <div className={`input-field ${errors.email && touched.email ? 'error' : ''}`}>
                <Mail size={18} />
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoCapitalize="off"
                  maxLength={254}
                  required
                />
              </div>
              {errors.email && touched.email ? (
                <span className="field-error">
                  {errors.email}
                  {errors.email.includes('already registered') && (
                    <> — <Link to="/signin" style={{ color: 'inherit', fontWeight: 700 }}>Sign in</Link></>
                  )}
                </span>
              ) : (
                <span className="field-hint">We'll send a verification link to this address</span>
              )}
            </div>

            {/* Password */}
            <div className="input-group">
              <label htmlFor="password">
                Password <span className="required">*</span>
              </label>
              <div className={`input-field ${errors.password && touched.password ? 'error' : ''}`}>
                <Lock size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && touched.password && (
                <span className="field-error">{errors.password}</span>
              )}

              {/* Password strength meter */}
              {formData.password && (
                <div className="password-strength">
                  <div className="strength-bar">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={`strength-segment ${i < passwordStrength ? 'active' : ''}`}
                        style={{ backgroundColor: i < passwordStrength ? strengthColors[passwordStrength - 1] : undefined }}
                      />
                    ))}
                  </div>
                  <span className="strength-label" style={{ color: strengthColors[passwordStrength - 1] }}>
                    {passwordStrength > 0 ? strengthLabels[passwordStrength - 1] : ''}
                  </span>
                </div>
              )}

              {!(errors.password && touched.password) && (
                <span className="field-hint">Min. 8 characters with uppercase, lowercase, and number</span>
              )}
            </div>

            {/* Confirm Password */}
            <div className="input-group">
              <label htmlFor="confirmPassword">
                Confirm Password <span className="required">*</span>
              </label>
              <div className={`input-field ${errors.confirmPassword && touched.confirmPassword ? 'error' : ''}`}>
                <Lock size={18} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  maxLength={128}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(v => !v)}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirmPassword && touched.confirmPassword && (
                <span className="field-error">{errors.confirmPassword}</span>
              )}
            </div>

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? <span className="spinner" /> : <> Create Account <ArrowRight size={18} /> </>}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/signin">Sign in</Link>
          </p>
        </div>

        <footer className="auth-footer">
          <p>&copy; Plumfolio 2026</p>
        </footer>
      </div>
    </div>
  );
};

export default SignUp;
