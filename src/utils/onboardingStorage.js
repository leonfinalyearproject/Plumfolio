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

const REPLAY_KEY = 'plumfolio:onboarding-replay';

export const isOnboardingReplayRequested = () => {
  try {
    return sessionStorage.getItem(REPLAY_KEY) === '1';
  } catch (_) {
    return false;
  }
};

/** Clear completion flag and allow the setup wizard to open again. */
export const requestOnboardingReplay = (userId) => {
  if (!userId) return;
  try {
    localStorage.removeItem(onboardingKey(userId));
    sessionStorage.setItem(REPLAY_KEY, '1');
  } catch (_) { /* ignore */ }
};

export const clearOnboardingReplay = () => {
  try {
    sessionStorage.removeItem(REPLAY_KEY);
  } catch (_) { /* ignore */ }
};

export const shouldShowOnboarding = (userId, { transactions = [], budgets = [] } = {}) => {
  if (!userId) return false;
  if (isOnboardingReplayRequested()) return true;
  if (isOnboardingComplete(userId)) return false;
  if (transactions.length > 0 || budgets.length > 0) {
    markOnboardingComplete(userId, { reason: 'existing_data' });
    return false;
  }
  return true;
};
