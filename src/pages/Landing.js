import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Landing.css';

const LEDGER_ROWS = [
  { date: '22 Jun', desc: 'Salary — deposited', amt: '+12,450.00', type: 'in' },
  { date: '21 Jun', desc: 'Groceries — Choppies', amt: '−842.30', type: 'out' },
  { date: '20 Jun', desc: 'Fuel — Puma', amt: '−520.00', type: 'out' },
  { date: '19 Jun', desc: 'Budget — Food & Dining', amt: '2,400 left', type: 'meta' },
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

  const balanceHighlight = tick % 2 === 0 ? '12,450.00' : '11,087.70';

  return (
    <div className="lp">
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

      <main className="lp-desk">
        {/* Open ledger book — hero spread */}
        <section className="lp-book-wrap" aria-label="Plumfolio ledger preview">
          <div className="lp-book">
            <div className="lp-page lp-page--left">
              <div className="lp-page-holes" aria-hidden="true">
                <span /><span /><span />
              </div>
              <div className="lp-page-inner">
                <p className="lp-page-label">Account · Personal</p>
                <h1>
                  Your money,<br />
                  <em>written clearly.</em>
                </h1>
                <p className="lp-deck">
                  A straight record of what comes in, what goes out,
                  and what you planned — numbers, not noise.
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
            </div>

            <div className="lp-spine" aria-hidden="true">
              <span className="lp-spine-title">Plumfolio</span>
            </div>

            <div className="lp-page lp-page--right">
              <div className="lp-page-inner">
                <div className="lp-sheet-head">
                  <span>June 2026</span>
                  <span>Folio 22</span>
                </div>
                <div className="lp-sheet-balance">
                  <span>Net this month (P)</span>
                  <strong className={tick % 2 === 0 ? '' : 'lp-flash'}>{balanceHighlight}</strong>
                </div>
                <div className="lp-columns" aria-hidden="true" />
                <table className="lp-sheet-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Particulars</th>
                      <th>Dr</th>
                      <th>Cr</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LEDGER_ROWS.map((row) => (
                      <tr key={row.desc}>
                        <td>{row.date}</td>
                        <td>{row.desc}</td>
                        {row.type === 'in' && (
                          <>
                            <td className="lp-amt lp-amt--in">{row.amt}</td>
                            <td />
                          </>
                        )}
                        {row.type === 'out' && (
                          <>
                            <td />
                            <td className="lp-amt lp-amt--out">{row.amt.replace('−', '')}</td>
                          </>
                        )}
                        {row.type === 'meta' && (
                          <>
                            <td colSpan={2} className="lp-amt lp-amt--meta">{row.amt}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="lp-sheet-foot">Sample entries · yours replace these on day one</p>
              </div>
            </div>
          </div>
        </section>

        {/* Index page — capabilities */}
        <section className="lp-index">
          <div className="lp-index-page">
            <div className="lp-page-holes" aria-hidden="true">
              <span /><span /><span />
            </div>
            <div className="lp-page-inner">
              <p className="lp-page-label">Index</p>
              <h2>What this book covers</h2>
              <div className="lp-index-grid">
                {CAPABILITIES.map((c) => (
                  <article key={c.n} className="lp-index-row">
                    <span className="lp-index-n">{c.n}</span>
                    <div>
                      <h3>{c.title}</h3>
                      <p>{c.body}</p>
                    </div>
                    <span className="lp-index-dots" aria-hidden="true" />
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="lp-close">
          <div className="lp-close-page">
            <p className="lp-page-label">End matter</p>
            <h2>Start your first page.</h2>
            <p>No card. No trial. Open the book and record.</p>
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
