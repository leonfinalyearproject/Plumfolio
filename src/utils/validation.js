// src/utils/validation.js
// Shared validation rules for Plumfolio forms

export const validateAmount = (value) => {
  if (!value && value !== 0) return 'Amount is required';
  const num = parseFloat(value);
  if (isNaN(num)) return 'Enter a valid number';
  if (num <= 0) return 'Amount must be greater than 0';
  if (num > 10000000) return 'Amount seems unrealistically high (max P10,000,000)';
  if (value.toString().includes('.') && value.toString().split('.')[1]?.length > 2) return 'Maximum 2 decimal places';
  return '';
};

export const validateDescription = (value) => {
  if (!value || !value.trim()) return 'Description is required';
  if (value.trim().length < 2) return 'Description too short (min 2 characters)';
  if (value.trim().length > 100) return 'Description too long (max 100 characters)';
  return '';
};

export const validateDate = (value) => {
  if (!value) return 'Date is required';
  const date = new Date(value);
  if (isNaN(date.getTime())) return 'Invalid date';
  const now = new Date();
  const tenYearsAgo = new Date(now.getFullYear() - 10, 0, 1);
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (date < tenYearsAgo) return 'Date is too far in the past';
  if (date > tomorrow) return 'Date cannot be in the future';
  return '';
};

export const validateCategory = (value, categories) => {
  if (!value) return 'Category is required';
  if (categories && !categories.includes(value)) return 'Invalid category';
  return '';
};

export const validateBudgetAmount = (value) => {
  if (!value && value !== 0) return 'Budget amount is required';
  const num = parseFloat(value);
  if (isNaN(num)) return 'Enter a valid number';
  if (num <= 0) return 'Budget must be greater than 0';
  if (num > 10000000) return 'Budget seems unrealistically high';
  return '';
};

export const validateGoalName = (value) => {
  if (!value || !value.trim()) return 'Goal name is required';
  if (value.trim().length < 2) return 'Name too short';
  if (value.trim().length > 50) return 'Name too long (max 50 characters)';
  return '';
};

export const validateGoalTarget = (value) => {
  if (!value && value !== 0) return 'Target amount is required';
  const num = parseFloat(value);
  if (isNaN(num)) return 'Enter a valid number';
  if (num < 10) return 'Target must be at least P10';
  if (num > 100000000) return 'Target seems unrealistically high';
  return '';
};

export const validateEmail = (value) => {
  if (!value || !value.trim()) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address';
  return '';
};

export const validatePassword = (value) => {
  if (!value) return 'Password is required';
  if (value.length < 6) return 'Password must be at least 6 characters';
  if (value.length > 128) return 'Password is too long';
  return '';
};

export const validateFullName = (value) => {
  if (!value || !value.trim()) return 'Full name is required';
  if (value.trim().length < 2) return 'Name too short';
  if (value.trim().length > 60) return 'Name too long';
  if (!/^[a-zA-Z\s'-]+$/.test(value.trim())) return 'Name contains invalid characters';
  return '';
};

// Validate an entire transaction form
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

// Validate budget form
export const validateBudgetForm = (formData) => {
  const errors = {};
  const amtErr = validateBudgetAmount(formData.allocated);
  if (amtErr) errors.allocated = amtErr;
  if (!formData.category) errors.category = 'Select a category';
  if (!formData.month_year) errors.month_year = 'Select a month';
  return { isValid: Object.keys(errors).length === 0, errors };
};

// Validate savings goal form
export const validateGoalForm = (formData) => {
  const errors = {};
  const nameErr = validateGoalName(formData.name);
  const targetErr = validateGoalTarget(formData.target);
  if (nameErr) errors.name = nameErr;
  if (targetErr) errors.target = targetErr;
  if (formData.saved && parseFloat(formData.saved) < 0) errors.saved = 'Saved amount cannot be negative';
  if (formData.saved && parseFloat(formData.saved) > parseFloat(formData.target)) errors.saved = 'Saved cannot exceed target';
  if (formData.deadline) {
    const dl = new Date(formData.deadline);
    if (dl < new Date()) errors.deadline = 'Deadline should be in the future';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
};
