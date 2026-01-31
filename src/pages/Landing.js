import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, PieChart, TrendingUp, Shield, Smartphone } from 'lucide-react';
import './Landing.css';

const Landing = () => {
  const [introPhase, setIntroPhase] = useState(0);
  const [showMain, setShowMain] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
      return;
    }

    setTimeout(() => setIntroPhase(1), 100);
    setTimeout(() => setIntroPhase(2), 1000);
    setTimeout(() => setIntroPhase(3), 2800);
    setTimeout(() => {
      setIntroPhase(4);
      setShowMain(true);
    }, 3600);

  }, [user, navigate]);

  return (
    <div className="landing-wrapper">
      {/* Intro Overlay */}
      <div className={`intro-overlay ${introPhase >= 3 ? 'fade-out' : ''} ${introPhase >= 4 ? 'hidden' : ''}`}>
        <div className={`intro-logo-container ${introPhase >= 1 ? 'visible' : ''} ${introPhase >= 2 ? 'glow' : ''} ${introPhase >= 3 ? 'zoom-out' : ''}`}>
          <img 
            src={`${process.env.PUBLIC_URL}/logo.png`} 
            alt="Plumfolio" 
            className="intro-logo"
          />
        </div>
      </div>

      {/* Main Landing Content */}
      <div className={`landing-main ${showMain ? 'visible' : ''}`}>
        {/* Animated spotlights */}
        <div className="spotlights">
          <div className="spotlight purple" />
          <div className="spotlight green" />
          <div className="spotlight purple-2" />
          <div className="spotlight green-2" />
        </div>
        
        {/* Hero Section */}
        <section className="hero">
          <img 
            src={`${process.env.PUBLIC_URL}/logo.png`} 
            alt="Plumfolio" 
            className="landing-logo"
          />
          
          <h1 className="hero-title">
            Take control of your <span>finances</span>
          </h1>
          
          <p className="hero-subtitle">
            Track expenses, manage budgets, and gain insights into your spending habits. 
            Simple, secure, and designed to help you save.
          </p>

          <div className="hero-buttons">
            <button onClick={() => navigate('/signup')} className="btn-main">
              Get Started Free
              <ArrowRight size={18} />
            </button>
            <button onClick={() => navigate('/signin')} className="btn-outline">
              Sign In
            </button>
          </div>
        </section>

        {/* Features Section */}
        <section className="features">
          <h2 className="section-title">Everything you need to manage your money</h2>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <TrendingUp size={22} />
              </div>
              <h3>Smart Analytics</h3>
              <p>Visualize spending patterns with intuitive charts and discover where your money goes.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">
                <PieChart size={22} />
              </div>
              <h3>Budget Tracking</h3>
              <p>Set monthly budgets by category and get alerts before you overspend.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">
                <Shield size={22} />
              </div>
              <h3>Secure & Private</h3>
              <p>Your data is encrypted and protected. We never share your financial information.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">
                <Smartphone size={22} />
              </div>
              <h3>Works Everywhere</h3>
              <p>Access your finances from any device with our fully responsive design.</p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta">
          <h2>Ready to start tracking?</h2>
          <p>Join thousands of users managing their finances smarter.</p>
          <button onClick={() => navigate('/signup')} className="btn-main">
            Create Free Account
            <ArrowRight size={18} />
          </button>
        </section>

        {/* Footer */}
        <footer className="landing-footer">
          <p>&copy; Plumfolio 2026</p>
        </footer>
      </div>
    </div>
  );
};

export default Landing;
