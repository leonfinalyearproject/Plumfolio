import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, ArrowRight, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';
import Slideshow from '../components/Slideshow';
import './Auth.css';

const SignUp = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { signUp } = useAuth();

  // Validation rules
  const validateField = (name, value) => {
    switch (name) {
      case 'fullName':
        if (!value.trim()) return 'Full name is required';
        if (value.trim().length < 2) return 'Name must be at least 2 characters';
        if (value.trim().length > 50) return 'Name must be less than 50 characters';
        if (!/^[a-zA-Z\s'-]+$/.test(value)) return 'Name can only contain letters, spaces, hyphens, and apostrophes';
        return '';
      
      case 'email':
        if (!value.trim()) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address';
        return '';
      
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        if (!/[A-Z]/.test(value)) return 'Password must contain at least one uppercase letter';
        if (!/[a-z]/.test(value)) return 'Password must contain at least one lowercase letter';
        if (!/[0-9]/.test(value)) return 'Password must contain at least one number';
        return '';
      
      case 'confirmPassword':
        if (!value) return 'Please confirm your password';
        if (value !== formData.password) return 'Passwords do not match';
        return '';
      
      default:
        return '';
    }
  };

  // Password strength indicator
  const getPasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength(formData.password);
  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setError('');
    
    if (touched[name]) {
      setErrors({ ...errors, [name]: validateField(name, value) });
    }
    
    if (name === 'password' && touched.confirmPassword) {
      setErrors(prev => ({
        ...prev,
        confirmPassword: formData.confirmPassword !== value ? 'Passwords do not match' : ''
      }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched({ ...touched, [name]: true });
    setErrors({ ...errors, [name]: validateField(name, value) });
  };

  const validateForm = () => {
    const newErrors = {
      fullName: validateField('fullName', formData.fullName),
      email: validateField('email', formData.email),
      password: validateField('password', formData.password),
      confirmPassword: validateField('confirmPassword', formData.confirmPassword),
    };
    
    setErrors(newErrors);
    setTouched({ fullName: true, email: true, password: true, confirmPassword: true });
    
    return !Object.values(newErrors).some(error => error);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setError('');

    const { error } = await signUp(formData.email, formData.password, formData.fullName.trim());
    
    if (error) {
      if (error.message.includes('User already registered')) {
        setError('An account with this email already exists. Please sign in instead.');
      } else {
        setError(error.message);
      }
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
            <div className="success-icon">
              <Check size={24} />
            </div>
            <h2>Check your email</h2>
            <p>We sent a verification link to <strong>{formData.email}</strong></p>
            <span className="success-note">Redirecting to sign in...</span>
          </div>
          <footer className="auth-footer">
            <p>&copy; Plumfolio 2026</p>
          </footer>
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
          
          {error && (
            <div className="auth-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
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
                  required
                />
              </div>
              {errors.fullName && touched.fullName && (
                <span className="field-error">{errors.fullName}</span>
              )}
              <span className="field-hint">Enter your full name as it appears on official documents</span>
            </div>
            
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
                  required
                />
              </div>
              {errors.email && touched.email && (
                <span className="field-error">{errors.email}</span>
              )}
              <span className="field-hint">We'll send a verification link to this address</span>
            </div>
            
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
                  required
                />
                <button 
                  type="button" 
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && touched.password && (
                <span className="field-error">{errors.password}</span>
              )}
              
              {/* Password Strength Meter */}
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
              
              <span className="field-hint">Min. 8 characters with uppercase, lowercase, and number</span>
            </div>
            
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
                  required
                />
                <button 
                  type="button" 
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
              {loading ? (
                <span className="spinner" />
              ) : (
                <>
                  Create Account
                  <ArrowRight size={18} />
                </>
              )}
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
