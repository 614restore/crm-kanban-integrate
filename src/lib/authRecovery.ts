export function hasPasswordRecoveryParams(locationLike?: Pick<Location, 'pathname' | 'search' | 'hash'>): boolean {
  if (typeof window === 'undefined' && !locationLike) return false;

  const location = locationLike ?? window.location;
  const params = new URLSearchParams(location.search);
  const hash = location.hash || '';
  const normalizedPath = location.pathname.replace(/\/+$/, '');
  const isResetPasswordPath = normalizedPath.endsWith('/reset-password');

  return (
    params.get('type') === 'recovery' ||
    hash.includes('type=recovery') ||
    (isResetPasswordPath && params.has('token_hash')) ||
    (isResetPasswordPath && hash.includes('token_hash=')) ||
    (isResetPasswordPath && params.has('code')) ||
    (isResetPasswordPath && params.has('access_token')) ||
    (isResetPasswordPath && hash.includes('access_token='))
  );
}

export function persistPasswordRecoveryFlag(): boolean {
  const hasRecovery = hasPasswordRecoveryParams();
  if (!hasRecovery || typeof window === 'undefined') return hasRecovery;

  try {
    sessionStorage.setItem('pending_password_reset', 'true');
  } catch (error) {
    console.warn('[authRecovery] Could not persist password reset flag:', error);
  }

  return hasRecovery;
}
