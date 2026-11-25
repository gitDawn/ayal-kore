'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { SiteNav, Banner, SiteFoot } from '@/components/Chrome';

// Landing page for both invitation links and password-reset links.
// The Supabase client reads the token from the URL and opens a session;
// the person then chooses a password.
export default function SetPasswordPage() {
  const [ready, setReady] = useState<'wait' | 'ok' | 'none'>('wait');
  const [email, setEmail] = useState('');
  const [isInvite, setIsInvite] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    setIsInvite(hash.get('type') === 'invite');
    const sb = supabase();
    let settled = false;
    const finish = (e?: string | null) => {
      if (settled) return;
      settled = true;
      if (e) { setEmail(e); setReady('ok'); } else setReady('none');
    };
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      if (session) finish(session.user.email ?? '');
    });
    sb.auth.getSession().then(({ data }) => { if (data.session) finish(data.session.user.email ?? ''); });
    const t = setTimeout(() => finish(null), 4000);
    return () => { clearTimeout(t); sub.subscription.unsubscribe(); };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (pw.length < 8) { setErr('הסיסמה צריכה להיות באורך 8 תווים לפחות.'); return; }
    if (pw !== pw2) { setErr('הסיסמאות לא זהות.'); return; }
    setBusy(true);
    const { error } = await supabase().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setErr('לא הצלחנו לשמור את הסיסמה. בקשו קישור חדש ונסו שוב.'); return; }
    setDone(true);
    history.replaceState(null, '', '/auth/reset-password');
  }

  return (
    <>
      <SiteNav active="admin" />
      <main className="stage">
        <div className="card">
          <Banner title={isInvite ? 'הצטרפות לצוות' : 'בחירת סיסמה'} subtitle="כניסת צוות" />
          <div className="section">
            <div className="auth-box stack">
              {ready === 'wait' ? (
                <p className="status">טוען…</p>
              ) : done ? (
                <>
                  <p className="msg ok">הסיסמה נשמרה. אתם מחוברים.</p>
                  <Link className="btn" href="/admin/upload" style={{ textAlign: 'center', textDecoration: 'none' }}>לעדכון המלאי</Link>
                </>
              ) : ready === 'none' ? (
                <>
                  <p className="msg err">הקישור לא תקין או שפג תוקפו. בקשו קישור חדש מעמוד הכניסה (שכחתי סיסמה).</p>
                  <Link className="linkish" href="/admin">לעמוד הכניסה</Link>
                </>
              ) : (
                <form className="stack" onSubmit={submit}>
                  <p className="search-hint" style={{ margin: 0 }}>בחרו סיסמה לחשבון <b dir="ltr">{email}</b></p>
                  <label className="field">סיסמה חדשה
                    <input type="password" required minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} dir="ltr" />
                  </label>
                  <label className="field">שוב, לאימות
                    <input type="password" required minLength={8} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} dir="ltr" />
                  </label>
                  {err && <p className="msg err" role="alert">{err}</p>}
                  <button className="btn" type="submit" disabled={busy}>{busy ? 'רגע…' : 'שמירת סיסמה'}</button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
      <SiteFoot />
    </>
  );
}
