import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import './Auth.css';

const SignIn = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { signIn, user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await signIn(formData.email, formData.password);
    
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg" />
      
      <div className="auth-container">
        <div className="auth-card auth-card-reverse">
          {/* Left Panel - Form */}
          <div className="auth-panel-right">
            <div className="auth-form-header">
              <Link to="/" className="auth-brand auth-brand-mobile">
                <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="" className="auth-logo" />
                <span>Plumfolio</span>
              </Link>
              <h1>Welcome back</h1>
              <p>Sign in to your account to continue</p>
            </div>
            
            {error && (
              <div className="auth-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="auth-form">
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
                    placeholder="Enter your password"
                    required
                  />
                </div>
              </div>
              
              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? (
                  <span className="spinner" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
            
            <p className="auth-footer-text">
              Don't have an account? <Link to="/signup">Sign up</Link>
            </p>
          </div>
          
          {/* Right Panel - Decorative */}
          <div className="auth-panel-left">
            <Link to="/" className="auth-brand">
              <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="" className="auth-logo" />
              <span>Plumfolio</span>
            </Link>
            
            <div className="auth-panel-content">
              <h2>Track every penny, grow every goal</h2>
              <p>Your financial insights are waiting for you. Sign in to see your progress.</p>
              
              <div className="auth-stats">
                <div className="auth-stat">
                  <span className="stat-number">10K+</span>
                  <span className="stat-label">Active Users</span>
                </div>
                <div className="auth-stat">
                  <span className="stat-number">P2M+</span>
                  <span className="stat-label">Tracked Monthly</span>
                </div>
                <div className="auth-stat">
                  <span className="stat-number">99.9%</span>
                  <span className="stat-label">Uptime</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
