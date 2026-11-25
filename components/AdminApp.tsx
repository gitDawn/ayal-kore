'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Banner } from '@/components/Chrome';
import Uploader from '@/components/InventoryUploader';
import StaffTabs, { BANNERS, useSection } from '@/components/StaffTabs';

type Status = 'loading' | 'signed-out' | 'signed-in';

function authMessage(err: unknown): string {
  const msg = (err as { message?: string })?.message || '';
  if (/invalid login credentials/i.test(msg)) return 'הדואר או הסיסמה לא נכונים.';
  if (/rate limit|too many/i.test(msg)) return 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.';
  if (/password/i.test(msg) && /characters|short|weak/i.test(msg)) return 'הסיסמה קצרה מדי. נדרשים לפחות 8 תווים.';
  return 'לא הצלחנו להתחבר. נסו שוב.';
}

export default function AdminApp() {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setStatus(data.session ? 'signed-in' : 'signed-out');
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setStatus(session ? 'signed-in' : 'signed-out');
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) { setAllowed(null); return; }
    supabase().rpc('is_staff').then(({ data, error }) => setAllowed(!error && data === true));
  }, [user]);

  const section = useSection();
  const b = BANNERS[section];
  return (
    <>
      <Banner title={b[0]} subtitle={b[1]} />
      <div className="section">
        {status === 'loading' ? <p className="status">טוען…</p>
          : status === 'signed-out' || !user ? <SignIn />
          : (
            <div className="stack">
              <div className="whoami">
                <span>מחובר/ת בתור <b>{user.email}</b></span>
                <button className="btn ghost" type="button" onClick={() => supabase().auth.signOut()}>התנתקות</button>
              </div>
              {allowed === null ? (
                <p className="status">בודק הרשאות…</p>
              ) : allowed ? (
                <StaffTabs section={section} uploader={<Uploader />} />
              ) : (
                <p className="msg err">החשבון הזה לא ברשימת המורשים לעדכן את המלאי.</p>
              )}
            </div>
          )}
      </div>
    </>
  );
}

// ── Sign in (no sign-up: accounts exist only by invitation) ──

function SignIn() {
  const [mode, setMode] = useState<'in' | 'forgot'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setNote(''); setBusy(true);
    try {
      const sb = supabase();
      if (mode === 'in') {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });
        if (error) throw error;
        setNote('אם הכתובת רשומה, נשלח אליה קישור לאיפוס סיסמה.');
      }
    } catch (e2) {
      setErr(authMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-box stack" onSubmit={submit}>
      <h2 className="search-title">{mode === 'in' ? 'כניסת צוות' : 'איפוס סיסמה'}</h2>
      <label className="field">דואר אלקטרוני
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
      </label>
      {mode === 'in' && (
        <label className="field">סיסמה
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
        </label>
      )}
      {err && <p className="msg err" role="alert">{err}</p>}
      {note && <p className="msg ok" role="status">{note}</p>}
      <button className="btn" type="submit" disabled={busy}>
        {busy ? 'רגע…' : mode === 'in' ? 'כניסה' : 'שליחת קישור'}
      </button>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        {mode === 'in'
          ? <button type="button" className="linkish" onClick={() => { setMode('forgot'); setErr(''); setNote(''); }}>שכחתי סיסמה</button>
          : <button type="button" className="linkish" onClick={() => { setMode('in'); setErr(''); }}>חזרה לכניסה</button>}
        <span className="sub" style={{ fontSize: 13, color: 'var(--muted)' }}>חשבונות נפתחים בהזמנה בלבד</span>
      </div>
    </form>
  );
}
