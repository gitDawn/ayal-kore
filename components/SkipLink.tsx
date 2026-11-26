'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** "Skip to main content" link: moves keyboard focus to the page's main area. */
export default function SkipLink() {
  const path = usePathname();
  // Every page has one <main>; give it the id the link points to.
  useEffect(() => {
    const main = document.querySelector('main');
    if (main && !main.id) main.id = 'main';
  }, [path]);
  return (
    <a
      href="#main"
      className="skip-link"
      onClick={(e) => {
        const main = document.querySelector('main');
        if (!main) return;
        e.preventDefault();
        main.setAttribute('tabindex', '-1');
        main.focus();
        main.scrollIntoView();
      }}
    >
      דילוג לתוכן הראשי
    </a>
  );
}
