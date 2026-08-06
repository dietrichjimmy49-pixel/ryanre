/* ==========================================================================
   RYAN REYNOLDS — ABOUT PAGE
   INTERACTIONS.JS — Phase 5 : Motion & micro-interactions
   --------------------------------------------------------------------------
   Ce fichier n'ajoute aucune animation par lui-même : tout le mouvement vit
   dans le CSS (transitions, keyframes, .reveal). Son seul rôle est de poser
   les classes d'état que le CSS attend déjà :
     - .has-js sur <html>         → active le système .reveal (sinon tout
                                     le contenu reste visible sans JS, cf.
                                     tokens.css)
     - .is-visible sur .reveal    → déclenché à l'entrée dans le viewport
     - body.nav-open              → menu mobile plein écran (header.css)
     - le contenu texte des .stat__number → anime le compteur une seule
                                     fois, à l'entrée dans le viewport

   Recommandation : dupliquer la ligne `document.documentElement.classList
   .add('has-js')` en inline dans le <head>, avant le CSS, pour éviter un
   flash de contenu visible-puis-masqué le temps que ce fichier (chargé en
   defer) s'exécute. Elle est aussi présente ici pour que le fichier reste
   autonome si l'inline est oublié.
   ========================================================================== */

(() => {
  'use strict';

  document.documentElement.classList.add('has-js');

  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  /* Scroll lock — freezes the background page while the mobile menu is
     open. body.nav-open { overflow: hidden } alone isn't reliable on
     mobile Safari/iOS, so we also pin <body> with position: fixed and
     restore the exact scroll position on close. */
  let lockedScrollY = 0;

  function lockScroll() {
    lockedScrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
  }

  function unlockScroll() {
    if (document.body.style.position !== 'fixed') return;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    window.scrollTo(0, lockedScrollY);
  }

  /* ------------------------------------------------------------------
     1. Révélation au scroll — .reveal / .reveal--scale
     ------------------------------------------------------------------
     Un seul IntersectionObserver pour toute la page plutôt qu'un par
     section : moins coûteux, et le stagger (--reveal-index) est déjà
     géré en CSS via transition-delay, pas besoin de l'orchestrer ici.
     Chaque élément n'est révélé qu'une fois (unobserve après coup) :
     on ne veut pas qu'une section rejoue son entrée en remontant dans
     la page, ce qui romprait le sentiment de contrôle de l'utilisateur.
     ---------------------------------------------------------------- */
  const revealTargets = document.querySelectorAll('.reveal');

  if (revealTargets.length) {
    if (prefersReducedMotion) {
      // Le mouvement est déjà neutralisé en CSS (durées à 0.001ms), mais
      // on évite ici même le calcul de l'observer : révélation immédiate.
      revealTargets.forEach((el) => el.classList.add('is-visible'));
    } else {
      const revealObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          });
        },
        {
          // Se déclenche un peu avant que l'élément touche le bas du
          // viewport : l'animation est terminée au moment où le regard
          // l'atteint, plutôt que de la voir démarrer en retard.
          root: null,
          rootMargin: '0px 0px -10% 0px',
          threshold: 0.15,
        }
      );

      revealTargets.forEach((el) => revealObserver.observe(el));
    }
  }

  /* ------------------------------------------------------------------
     2. Compteurs de la section Stats
     ------------------------------------------------------------------
     Chaque .stat__number contient déjà, côté HTML, la valeur finale
     (ex. "42M", "15+", "★9.2") — c'est la source de vérité, pas une
     donnée dupliquée en JS. On extrait la portion numérique, on anime
     de 0 à cette valeur, et on réinjecte le texte original (préfixe/
     suffixe compris) à la dernière frame pour ne jamais désynchroniser
     l'affichage de la vraie valeur.
     ---------------------------------------------------------------- */
  const statNumbers = document.querySelectorAll('.stat__number');

  if (statNumbers.length && !prefersReducedMotion) {
    const animateCount = (el) => {
      const raw = el.textContent.trim();
      const match = raw.match(/-?\d[\d.,]*/);
      if (!match) return; // Pas de nombre exploitable (ex. "N/A") : on laisse tel quel.

      const numberStr = match[0];
      const target = parseFloat(numberStr.replace(/,/g, ''));
      if (Number.isNaN(target)) return;

      const prefix = raw.slice(0, match.index);
      const suffix = raw.slice(match.index + numberStr.length);
      const decimals = (numberStr.split('.')[1] || '').length;
      const duration = 1400; // ms — assez lent pour se lire, assez court pour ne pas lasser
      const startTime = performance.now();

      // Easing "ease-out" quartique : départ rapide, ralentit en douceur
      // vers la valeur finale — plus naturel qu'une progression linéaire
      // pour un compteur.
      const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

      const step = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutQuart(progress);
        const current = target * eased;

        el.textContent =
          prefix + current.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + suffix;

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          el.textContent = raw; // valeur finale exacte, garantie fidèle à la maquette
        }
      };

      requestAnimationFrame(step);
    };

    const statsObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          animateCount(entry.target);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.6 }
    );

    statNumbers.forEach((el) => statsObserver.observe(el));
  }

  /* ------------------------------------------------------------------
     3. Navigation mobile — header.css (.nav-toggle, body.nav-open)
     ------------------------------------------------------------------
     Le CSS gère 100% du mouvement (rideau, stagger des liens, morphing
     du hamburger en croix) via la seule classe body.nav-open. Ce bloc
     ne fait que la poser/retirer et gérer les sorties de secours
     (Échap, clic sur le rideau, clic sur un lien) qu'un utilisateur
     attend d'un menu plein écran.
     ---------------------------------------------------------------- */
  const navToggle = document.querySelector('.nav-toggle');
  const navBackdrop = document.querySelector('.nav-backdrop');
  const navLinks = document.querySelectorAll('.nav .nav-link');

  if (navToggle) {
    const closeNav = () => {
      document.documentElement.classList.remove('nav-open');
      document.body.classList.remove('nav-open');
      unlockScroll();
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.setAttribute('aria-label', 'Open menu');
    };

    const openNav = () => {
      document.documentElement.classList.add('nav-open');
      document.body.classList.add('nav-open');
      lockScroll();
      navToggle.setAttribute('aria-expanded', 'true');
      navToggle.setAttribute('aria-label', 'Close menu');
    };

    navToggle.addEventListener('click', () => {
      document.body.classList.contains('nav-open') ? closeNav() : openNav();
    });

    navBackdrop?.addEventListener('click', closeNav);

    navLinks.forEach((link) => link.addEventListener('click', closeNav));

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && document.body.classList.contains('nav-open')) {
        closeNav();
        navToggle.focus();
      }
    });

    // Le panneau mobile passe en position:fixed hors du flux normal du
    // <header> à partir de 1024px (header.css). S'il reste ouvert
    // pendant qu'on repasse au-dessus de ce seuil (rotation tablette,
    // redimensionnement fenêtre desktop), la nav horizontale réapparaît
    // dans le header tout en gardant .nav-open actif en arrière-plan —
    // le rideau et le blocage de scroll restent en mémoire pour rien.
    let wasMobileNav = window.innerWidth <= 1024;
    window.addEventListener('resize', () => {
      const isMobileNav = window.innerWidth <= 1024;
      if (wasMobileNav && !isMobileNav) closeNav();
      wasMobileNav = isMobileNav;
    });
  }

  /* ------------------------------------------------------------------
     3b. En-tête élevé au scroll
     ------------------------------------------------------------------
     Ajoute .is-scrolled (stylé dans /styles/shared/header.css) une
     fois qu'on a défilé au-delà du haut de page, pour que le header
     vitré gagne un peu d'opacité et une ombre douce — même
     comportement que les 4 autres pages du site (remplace l'ancien
     mécanisme .is-compact, propre à About, qui réduisait aussi la
     hauteur du header sur mobile : unifié pour un rendu identique
     partout). Désactivé pendant que le menu est ouvert pour ne pas
     faire bouger le point d'ancrage du panneau. rAF-throttled +
     passive : pas de coût de layout par frame de scroll. */
  const header = document.querySelector('.header');
  if (header) {
    let ticking = false;
    const SCROLL_THRESHOLD = 24;

    const applyHeaderState = () => {
      ticking = false;
      if (document.body.classList.contains('nav-open')) return;
      header.classList.toggle('is-scrolled', window.scrollY > SCROLL_THRESHOLD);
    };

    window.addEventListener(
      'scroll',
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(applyHeaderState);
      },
      { passive: true }
    );

    applyHeaderState();
  }

  /* ------------------------------------------------------------------
     4. Année du copyright — footer.css / about.html
     ------------------------------------------------------------------
     Le markup expose déjà <span id="footer-year">2026</span> comme
     valeur de repli statique (visible si JS échoue à charger) : on la
     remplace par l'année réelle plutôt que de la laisser en dur.
     ---------------------------------------------------------------- */
  const footerYear = document.getElementById('footer-year');
  if (footerYear) {
    footerYear.textContent = String(new Date().getFullYear());
  }
})();
