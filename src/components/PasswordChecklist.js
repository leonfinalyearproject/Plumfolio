import React from 'react';
import { Check, Circle } from 'lucide-react';
import { getPasswordRequirements } from '../utils/validation';

const RULES = [
  { key: 'length', label: 'At least 8 characters' },
  { key: 'uppercase', label: 'One uppercase letter' },
  { key: 'lowercase', label: 'One lowercase letter' },
  { key: 'number', label: 'One number' },
];

const PasswordChecklist = ({ password, visible }) => {
  if (!visible) return null;

  const requirements = getPasswordRequirements(password);
  const metCount = RULES.filter((r) => requirements[r.key]).length;

  return (
    <div className="password-checklist" aria-live="polite">
      <div className="password-checklist-header">
        <span>Password requirements</span>
        <span className="password-checklist-count">{metCount}/{RULES.length}</span>
      </div>
      <ul className="password-checklist-list">
        {RULES.map(({ key, label }) => {
          const met = requirements[key];
          return (
            <li key={key} className={met ? 'met' : ''}>
              {met ? <Check size={13} aria-hidden="true" /> : <Circle size={13} aria-hidden="true" />}
              {label}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default PasswordChecklist;
