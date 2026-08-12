/* ===========================================================================
   RYAN REYNOLDS — GALLERY
   SCRIPT — navigation mobile + système d'apparition au scroll (Phase 5)
   -------------------------------------------------------------------------
   Deux responsabilités volontairement séparées en deux fonctions
   indépendantes : la navigation mobile a besoin de JS pour exister
   (ouvrir/fermer un panneau n'est pas faisable en CSS pur ici), le
   scroll-reveal est un pur bonus visuel — s'il échoue, il ne doit
   jamais empêcher la navigation de fonctionner (voir le filet de
   sécurité <noscript> dans le <head> pour le cas où JS est absent).
   =========================================================================== */

(function () {
  'use strict';

  /* -------------------------------------------------------------
     1. Navigation mobile
     -------------------------------------------------------------
     Ouvre/ferme le panneau plein écran (body.nav-open), garde
     aria-expanded synchronisé pour les lecteurs d'écran, et referme
     le menu sur clic du rideau, touche Échap, ou clic d'un lien —
     un utilisateur qui vient de choisir sa destination ne doit pas
     avoir à refermer le menu lui-même.
     ------------------------------------------------------------- */
  function initMobileNav() {
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.getElementById('primary-nav');
    var backdrop = document.querySelector('[data-nav-backdrop]');
    var body = document.body;

    if (!toggle || !nav) return;

    var lockedScrollY = 0;

    function lockScroll() {
      lockedScrollY = window.scrollY;
      body.style.position = 'fixed';
      body.style.top = '-' + lockedScrollY + 'px';
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

    function openNav() {
      document.documentElement.classList.add('nav-open');
      body.classList.add('nav-open');
      lockScroll();
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close menu');
    }

    function closeNav() {
      document.documentElement.classList.remove('nav-open');
      body.classList.remove('nav-open');
      unlockScroll();
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
    }

    function isOpen() {
      return body.classList.contains('nav-open');
    }

    toggle.addEventListener('click', function () {
      if (isOpen()) {
        closeNav();
      } else {
        openNav();
      }
    });

    if (backdrop) {
      backdrop.addEventListener('click', closeNav);
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen()) {
        closeNav();
        toggle.focus();
      }
    });

    nav.querySelectorAll('.nav-link').forEach(function (link) {
      link.addEventListener('click', closeNav);
    });

    /* Si la fenêtre repasse au-dessus du seuil desktop (redimensionnement,
       rotation d'un pliable, etc.), on referme le panneau mobile : sinon
       body.nav-open resterait actif et bloquerait le scroll (overflow:
       hidden) sur une mise en page qui n'affiche plus le panneau. */
    var desktopQuery = window.matchMedia('(min-width: 1025px)');
    function handleViewportChange(event) {
      if (event.matches && isOpen()) closeNav();
    }
    if (desktopQuery.addEventListener) {
      desktopQuery.addEventListener('change', handleViewportChange);
    } else if (desktopQuery.addListener) {
      // Safari < 14
      desktopQuery.addListener(handleViewportChange);
    }
  }

  /* -------------------------------------------------------------
     2. Apparition au scroll — IntersectionObserver
     -------------------------------------------------------------
     Révèle chaque [data-animate] une seule fois, quand il entre dans
     le viewport. rootMargin négatif en bas : l'élément doit être
     visible sur une vraie portion de l'écran avant de se déclencher,
     pas juste effleurer le bord — ça évite un effet "tout apparaît
     d'un coup" au chargement sur les écrans hauts.
     ------------------------------------------------------------- */
  function initScrollReveal() {
    var targets = document.querySelectorAll('[data-animate]');
    if (!targets.length) return;

    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // motion.css affiche déjà tout immédiatement pour ces utilisateurs ;
    // pas besoin d'observer quoi que ce soit, ni d'ajouter .is-visible.
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -10% 0px',
      }
    );

    targets.forEach(function (target) {
      observer.observe(target);
    });
  }

  /* -------------------------------------------------------------
     3. Année du copyright
     -------------------------------------------------------------
     Petit détail qui évite d'avoir à revenir modifier le HTML chaque
     janvier.
     ------------------------------------------------------------- */
  function initFooterYear() {
    var yearEl = document.getElementById('footer-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }

  /* -------------------------------------------------------------
     4. En-tête élevé au scroll
     -------------------------------------------------------------
     Ajoute .is-scrolled (stylé dans /styles/shared/header.css) une
     fois qu'on a défilé au-delà du haut de page, pour que le header
     vitré gagne un peu d'opacité et une ombre douce — même
     comportement que Career/Fan Club, désormais commun aux 5 pages.
     rAF-throttled + passive : pas de coût de layout par frame de
     scroll.
     ------------------------------------------------------------- */
  function initHeaderScrollState() {
    var header = document.querySelector('.header');
    if (!header) return;

    var SCROLL_THRESHOLD = 24;
    var ticking = false;

    var updateHeaderState = function () {
      header.classList.toggle('is-scrolled', window.scrollY > SCROLL_THRESHOLD);
      ticking = false;
    };

    updateHeaderState();

    window.addEventListener(
      'scroll',
      function () {
        if (!ticking) {
          window.requestAnimationFrame(updateHeaderState);
          ticking = true;
        }
      },
      { passive: true }
    );
  }

  document.addEventListener('DOMContentLoaded', function () {
    initMobileNav();
    initScrollReveal();
    initFooterYear();
    initHeaderScrollState();
  });
})();
