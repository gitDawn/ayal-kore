'use client';

// The store's Facebook page, embedded with Facebook's official page plugin.
// New posts appear here automatically; the width follows the available space (Facebook allows 180 to 500).
import { useEffect, useRef, useState } from 'react';
import { STORE_FACEBOOK } from '@/lib/inventory';

const HEIGHT = 1400;

export default function FacebookFeed() {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(180, Math.min(500, Math.floor(el.clientWidth))));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const src = 'https://www.facebook.com/plugins/page.php?' + new URLSearchParams({
    href: STORE_FACEBOOK,
    tabs: 'timeline',
    width: String(width),
    height: String(HEIGHT),
    small_header: 'false',
    adapt_container_width: 'true',
    hide_cover: 'false',
    show_facepile: 'false',
    locale: 'he_IL',
  }).toString();

  return (
    <div className="fb-feed" ref={box}>
      {width > 0 && (
        <iframe
          key={width}
          title="הפוסטים של האיל הקורא בפייסבוק"
          src={src}
          width={width}
          height={HEIGHT}
          style={{ border: 'none', overflow: 'hidden' }}
          scrolling="no"
          allow="encrypted-media; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
        />
      )}
      <p className="search-hint fb-fallback">
        לא רואים את הפוסטים? ייתכן שהדפדפן חוסם תוכן מפייסבוק.{' '}
        <a href={STORE_FACEBOOK} target="_blank" rel="noopener noreferrer">לדף שלנו בפייסבוק</a>
      </p>
    </div>
  );
}
