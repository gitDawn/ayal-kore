'use client';

import { useEffect } from 'react';

/**
 * Password-reset emails can land on any page (often the root) with the
 * recovery token in the URL fragment or query. Send them to the reset page.
 */
export default function RecoveryRedirect() {
  useEffect(() => {
    if (window.location.pathname.startsWith('/auth/reset-password')) return;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const query = new URLSearchParams(window.location.search);
    const t = hash.get('type') || query.get('type');
    const isRecovery = t === 'recovery' || t === 'invite';
    if (isRecovery) {
      window.location.replace('/auth/reset-password' + window.location.search + window.location.hash);
    }
  }, []);
  return null;
}
