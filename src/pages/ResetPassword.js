import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock, ArrowRight, AlertCircle, Eye, EyeOff, CheckCircle } from 'lucide-react';
import Slideshow from '../components/Slideshow';
import './Auth.css';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // The URL contains the access token in the hash fragment.
    // Supabase client automatically picks it up and sets the session.
    // We just need to wait a moment for it to process.
    const checkSession = async () => {
      // Give Supabase a moment to process the URL hash
      await new Promise(r => setTimeout(r, 1000));
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No session found from reset link');
      } else {
        console.log('Session ready for password reset');
      }
    };
    checkSession();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      return setError('Password must be at least 6 characters');
    }
    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 3000);
    } catch (err) {
      setError(err.message || 'Failed to reset password. The link may have expired — try requesting a new one.');
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
          {success ? (
            <div className="reset-success">
              <CheckCircle size={48} className="reset-success-icon" />
              <h1>Password Reset!</h1>
              <p>Your password has been updated successfully. Redirecting to dashboard...</p>
            </div>
          ) : (
            <>
              <div className="auth-header">
                <h1>Set New Password</h1>
                <p>Enter your new password below.</p>
              </div>

              {error && (
                <div className="auth-error">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="auth-form" noValidate>
                <div className="input-group">
                  <label htmlFor="password">
                    New Password <span className="required">*</span>
                  </label>
                  <div className="input-field">
                    <Lock size={18} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
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
                </div>

                <div className="input-group">
                  <label htmlFor="confirmPassword">
                    Confirm Password <span className="required">*</span>
                  </label>
                  <div className="input-field">
                    <Lock size={18} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat your new password"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? (
                    <span className="spinner" />
                  ) : (
                    <>
                      Reset Password
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
          <p>&copy; Plumfolio 2026</p>
        </footer>
      </div>
    </div>
  );
};

export default ResetPassword;
