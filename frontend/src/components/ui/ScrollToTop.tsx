import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export const ScrollToTop: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Check window scroll position
      const windowScroll = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;

      // Check scroll on main element inside Layout
      const mainElement = document.querySelector('main');
      const mainScroll = mainElement ? mainElement.scrollTop : 0;

      // Show button if scrolled down past 200px
      if (windowScroll > 200 || mainScroll > 200) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    // Use capture: true so we listen to scroll events on both window and scrollable elements
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, []);

  const scrollToTop = () => {
    // Smooth scroll for window
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });

    // Smooth scroll for document element / body
    document.documentElement.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
    document.body.scrollTo({
      top: 0,
      behavior: 'smooth',
    });

    // Smooth scroll for <main> element (Layout.tsx container)
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Go to Top"
      title="Go to Top"
      className={`fixed bottom-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition-all duration-300 ease-in-out cursor-pointer ${
        isVisible
          ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
          : 'opacity-0 translate-y-4 scale-75 pointer-events-none'
      }`}
    >
      <ArrowUp className="h-5 w-5 stroke-[2.5]" />
    </button>
  );
};
