import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowRight } from 'lucide-react';
import landingBg from './landing-bg.jpg';
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
        <div className="landing-bg" style={{ backgroundImage: `url(${landingBg})` }} />
        <div className="landing-overlay" />
        
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
