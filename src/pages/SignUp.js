import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, ArrowRight, Check, AlertCircle } from 'lucide-react';
import './Auth.css';

const SignUp = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    const { error } = await signUp(formData.email, formData.password, formData.fullName);
    
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/signin'), 3000);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-bg" />
        <div className="auth-container">
          <div className="success-card">
            <div className="success-icon">
              <Check size={32} />
            </div>
            <h2>Check your email</h2>
            <p>We've sent a verification link to <strong>{formData.email}</strong></p>
            <p className="success-note">Redirecting to sign in...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-bg" />
      
      <div className="auth-container">
        <div className="auth-card">
          {/* Left Panel - Decorative */}
          <div className="auth-panel-left">
            <Link to="/" className="auth-brand">
              <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="" className="auth-logo" />
              <span>Plumfolio</span>
            </Link>
            
            <div className="auth-panel-content">
              <h2>Start your journey to financial freedom</h2>
              <p>Join thousands of users who have taken control of their finances with Plumfolio.</p>
              
              <div className="auth-features">
                <div className="auth-feature">
                  <div className="feature-check"><Check size={14} /></div>
                  <span>Free forever, no hidden costs</span>
                </div>
                <div className="auth-feature">
                  <div className="feature-check"><Check size={14} /></div>
                  <span>Bank-level security</span>
                </div>
                <div className="auth-feature">
                  <div className="feature-check"><Check size={14} /></div>
                  <span>Instant insights into spending</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Panel - Form */}
          <div className="auth-panel-right">
            <div className="auth-form-header">
              <h1>Create account</h1>
              <p>Enter your details to get started</p>
            </div>
            
            {error && (
              <div className="auth-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="fullName">Full Name</label>
                <div className="input-wrapper">
                  <User size={18} className="input-icon" />
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <div className="input-wrapper">
                  <Mail size={18} className="input-icon" />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="input-wrapper">
                  <Lock size={18} className="input-icon" />
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Min. 6 characters"
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <div className="input-wrapper">
                  <Lock size={18} className="input-icon" />
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Repeat your password"
                    required
                  />
                </div>
              </div>
              
              <button type="submit" className="auth-submit" disabled={loading}>
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
            
            <p className="auth-footer-text">
              Already have an account? <Link to="/signin">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
