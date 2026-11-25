'use client';

import { useState } from 'react';

/** A cover image that falls back to the "no image" box if it fails to load (for example, a blocked external link). */
export default function CoverImg({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className="no-cover" aria-hidden="true">אין תמונה זמינה</div>;
  return <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}
