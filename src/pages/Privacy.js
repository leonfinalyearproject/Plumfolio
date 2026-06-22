import React from 'react';
import { Link } from 'react-router-dom';
import './Legal.css';

const LegalLayout = ({ title, children }) => (
  <div className="legal-page">
    <header className="legal-nav">
      <Link to="/" className="legal-back">← Back to Plumfolio</Link>
    </header>
    <article className="legal-doc">
      <p className="legal-doc-label">Legal</p>
      <h1>{title}</h1>
      <p className="legal-updated">Last updated: June 2026</p>
      <div className="legal-body">{children}</div>
      <footer className="legal-foot">
        <span>© {new Date().getFullYear()} Futurify Designs</span>
        <nav>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
        </nav>
      </footer>
    </article>
  </div>
);

const Privacy = () => (
  <LegalLayout title="Privacy Policy">
    <section>
      <h2>1. Who we are</h2>
      <p>
        Plumfolio is operated by Futurify Designs. This policy explains how we collect, use,
        and protect your information when you use the app.
      </p>
    </section>
    <section>
      <h2>2. Information we collect</h2>
      <p>When you use Plumfolio, we may collect:</p>
      <ul>
        <li><strong>Account data:</strong> name, email address, and authentication credentials</li>
        <li><strong>Financial data you enter:</strong> transactions, budgets, savings goals, and preferences</li>
        <li><strong>Usage data:</strong> basic logs needed to operate and secure the service (e.g. sign-in events)</li>
        <li><strong>Device storage:</strong> local preferences saved in your browser (e.g. dashboard settings, onboarding status)</li>
      </ul>
    </section>
    <section>
      <h2>3. How we use your information</h2>
      <p>We use your data to:</p>
      <ul>
        <li>Provide and maintain your Plumfolio account</li>
        <li>Sync your records across sessions and devices</li>
        <li>Generate dashboards, budgets, forecasts, and reports from your entries</li>
        <li>Send account-related emails (e.g. email verification, password reset)</li>
        <li>Improve reliability and security of the platform</li>
      </ul>
      <p>We do not sell your personal or financial data to third parties.</p>
    </section>
    <section>
      <h2>4. Storage &amp; security</h2>
      <p>
        Account and financial data are stored using Supabase (hosted PostgreSQL with row-level
        security). Data is transmitted over HTTPS. Access to your records is restricted to your
        authenticated account. No system is perfectly secure; use a strong, unique password.
      </p>
    </section>
    <section>
      <h2>5. Third-party services</h2>
      <p>
        Plumfolio may use third-party services for authentication, hosting, and exchange-rate
        data. These providers process data only as needed to deliver their function and are
        bound by their own privacy policies.
      </p>
    </section>
    <section>
      <h2>6. Cookies &amp; local storage</h2>
      <p>
        We use browser local storage and session storage to keep you signed in and remember
        preferences. You can clear this data via your browser settings; doing so may sign you out
        or reset local preferences.
      </p>
    </section>
    <section>
      <h2>7. Your rights</h2>
      <p>You can:</p>
      <ul>
        <li>Access and update your profile in Settings</li>
        <li>Export or review your data through the app&apos;s reports and transaction views</li>
        <li>Delete your account and all associated data from Settings</li>
        <li>Request information about how your data is handled by contacting Futurify Designs</li>
      </ul>
    </section>
    <section>
      <h2>8. Children</h2>
      <p>
        Plumfolio is not intended for users under 16. We do not knowingly collect data from
        children. If you believe a child has registered, contact us to remove the account.
      </p>
    </section>
    <section>
      <h2>9. Changes</h2>
      <p>
        We may update this Privacy Policy from time to time. The &ldquo;Last updated&rdquo; date
        at the top will change when we do. Continued use after updates means you accept the revised policy.
      </p>
    </section>
    <section>
      <h2>10. Contact</h2>
      <p>
        Privacy questions: contact Futurify Designs through the support channels provided in
        the app or on the Plumfolio website.
      </p>
    </section>
  </LegalLayout>
);

export default Privacy;
