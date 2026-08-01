/* ==========================================================================
   RYAN REYNOLDS — CAREER PAGE
   MOTION & MICRO-INTERACTIONS
   --------------------------------------------------------------------------
   Drives every behaviour the CSS already expects but can't provide on its
   own: the .jsready flag that arms the .reveal entrance system, the mobile
   nav open/close state, the header's scrolled state, the stat count-ups,
   and the timeline's "you are here" marker.

   No animation library: everything here is either a CSS transition/
   animation toggled by a class, or a simple requestAnimationFrame loop for
   the counters. IntersectionObserver covers every "when does this enter
   the viewport" question natively, so GSAP/Motion One would add weight
   without adding capability for this page's needs.
   ========================================================================== */

(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  /* ------------------------------------------------------------------
     0. Footer year
     The markup ships a static fallback year for no-JS visitors; once
     JS runs, replace it so the copyright notice never goes stale.
     ------------------------------------------------------------------ */
  const footerYear = document.getElementById('footer-year');
  if (footerYear) footerYear.textContent = new Date().getFullYear();

  /* ------------------------------------------------------------------
     1. Arm the CSS entrance system
     .reveal defaults to fully visible in tokens.css; only once
     .jsready is present on <html> do elements hide and animate in.
     This order means a visitor without JS (or before it runs) always
     sees complete content, never a page stuck at opacity: 0.
     ------------------------------------------------------------------ */
  document.documentElement.classList.add('jsready');

  /* ------------------------------------------------------------------
     2. Mobile navigation
     Opens/closes the fullscreen panel, keeps aria-expanded in sync,
     closes on backdrop click, on link/CTA tap, and on Escape.
     ------------------------------------------------------------------ */
  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('primary-nav');
  const navBackdrop = document.querySelector('[data-nav-backdrop]');
  const body = document.body;

  /* Scroll lock — freezes the background page while the mobile menu is
     open. body.nav-open { overflow: hidden } alone isn't reliable on
     mobile Safari/iOS, so we also pin <body> with position: fixed and
     restore the exact scroll position on close. */
  let lockedScrollY = 0;

  function lockScroll() {
    lockedScrollY = window.scrollY;
    body.style.position = 'fixed';
    body.style.top = `-${lockedScrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
  }

  function unlockScroll() {
    if (body.style.position !== 'fixed') return;
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    window.scrollTo(0, lockedScrollY);
  }

  const closeNav = () => {
    document.documentElement.classList.remove('nav-open');
    body.classList.remove('nav-open');
    unlockScroll();
    navToggle?.setAttribute('aria-expanded', 'false');
    navToggle?.setAttribute('aria-label', 'Open menu');
  };

  const openNav = () => {
    document.documentElement.classList.add('nav-open');
    body.classList.add('nav-open');
    lockScroll();
    navToggle?.setAttribute('aria-expanded', 'true');
    navToggle?.setAttribute('aria-label', 'Close menu');
  };

  navToggle?.addEventListener('click', () => {
    body.classList.contains('nav-open') ? closeNav() : openNav();
  });

  navBackdrop?.addEventListener('click', closeNav);

  nav?.addEventListener('click', (event) => {
    if (event.target.matches('.nav-link, .nav-cta')) closeNav();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && body.classList.contains('nav-open')) {
      closeNav();
      navToggle?.focus();
    }
  });

  /* ------------------------------------------------------------------
     3. Header depth on scroll
     Adds .is-scrolled once the page has moved past the very top, so
     the glass header gains a touch more opacity/shadow instead of
     looking identical at the hero and ten sections down. Throttled to
     one check per animation frame.
     ------------------------------------------------------------------ */
  const header = document.querySelector('.header');
  if (header) {
    let ticking = false;
    const applyHeaderState = () => {
      header.classList.toggle('is-scrolled', window.scrollY > 24);
      ticking = false;
    };
    window.addEventListener(
      'scroll',
      () => {
        if (!ticking) {
          requestAnimationFrame(applyHeaderState);
          ticking = true;
        }
      },
      { passive: true }
    );
    applyHeaderState();
  }

  /* ------------------------------------------------------------------
     4. Scroll reveal
     Every .reveal element gets .is-visible the first time it crosses
     ~20% into the viewport, then stops being observed — entrances run
     once, not every time the user scrolls back up past a section.
     Reduced-motion visitors, or browsers without IntersectionObserver,
     get everything visible immediately.
     ------------------------------------------------------------------ */
  const revealEls = document.querySelectorAll('.reveal');

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2, rootMargin: '0px 0px -8% 0px' }
    );
    revealEls.forEach((el) => revealObserver.observe(el));
  }

  /* ------------------------------------------------------------------
     5. Stat counters
     Counts .stat__number / .stat-card__number up from 0 the first
     time each one enters view. Only numeric-leading values ("40+",
     "12+"...) are counted — text values like "Millions" or "Global"
     are left as static reveals, since there's nothing to count up to.
     tabular-nums (already set in stats.css/awards.css) keeps the
     digits from jittering in width as they change.
     ------------------------------------------------------------------ */
  const countEls = document.querySelectorAll(
    '.stat__number, .stat-card__number'
  );

  const animateCount = (el) => {
    const match = el.textContent.trim().match(/^(\d+)(.*)$/);
    if (!match) return;

    const target = parseInt(match[1], 10);
    const suffix = match[2];

    if (prefersReducedMotion) {
      el.textContent = `${target}${suffix}`;
      return;
    }

    const duration = 1200;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      el.textContent = `${Math.round(eased * target)}${suffix}`;
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  };

  if (countEls.length && 'IntersectionObserver' in window) {
    const countObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            countObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    countEls.forEach((el) => countObserver.observe(el));
  }

  /* ------------------------------------------------------------------
     6. Timeline "you are here" marker
     Toggles .is-current (styled in timeline.css as a soft glow on the
     rail dot) on whichever entry sits inside a thin band around the
     vertical center of the viewport, so the rail always shows exactly
     where the reader currently is in Ryan's career.
     ------------------------------------------------------------------ */
  const timelineItems = document.querySelectorAll('.timeline__item');

  if (timelineItems.length && 'IntersectionObserver' in window) {
    const timelineObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle('is-current', entry.isIntersecting);
        });
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    );
    timelineItems.forEach((el) => timelineObserver.observe(el));
  }

  /* ------------------------------------------------------------------
     7. Featured Productions — controlled horizontal drag (mobile)
     touch-action is set to `pan-y` on .productions__grid so the browser
     never auto-locks a swipe onto this element's horizontal axis (that
     native lock is what was blocking vertical page scrolling before).
     Instead we read the very first few pixels of the gesture ourselves:
     if it's clearly more horizontal than vertical, we take over and
     drive scrollLeft by hand; otherwise we do nothing and let the page
     scroll normally. Once an axis is picked, it's locked for the rest
     of that gesture so the drag doesn't flip mid-swipe.
     ------------------------------------------------------------------ */
  const productionsGrid = document.querySelector('.productions__grid');

  if (productionsGrid) {
    const DIRECTION_THRESHOLD = 6; // px of movement before we commit to an axis

    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let axis = null; // null = undecided, 'x' = horizontal drag, 'y' = leave to the page

    productionsGrid.addEventListener(
      'touchstart',
      (event) => {
        const touch = event.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        startScrollLeft = productionsGrid.scrollLeft;
        axis = null;
      },
      { passive: true }
    );

    productionsGrid.addEventListener(
      'touchmove',
      (event) => {
        const touch = event.touches[0];
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;

        if (axis === null) {
          if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < DIRECTION_THRESHOLD) {
            return; // not enough movement yet to tell intent apart
          }
          axis = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y';
        }

        if (axis === 'x') {
          // Clearly a horizontal swipe on the carousel: drive it ourselves
          // and stop the browser from doing anything else with this touch.
          event.preventDefault();
          productionsGrid.scrollLeft = startScrollLeft - deltaX;
        }
        // axis === 'y': do nothing here — the gesture belongs to the page,
        // which keeps scrolling normally since we never called preventDefault.
      },
      { passive: false }
    );
  }
})();
