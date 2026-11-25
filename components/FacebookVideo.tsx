'use client';

// One Facebook video or reel, played inside the site with Facebook's embedded video player.
import { useEffect, useRef, useState } from 'react';

export default function FacebookVideo({ href, title, vertical = true }: { href: string; title: string; vertical?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const max = vertical ? 360 : 640;
    const measure = () => setWidth(Math.max(220, Math.min(max, Math.floor(el.clientWidth))));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [vertical]);

  const height = Math.round(width * (vertical ? 16 / 9 : 9 / 16));
  const src = 'https://www.facebook.com/plugins/video.php?' + new URLSearchParams({
    href, show_text: 'false', width: String(width), locale: 'he_IL',
  }).toString();

  return (
    <div className="fb-video" ref={box}>
      {width > 0 && (
        <iframe
          key={width}
          title={title}
          src={src}
          width={width}
          height={height}
          style={{ border: 'none', overflow: 'hidden' }}
          scrolling="no"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
        />
      )}
      <a className="fb-video-link" href={href} target="_blank" rel="noopener noreferrer">לצפייה בפייסבוק</a>
    </div>
  );
}
