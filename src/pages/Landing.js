import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, TrendingUp, PieChart, Shield, Smartphone } from 'lucide-react';
import './Landing.css';

const Landing = () => {
  const [showIntro, setShowIntro] = useState(true);
  const [introPhase, setIntroPhase] = useState(0);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
      return;
    }

    // Intro animation phases
    const phases = [
      { delay: 0 },      // Ground appears
      { delay: 400 },    // Stem grows
      { delay: 1600 },   // Leaves appear
      { delay: 2400 },   // Petals bloom
      { delay: 3400 },   // Dollar symbol
      { delay: 4200 },   // Brand name
      { delay: 5500 },   // Transition out
    ];

    phases.forEach((phase, index) => {
      setTimeout(() => setIntroPhase(index + 1), phase.delay);
    });

    const timeout = setTimeout(() => setShowIntro(false), 6000);
    return () => clearTimeout(timeout);
  }, [user, navigate]);

  const skipIntro = () => setShowIntro(false);

  if (showIntro) {
    return (
      <div className="intro-container">
        <div className="intro-scene">
          {/* Ground */}
          <div className={`ground ${introPhase >= 1 ? 'visible' : ''}`} />
          
          {/* Stem */}
          <div className={`stem ${introPhase >= 2 ? 'grow' : ''}`} />
          
          {/* Leaves */}
          <div className={`leaf leaf-left ${introPhase >= 3 ? 'visible' : ''}`} />
          <div className={`leaf leaf-right ${introPhase >= 3 ? 'visible' : ''}`} />
          
          {/* Petals */}
          <div className={`petal petal-1 ${introPhase >= 4 ? 'bloom' : ''}`} />
          <div className={`petal petal-2 ${introPhase >= 4 ? 'bloom' : ''}`} />
          <div className={`petal petal-3 ${introPhase >= 4 ? 'bloom' : ''}`} />
          <div className={`petal petal-4 ${introPhase >= 4 ? 'bloom' : ''}`} />
          <div className={`petal petal-5 ${introPhase >= 4 ? 'bloom' : ''}`} />
          
          {/* Dollar Symbol */}
          <div className={`dollar-symbol ${introPhase >= 5 ? 'visible' : ''}`}>$</div>
          
          {/* Brand Name */}
          <h1 className={`intro-brand ${introPhase >= 6 ? 'visible' : ''}`}>Plumfolio</h1>
        </div>
        
        <button className="skip-btn" onClick={skipIntro}>
          Skip
        </button>
      </div>
    );
  }

  return (
    <div className="landing">
      {/* Background Effects */}
      <div className="bg-gradient" />
      <div className="bg-grid" />
      
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="nav-brand">
          <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="" className="nav-logo" />
          <span>Plumfolio</span>
        </div>
        <div className="nav-links">
          <button onClick={() => navigate('/signin')} className="nav-link">Sign In</button>
          <button onClick={() => navigate('/signup')} className="nav-btn">Get Started</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">Personal Finance Tracker</div>
          <h1 className="hero-title">
            Take Control of Your
            <span className="gradient-text"> Financial Future</span>
          </h1>
          <p className="hero-subtitle">
            Track expenses, set budgets, and gain insights into your spending habits. 
            Simple, secure, and completely free.
          </p>
          <div className="hero-actions">
            <button onClick={() => navigate('/signup')} className="btn-primary">
              Start Tracking
              <ArrowRight size={18} />
            </button>
            <button onClick={() => navigate('/signin')} className="btn-secondary">
              Sign In
            </button>
          </div>
        </div>
        
        <div className="hero-visual">
          <div className="dashboard-preview">
            <div className="preview-header">
              <div className="preview-dots">
                <span /><span /><span />
              </div>
            </div>
            <div className="preview-content">
              <div className="preview-stat">
                <span className="stat-label">Total Balance</span>
                <span className="stat-value">P24,567.89</span>
              </div>
              <div className="preview-chart">
                <div className="chart-bar" style={{ height: '60%' }} />
                <div className="chart-bar" style={{ height: '80%' }} />
                <div className="chart-bar" style={{ height: '45%' }} />
                <div className="chart-bar" style={{ height: '90%' }} />
                <div className="chart-bar" style={{ height: '70%' }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <h2 className="section-title">Everything you need to manage your money</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <TrendingUp size={24} />
            </div>
            <h3>Smart Analytics</h3>
            <p>Visualize your spending patterns with intuitive charts and gain insights that help you save more.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <PieChart size={24} />
            </div>
            <h3>Budget Tracking</h3>
            <p>Set monthly budgets by category and monitor your progress with real-time updates.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <Shield size={24} />
            </div>
            <h3>Secure & Private</h3>
            <p>Your financial data is protected with enterprise-grade encryption and never shared.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <Smartphone size={24} />
            </div>
            <h3>Mobile Ready</h3>
            <p>Access your finances anywhere with a fully responsive design that works on any device.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>Final Year Project by Leon Maunge</p>
        <p>University of Botswana, 2026</p>
      </footer>
    </div>
  );
};

export default Landing;
