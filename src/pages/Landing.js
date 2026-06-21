import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ArrowRight, PieChart, TrendingUp, Shield, Smartphone,
  Wallet, BarChart3, Target
} from 'lucide-react';
import ScrollReveal, { StaggerReveal } from '../components/ScrollReveal';
import './Landing.css';

const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  return (
    <div className="landing-wrapper">
      <header className="landing-nav">
        <div className="landing-brand">
          <img
            src={`${process.env.PUBLIC_URL}/logo.png`}
            alt="Plumfolio"
            className="landing-nav-logo"
          />
          <span className="landing-brand-name">Plumfolio</span>
        </div>
        <div className="landing-nav-actions">
          <button type="button" onClick={() => navigate('/signin')} className="btn-text">
            Sign in
          </button>
          <button type="button" onClick={() => navigate('/signup')} className="btn-main btn-sm">
            Get started
          </button>
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <ScrollReveal animation="up">
              <p className="landing-eyebrow">Personal finance, simplified</p>
              <h1 className="landing-headline">
                Track spending, plan budgets, and stay on top of your money.
              </h1>
              <p className="landing-lead">
                Plumfolio gives you a clear view of income, expenses, and savings goals —
                without spreadsheets or guesswork.
              </p>
            </ScrollReveal>

            <ScrollReveal animation="up" delay={120}>
              <div className="landing-hero-actions">
                <button type="button" onClick={() => navigate('/signup')} className="btn-main">
                  Create free account
                  <ArrowRight size={18} />
                </button>
                <button type="button" onClick={() => navigate('/signin')} className="btn-outline">
                  Sign in
                </button>
              </div>
            </ScrollReveal>

            <ScrollReveal animation="up" delay={200}>
              <ul className="landing-trust-list">
                <li><Shield size={16} /> Secure sign-in</li>
                <li><Wallet size={16} /> Real-time balances</li>
                <li><BarChart3 size={16} /> Clear reports</li>
              </ul>
            </ScrollReveal>
          </div>

          <ScrollReveal animation="left" delay={80} className="landing-hero-panel">
            <div className="landing-preview-card">
              <div className="preview-row">
                <span className="preview-label">Balance this month</span>
                <span className="preview-value">P12,450.00</span>
              </div>
              <div className="preview-row">
                <span className="preview-label">Budget remaining</span>
                <span className="preview-value preview-positive">P3,820.00</span>
              </div>
              <div className="preview-row">
                <span className="preview-label">Savings rate</span>
                <span className="preview-value">28%</span>
              </div>
              <div className="preview-divider" />
              <p className="preview-note">
                Dashboard, budgets, forecasts, and reports — all in one place.
              </p>
            </div>
          </ScrollReveal>
        </section>

        <section className="landing-features">
          <ScrollReveal animation="up">
            <h2 className="landing-section-title">Built for everyday money management</h2>
          </ScrollReveal>

          <StaggerReveal className="landing-features-grid" animation="up" stagger={80}>
            <article className="landing-feature">
              <div className="landing-feature-icon"><TrendingUp size={20} /></div>
              <h3>Analytics</h3>
              <p>See where your money goes with charts and category breakdowns.</p>
            </article>
            <article className="landing-feature">
              <div className="landing-feature-icon"><Target size={20} /></div>
              <h3>Budgets</h3>
              <p>Set monthly limits and track progress as you spend.</p>
            </article>
            <article className="landing-feature">
              <div className="landing-feature-icon"><PieChart size={20} /></div>
              <h3>Forecasts</h3>
              <p>Get spending predictions and alerts before you overspend.</p>
            </article>
            <article className="landing-feature">
              <div className="landing-feature-icon"><Smartphone size={20} /></div>
              <h3>Any device</h3>
              <p>Use Plumfolio on desktop or mobile — your data stays in sync.</p>
            </article>
          </StaggerReveal>
        </section>

        <section className="landing-cta">
          <ScrollReveal animation="up">
            <h2>Ready to take control?</h2>
            <p>Create your account in under a minute.</p>
            <button type="button" onClick={() => navigate('/signup')} className="btn-main">
              Get started free
              <ArrowRight size={18} />
            </button>
          </ScrollReveal>
        </section>
      </main>

      <footer className="landing-footer">
        <p>&copy; Plumfolio 2026</p>
      </footer>
    </div>
  );
};

export default Landing;
