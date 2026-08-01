/**
 * motion.js — Phase 5 : Motion Design & Micro-interactions
 *
 * Deux responsabilités seulement, toutes deux impossibles en CSS pur :
 *   1. Détecter l'entrée des sections dans le viewport (IntersectionObserver)
 *      et poser une classe d'état — tout le timing visuel reste en CSS
 *      (voir motion.css : .js-reveal / .js-reveal-group).
 *   2. Détecter le scroll de la page pour condenser l'en-tête.
 *
 * Aucune bibliothèque externe : les deux besoins (reveal au scroll,
 * classe d'état sur scroll) sont nativement couverts par
 * IntersectionObserver et un écouteur de scroll passif+rAF, donc GSAP /
 * Motion One n'apporteraient aucun bénéfice ici pour une seule page.
 */

(function () {
  'use strict';

  // Étape 1 — activer les états "cachés" définis en CSS sous .js.
  // Placé ici (et non en <head>) pour rester un unique fichier motion.js,
  // mais fonctionnellement équivalent à un ajout précoce : le CSS masque
  // uniquement .js-reveal une fois que ce script tourne, donc si le script
  // ne charge pas, tout le contenu reste visible par défaut (no-JS safe).
  document.documentElement.classList.add('js');

  var prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  /* ------------------------------------------------------------------ *
   * 1. Reveal au scroll
   * ------------------------------------------------------------------ */

  var revealTargets = document.querySelectorAll('.js-reveal, .js-reveal-group');

  if (!revealTargets.length) {
    return;
  }

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    // Pas d'observation nécessaire : tout est déjà visible (règle CSS
    // prefers-reduced-motion, ou navigateur sans support — on affiche
    // directement plutôt que de risquer un contenu invisible).
    revealTargets.forEach(function (el) {
      el.classList.add('is-visible', 'reveal-done');
    });
  } else {
    var revealObserver = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;

          var el = entry.target;
          el.classList.add('is-visible');

          // Nettoyage de will-change une fois la transition terminée,
          // et arrêt de l'observation (animation "one-shot").
          window.setTimeout(function () {
            el.classList.add('reveal-done');
          }, 700);

          observer.unobserve(el);
        });
      },
      {
        root: null,
        rootMargin: '0px 0px -8% 0px',
        threshold: 0.15,
      }
    );

    revealTargets.forEach(function (el) {
      revealObserver.observe(el);
    });
  }

  /* ------------------------------------------------------------------ *
   * 2. Navigation mobile — ouverture / fermeture du panneau plein écran
   *
   * header.css et motion.css définissent déjà tout l'état visuel
   * (body.nav-open .nav / .nav-backdrop / .nav-toggle-bar), mais rien
   * ne posait jamais cette classe : le bouton burger n'existait même
   * pas dans le DOM. Cette section est le seul morceau manquant —
   * un simple toggle d'état, plus les sorties de secours attendues
   * d'un panneau plein écran (Échap, clic sur le rideau, clic sur un
   * lien, redimensionnement vers desktop).
   * ------------------------------------------------------------------ */

  var navToggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('primary-nav');
  var navBackdrop = document.querySelector('.nav-backdrop');

  if (navToggle && nav) {
    var DESKTOP_QUERY = window.matchMedia('(min-width: 1025px)');
    var lockedScrollY = 0;

    var lockScroll = function () {
      lockedScrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = '-' + lockedScrollY + 'px';
      document.body.style.left = '0';
      document.body.style.right = '0';
    };

    var unlockScroll = function () {
      if (document.body.style.position !== 'fixed') return;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      window.scrollTo(0, lockedScrollY);
    };

    var closeNav = function () {
      document.documentElement.classList.remove('nav-open');
      document.body.classList.remove('nav-open');
      unlockScroll();
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.setAttribute('aria-label', 'Open menu');
    };

    var openNav = function () {
      document.documentElement.classList.add('nav-open');
      document.body.classList.add('nav-open');
      lockScroll();
      navToggle.setAttribute('aria-expanded', 'true');
      navToggle.setAttribute('aria-label', 'Close menu');
    };

    var toggleNav = function () {
      if (document.body.classList.contains('nav-open')) {
        closeNav();
      } else {
        openNav();
      }
    };

    navToggle.addEventListener('click', toggleNav);

    if (navBackdrop) {
      navBackdrop.addEventListener('click', closeNav);
    }

    // Referme au clic sur un lien du panneau (mais pas sur le CTA,
    // qui pointe aussi vers une ancre et doit se comporter pareil).
    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) {
        closeNav();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && document.body.classList.contains('nav-open')) {
        closeNav();
        navToggle.focus();
      }
    });

    // Si la fenêtre repasse en largeur desktop pendant que le panneau
    // mobile est ouvert (rotation, redimensionnement), on referme pour
    // éviter un panneau plein écran fantôme au-dessus du header desktop.
    DESKTOP_QUERY.addEventListener('change', function (event) {
      if (event.matches) {
        closeNav();
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * 3. En-tête condensé au scroll
   * ------------------------------------------------------------------ */

  var header = document.querySelector('.header');

  if (header) {
    var SCROLL_THRESHOLD = 24;
    var ticking = false;

    var updateHeaderState = function () {
      header.classList.toggle('is-scrolled', window.scrollY > SCROLL_THRESHOLD);
      ticking = false;
    };

    // État initial (ex : navigation avec ancre, page rechargée en cours de scroll).
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
})();
