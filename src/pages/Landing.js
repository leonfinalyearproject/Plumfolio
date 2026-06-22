import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Landing.css';

const LEDGER_ROWS = [
  { date: '22 Jun', desc: 'Salary — deposited', amt: '+P12,450.00', type: 'in' },
  { date: '21 Jun', desc: 'Groceries — Choppies', amt: '−P842.30', type: 'out' },
  { date: '20 Jun', desc: 'Fuel — Puma', amt: '−P520.00', type: 'out' },
  { date: '19 Jun', desc: 'Budget — Food & Dining', amt: 'P2,400 left', type: 'meta' },
];

const CAPABILITIES = [
  { n: '01', title: 'Ledger', body: 'Every income and expense in one chronological record.' },
  { n: '02', title: 'Budgets', body: 'Monthly limits by category — see what is left before you spend.' },
  { n: '03', title: 'Forecasts', body: 'Projected spending based on your actual habits, not guesses.' },
  { n: '04', title: 'Reports', body: 'Export-ready summaries when you need the full picture.' },
];

const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 4000);
    return () => clearInterval(id);
  }, []);

  const balanceHighlight = tick % 2 === 0 ? 'P12,450.00' : 'P11,087.70';

  return (
    <div className="lp">
      <div className="lp-rule lp-rule--top" aria-hidden="true" />

      <header className="lp-nav">
        <a href={`${process.env.PUBLIC_URL}/`} className="lp-mark">
          <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="" />
          <span>Plumfolio</span>
        </a>
        <nav className="lp-nav-links">
          <button type="button" onClick={() => navigate('/signin')}>Sign in</button>
          <button type="button" className="lp-nav-cta" onClick={() => navigate('/signup')}>
            Open account
          </button>
        </nav>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-hero-text">
            <p className="lp-kicker">Personal finance ledger</p>
            <h1>
              Your money,<br />
              <em>written clearly.</em>
            </h1>
            <p className="lp-deck">
              Plumfolio is a straight record of what comes in, what goes out,
              and what you planned — built for people who want numbers, not noise.
            </p>
            <div className="lp-hero-cta">
              <button type="button" className="lp-btn lp-btn--dark" onClick={() => navigate('/signup')}>
                Create free account
              </button>
              <button type="button" className="lp-btn lp-btn--line" onClick={() => navigate('/signin')}>
                I have an account
              </button>
            </div>
            <dl className="lp-meta">
              <div><dt>Cost</dt><dd>Free</dd></div>
              <div><dt>Setup</dt><dd>~2 min</dd></div>
              <div><dt>Sync</dt><dd>Real-time</dd></div>
            </dl>
          </div>

          <div className="lp-ledger" aria-label="Sample ledger preview">
            <div className="lp-ledger-head">
              <span className="lp-ledger-title">Statement · June 2026</span>
              <span className="lp-ledger-ref">PF-0622-A</span>
            </div>
            <div className="lp-ledger-balance">
              <span>Net this month</span>
              <strong className={tick % 2 === 0 ? '' : 'lp-flash'}>{balanceHighlight}</strong>
            </div>
            <table className="lp-ledger-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {LEDGER_ROWS.map((row) => (
                  <tr key={row.desc}>
                    <td>{row.date}</td>
                    <td>{row.desc}</td>
                    <td className={`lp-amt lp-amt--${row.type}`}>{row.amt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="lp-ledger-foot">Sample data · your figures replace this on day one</p>
          </div>
        </section>

        <section className="lp-band" aria-hidden="true">
          <div className="lp-band-track">
            <span>Budgets</span>
            <span>·</span>
            <span>Forecasts</span>
            <span>·</span>
            <span>Analytics</span>
            <span>·</span>
            <span>Receipt scan</span>
            <span>·</span>
            <span>Savings goals</span>
            <span>·</span>
            <span>Budgets</span>
            <span>·</span>
            <span>Forecasts</span>
            <span>·</span>
            <span>Analytics</span>
          </div>
        </section>

        <section className="lp-capabilities">
          <div className="lp-capabilities-head">
            <h2>What you get</h2>
            <p>Four tools. One ledger. No clutter.</p>
          </div>
          <div className="lp-cap-grid">
            {CAPABILITIES.map((c) => (
              <article key={c.n} className="lp-cap-item">
                <span className="lp-cap-n">{c.n}</span>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-close">
          <div className="lp-close-inner">
            <h2>Open your ledger today.</h2>
            <p>No card. No trial countdown. Just sign up and start recording.</p>
            <button type="button" className="lp-btn lp-btn--dark" onClick={() => navigate('/signup')}>
              Create account
            </button>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <span>© Plumfolio 2026</span>
        <span>University of Botswana · FYP</span>
      </footer>
    </div>
  );
};

export default Landing;
