import React from 'react';
import { CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';

const AuthField = ({
  id,
  name,
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  onFocus,
  error,
  touched,
  hint,
  icon: Icon,
  variant = 'default',
  required = false,
  autoComplete,
  maxLength,
  minLength,
  placeholder,
  showToggle = false,
  showPassword = false,
  onTogglePassword,
  children,
}) => {
  const hasError = Boolean(touched && error);
  const isValid = Boolean(touched && !error && value && String(value).trim());
  const isLedger = variant === 'ledger';
  const showIcon = Icon && !isLedger;

  return (
    <div className={`input-group ${isLedger ? 'input-group--ledger' : ''} ${hasError ? 'has-error' : ''} ${isValid ? 'is-valid' : ''}`}>
      <label htmlFor={id}>
        {label}
        {required && <span className="required" aria-hidden="true">*</span>}
      </label>

      <div className={`input-field ${isLedger ? 'input-field--ledger' : ''} ${hasError ? 'error' : ''} ${isValid ? 'valid' : ''}`}>
        {showIcon && <Icon size={18} aria-hidden="true" />}
        <input
          type={showToggle ? (showPassword ? 'text' : 'password') : type}
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
          placeholder={placeholder}
          autoComplete={autoComplete}
          maxLength={maxLength}
          minLength={minLength}
          required={required}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${id}-error` : hint ? `${id}-hint` : undefined}
        />

        {showToggle && (
          <button
            type="button"
            className="password-toggle"
            onClick={onTogglePassword}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}

        {isValid && !showToggle && (
          <CheckCircle2 size={16} className="field-valid-icon" aria-hidden="true" />
        )}
      </div>

      {hasError ? (
        <span className="field-error" id={`${id}-error`} role="alert">
          <AlertCircle size={12} aria-hidden="true" />
          {error}
        </span>
      ) : hint ? (
        <span className="field-hint" id={`${id}-hint`}>{hint}</span>
      ) : null}

      {children}
    </div>
  );
};

export default AuthField;
