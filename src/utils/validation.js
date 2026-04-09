// src/utils/validation.js
// Comprehensive validation rules for all Plumfolio forms

// ========== NUMERIC VALIDATION ==========
export const validateAmount = (value) => {
  if (value === '' || value === null || value === undefined) return 'Amount is required';
  const num = parseFloat(value);
  if (isNaN(num)) return 'Enter a valid number';
  if (num <= 0) return 'Amount must be greater than 0';
  if (num > 10000000) return 'Amount is unrealistically high (max P10,000,000)';
  const str = value.toString();
  if (str.includes('.') && str.split('.')[1]?.length > 2) return 'Maximum 2 decimal places';
  if (!/^-?\d+(\.\d+)?$/.test(str)) return 'Only numbers allowed';
  return '';
};

export const validateBudgetAmount = (value) => {
  if (value === '' || value === null || value === undefined) return 'Budget amount is required';
  const num = parseFloat(value);
  if (isNaN(num)) return 'Enter a valid number';
  if (num <= 0) return 'Budget must be greater than 0';
  if (num < 10) return 'Budget must be at least P10';
  if (num > 10000000) return 'Budget is unrealistically high';
  const str = value.toString();
  if (str.includes('.') && str.split('.')[1]?.length > 2) return 'Maximum 2 decimal places';
  return '';
};

export const validateGoalTarget = (value) => {
  if (value === '' || value === null || value === undefined) return 'Target amount is required';
  const num = parseFloat(value);
  if (isNaN(num)) return 'Enter a valid number';
  if (num < 10) return 'Target must be at least P10';
  if (num > 100000000) return 'Target is unrealistically high';
  return '';
};

export const validateSavedAmount = (value, target) => {
  if (value === '' || value === null || value === undefined) return '';
  const num = parseFloat(value);
  if (isNaN(num)) return 'Enter a valid number';
  if (num < 0) return 'Saved amount cannot be negative';
  if (target && num > parseFloat(target)) return 'Saved cannot exceed target';
  return '';
};

// ========== TEXT VALIDATION ==========
export const validateDescription = (value) => {
  if (!value || !value.trim()) return 'Description is required';
  const trimmed = value.trim();
  if (trimmed.length < 2) return 'Description too short (min 2 characters)';
  if (trimmed.length > 100) return 'Description too long (max 100 characters)';
  if (/<script|javascript:|onerror=/i.test(trimmed)) return 'Invalid characters in description';
  return '';
};

export const validateGoalName = (value) => {
  if (!value || !value.trim()) return 'Goal name is required';
  const trimmed = value.trim();
  if (trimmed.length < 2) return 'Name too short (min 2 characters)';
  if (trimmed.length > 50) return 'Name too long (max 50 characters)';
  if (/<script|javascript:|onerror=/i.test(trimmed)) return 'Invalid characters';
  return '';
};

export const validateFullName = (value) => {
  if (!value || !value.trim()) return 'Full name is required';
  const trimmed = value.trim();
  if (trimmed.length < 2) return 'Name must be at least 2 characters';
  if (trimmed.length > 60) return 'Name too long (max 60 characters)';
  if (!/^[a-zA-Z\s'-]+$/.test(trimmed)) return 'Name can only contain letters, spaces, hyphens, and apostrophes';
  return '';
};

// ========== DATE VALIDATION ==========
export const validateDate = (value) => {
  if (!value) return 'Date is required';
  const date = new Date(value);
  if (isNaN(date.getTime())) return 'Invalid date';
  const now = new Date();
  const tenYearsAgo = new Date(now.getFullYear() - 10, 0, 1);
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (date < tenYearsAgo) return 'Date cannot be more than 10 years ago';
  if (date > tomorrow) return 'Date cannot be in the future';
  return '';
};

export const validateFutureDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return 'Invalid date';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (date < now) return 'Deadline must be in the future';
  const tenYearsLater = new Date(now.getFullYear() + 10, 0, 1);
  if (date > tenYearsLater) return 'Deadline too far in the future';
  return '';
};

export const validateMonth = (value) => {
  if (!value) return 'Month is required';
  if (!/^\d{4}-\d{2}$/.test(value)) return 'Invalid month format';
  const [year, month] = value.split('-').map(Number);
  if (year < 2020 || year > 2035) return 'Year must be between 2020 and 2035';
  if (month < 1 || month > 12) return 'Invalid month';
  return '';
};

// ========== SELECT VALIDATION ==========
export const validateCategory = (value, categories) => {
  if (!value) return 'Category is required';
  if (categories && !categories.includes(value)) return 'Invalid category';
  return '';
};

// ========== AUTH VALIDATION ==========
export const validateEmail = (value) => {
  if (!value || !value.trim()) return 'Email is required';
  const trimmed = value.trim();
  if (trimmed.length > 254) return 'Email too long';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Enter a valid email address';
  if (/\.\./.test(trimmed)) return 'Email contains consecutive dots';
  if (/^\.|\.$/.test(trimmed.split('@')[0])) return 'Email cannot start or end with a dot';
  return '';
};

export const validatePassword = (value) => {
  if (!value) return 'Password is required';
  if (value.length < 8) return 'Password must be at least 8 characters';
  if (value.length > 128) return 'Password is too long';
  if (!/[A-Z]/.test(value)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(value)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(value)) return 'Password must contain at least one number';
  return '';
};

export const validatePasswordSimple = (value) => {
  if (!value) return 'Password is required';
  if (value.length < 6) return 'Password must be at least 6 characters';
  return '';
};

export const validatePasswordMatch = (password, confirmPassword) => {
  if (!confirmPassword) return 'Please confirm your password';
  if (password !== confirmPassword) return 'Passwords do not match';
  return '';
};

// ========== FULL FORM VALIDATORS ==========
export const validateTransactionForm = (formData, categories) => {
  const errors = {};
  const amountErr = validateAmount(formData.amount);
  const descErr = validateDescription(formData.description);
  const dateErr = validateDate(formData.date);
  const catErr = validateCategory(formData.category, categories);
  if (amountErr) errors.amount = amountErr;
  if (descErr) errors.description = descErr;
  if (dateErr) errors.date = dateErr;
  if (catErr) errors.category = catErr;
  if (!['income', 'expense'].includes(formData.type)) errors.type = 'Select income or expense';
  return { isValid: Object.keys(errors).length === 0, errors };
};

export const validateBudgetForm = (formData, categories) => {
  const errors = {};
  const amtErr = validateBudgetAmount(formData.allocated);
  const catErr = validateCategory(formData.category, categories);
  const monthErr = validateMonth(formData.month_year);
  if (amtErr) errors.allocated = amtErr;
  if (catErr) errors.category = catErr;
  if (monthErr) errors.month_year = monthErr;
  return { isValid: Object.keys(errors).length === 0, errors };
};

export const validateGoalForm = (formData) => {
  const errors = {};
  const nameErr = validateGoalName(formData.name);
  const targetErr = validateGoalTarget(formData.target);
  const savedErr = validateSavedAmount(formData.saved, formData.target);
  const deadlineErr = validateFutureDate(formData.deadline);
  if (nameErr) errors.name = nameErr;
  if (targetErr) errors.target = targetErr;
  if (savedErr) errors.saved = savedErr;
  if (deadlineErr) errors.deadline = deadlineErr;
  return { isValid: Object.keys(errors).length === 0, errors };
};

export const validateProfileForm = (formData) => {
  const errors = {};
  const nameErr = validateFullName(formData.fullName);
  if (nameErr) errors.fullName = nameErr;
  return { isValid: Object.keys(errors).length === 0, errors };
};

export const validateSignUpForm = (formData) => {
  const errors = {};
  const nameErr = validateFullName(formData.fullName);
  const emailErr = validateEmail(formData.email);
  const pwErr = validatePassword(formData.password);
  const confirmErr = validatePasswordMatch(formData.password, formData.confirmPassword);
  if (nameErr) errors.fullName = nameErr;
  if (emailErr) errors.email = emailErr;
  if (pwErr) errors.password = pwErr;
  if (confirmErr) errors.confirmPassword = confirmErr;
  return { isValid: Object.keys(errors).length === 0, errors };
};

export const validateSignInForm = (formData) => {
  const errors = {};
  const emailErr = validateEmail(formData.email);
  const pwErr = validatePasswordSimple(formData.password);
  if (emailErr) errors.email = emailErr;
  if (pwErr) errors.password = pwErr;
  return { isValid: Object.keys(errors).length === 0, errors };
};
