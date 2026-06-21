const onboardingKey = (userId) => `plumfolio:onboarding:${userId}`;

export const isOnboardingComplete = (userId) => {
  if (!userId) return false;
  try {
    const raw = localStorage.getItem(onboardingKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.completed) return true;
    }
  } catch (_) { /* ignore */ }
  return false;
};

export const markOnboardingComplete = (userId, meta = {}) => {
  if (!userId) return;
  try {
    localStorage.setItem(onboardingKey(userId), JSON.stringify({
      completed: true,
      completedAt: new Date().toISOString(),
      ...meta,
    }));
  } catch (_) { /* ignore quota */ }
};

export const shouldShowOnboarding = (userId, { transactions = [], budgets = [] } = {}) => {
  if (!userId) return false;
  if (isOnboardingComplete(userId)) return false;
  if (transactions.length > 0 || budgets.length > 0) {
    markOnboardingComplete(userId, { reason: 'existing_data' });
    return false;
  }
  return true;
};
