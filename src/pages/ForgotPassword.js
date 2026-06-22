import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Mail, ArrowRight, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';
import Slideshow from '../components/Slideshow';
import './Auth.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !email.includes('@')) {
      return setError('Please enter a valid email address');
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/Plumfolio/reset-password',
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <Slideshow />

      <div className="auth-container">
        <Link to="/" className="auth-logo-link">
          <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="Plumfolio" className="auth-logo" />
        </Link>

        <div className="auth-card">
          {sent ? (
            <div className="reset-success">
              <CheckCircle size={48} className="reset-success-icon" />
              <h1>Check Your Email</h1>
              <p>We've sent a password reset link to <strong>{email}</strong>. Click the link in the email to set a new password.</p>
              <p className="reset-hint">Didn't receive it? Check your spam folder or try again.</p>
              <button className="auth-btn outline" onClick={() => setSent(false)}>
                <ArrowLeft size={18} />
                Try Again
              </button>
            </div>
          ) : (
            <>
              <div className="auth-header">
                <h1>Forgot Password?</h1>
                <p>Enter your email and we'll send you a reset link.</p>
              </div>

              {error && (
                <div className="auth-error">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="auth-form" noValidate>
                <div className="input-group">
                  <label htmlFor="email">
                    Email Address <span className="required">*</span>
                  </label>
                  <div className="input-field">
                    <Mail size={18} />
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                  <span className="field-hint">We'll send a reset link to this email</span>
                </div>

                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? (
                    <span className="spinner" />
                  ) : (
                    <>
                      Send Reset Link
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>

              <p className="auth-switch">
                Remember your password? <Link to="/signin">Sign in</Link>
              </p>
            </>
          )}
        </div>

        <footer className="auth-footer">
          <p>&copy; {new Date().getFullYear()} Futurify Designs</p>
        </footer>
      </div>
    </div>
  );
};

export default ForgotPassword;
