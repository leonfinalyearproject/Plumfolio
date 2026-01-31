import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowRight } from 'lucide-react';
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

    // Phase 1: Logo appears (0ms)
    // Phase 2: Logo fully visible with glow (800ms)
    // Phase 3: Start fade/zoom transition (2200ms)
    // Phase 4: Show main content (3000ms)
    
    setTimeout(() => setIntroPhase(1), 100);
    setTimeout(() => setIntroPhase(2), 800);
    setTimeout(() => setIntroPhase(3), 2200);
    setTimeout(() => {
      setIntroPhase(4);
      setShowMain(true);
    }, 3000);

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
        
        {/* Subtle particles */}
        <div className="particles">
          <div className="particle" style={{ '--delay': '0s', '--x': '20%', '--y': '30%' }} />
          <div className="particle" style={{ '--delay': '0.5s', '--x': '80%', '--y': '20%' }} />
          <div className="particle" style={{ '--delay': '1s', '--x': '70%', '--y': '70%' }} />
          <div className="particle" style={{ '--delay': '1.5s', '--x': '30%', '--y': '80%' }} />
        </div>
      </div>

      {/* Main Landing Content */}
      <div className={`landing-main ${showMain ? 'visible' : ''}`}>
        <div className="landing-content">
          <img 
            src={`${process.env.PUBLIC_URL}/logo.png`} 
            alt="Plumfolio" 
            className="landing-logo"
          />
          
          <p className="landing-tagline">
            Track your finances with clarity
          </p>

          <div className="landing-buttons">
            <button onClick={() => navigate('/signup')} className="btn-main">
              Get Started
              <ArrowRight size={18} />
            </button>
            <button onClick={() => navigate('/signin')} className="btn-outline">
              Sign In
            </button>
          </div>
        </div>

        <footer className="landing-footer">
          <p>Leon Maunge &middot; University of Botswana</p>
        </footer>
      </div>
    </div>
  );
};

export default Landing;
