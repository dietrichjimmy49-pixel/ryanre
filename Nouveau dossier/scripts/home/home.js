/* ===========================================================================
   RYAN REYNOLDS — OFFICIAL SITE
   MAIN.JS — Motion & interactions (Phase 5, modernisé/nettoyé en Phase 6)
   ---------------------------------------------------------------------------
   Quatre responsabilités, chacune isolée dans sa propre fonction pour rester
   lisible et facile à retirer/adapter indépendamment :
     1. Menu mobile (ouverture/fermeture, rideau, échap, clic extérieur)
     2. Scroll reveal (IntersectionObserver, une seule fois par élément)
     3. Compteurs animés des statistiques de la Community
     4. Synchronisation des points de pagination (Featured Works / Gallery)

   Aucune dépendance externe : tout est fait avec les API natives du
   navigateur (IntersectionObserver, matchMedia, requestAnimationFrame).
   Syntaxe ES2015+ (const/let, arrow functions, Array.from) : la cible de
   support de ce projet n'inclut pas IE11, donc pas besoin de transpiler.
   ========================================================================= */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -------------------------------------------------------------
     0. Scroll lock — freezes the background page while the mobile
     menu is open. body.nav-open { overflow: hidden } alone isn't
     reliable on mobile Safari/iOS (the page can still rubber-band
     scroll behind the fixed panel), so we also pin <body> in place
     with position: fixed and restore the exact scroll position on
     close.
     ------------------------------------------------------------- */
  let lockedScrollY = 0;

  function lockScroll() {
    lockedScrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
  }

  function unlockScroll() {
    if (document.body.style.position !== 'fixed') return; // wasn't locked, nothing to restore
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    window.scrollTo(0, lockedScrollY);
  }

  /* -------------------------------------------------------------
     1. Menu mobile
     ------------------------------------------------------------- */
  function initMobileNav() {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.getElementById('primary-nav');
    const backdrop = document.querySelector('.nav-backdrop[data-nav-close]');
    const closeTargets = document.querySelectorAll('.nav-link[data-nav-close]');

    if (!toggle || !nav) return;

    function openNav() {
      document.documentElement.classList.add('nav-open');
      document.body.classList.add('nav-open');
      lockScroll();
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close menu');
    }

    function closeNav() {
      document.documentElement.classList.remove('nav-open');
      document.body.classList.remove('nav-open');
      unlockScroll();
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
    }

    toggle.addEventListener('click', () => {
      const isOpen = document.body.classList.contains('nav-open');
      isOpen ? closeNav() : openNav();
    });

    if (backdrop) {
      backdrop.addEventListener('click', closeNav);
    }

    closeTargets.forEach((link) => link.addEventListener('click', closeNav));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('nav-open')) {
        closeNav();
        toggle.focus();
      }
    });

    // Si la fenêtre repasse en largeur desktop pendant que le menu
    // mobile est ouvert (rotation d'écran, redimensionnement), on
    // referme proprement pour ne pas laisser un état incohérent.
    const desktopQuery = window.matchMedia('(min-width: 1025px)');
    desktopQuery.addEventListener('change', (e) => {
      if (e.matches) closeNav();
    });
  }

  /* -------------------------------------------------------------
     2. Scroll reveal — chaque élément [data-reveal] apparaît une
     seule fois, dès qu'il entre dans le viewport. Avec un mouvement
     réduit préféré, on saute directement l'observer et on affiche
     tout immédiatement (pas d'animation, pas de délai d'apparition).
     ------------------------------------------------------------- */
  function initScrollReveal() {
    const elements = document.querySelectorAll('[data-reveal]');
    if (!elements.length) return;

    if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
      elements.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    elements.forEach((el) => observer.observe(el));
  }

  /* -------------------------------------------------------------
     3. Compteurs animés — .stat-number contient soit un nombre
     ("25,000+"), soit un mot ("DAILY", via .stat-number--word) qui
     ne doit jamais être animé. On ne déclenche le compte qu'une
     fois, quand le panneau de stats entre dans le viewport, pour ne
     pas relancer l'animation à chaque scroll de va-et-vient.
     ------------------------------------------------------------- */
  function initStatCounters() {
    const statsPanel = document.querySelector('.stats-panel');
    if (!statsPanel) return;

    const numbers = statsPanel.querySelectorAll('.stat-number:not(.stat-number--word)');
    if (!numbers.length) return;

    if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
      return; // les valeurs finales sont déjà dans le HTML — rien à faire
    }

    let animated = false;
    const COUNT_DURATION_MS = 1200;

    function animateCount(el) {
      const raw = el.textContent.trim();
      const match = raw.match(/[\d,.]+/);
      if (!match) return;

      const target = parseInt(match[0].replace(/[,.]/g, ''), 10);
      const suffix = raw.slice(match.index + match[0].length); // ex: "+"
      const prefix = raw.slice(0, match.index);
      let startTime = null;

      function step(timestamp) {
        if (startTime === null) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / COUNT_DURATION_MS, 1);
        // ease-out cubique : démarre vite, ralentit en douceur à l'arrivée
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(eased * target);
        el.textContent = prefix + current.toLocaleString('en-US') + suffix;

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          el.textContent = prefix + target.toLocaleString('en-US') + suffix;
        }
      }

      requestAnimationFrame(step);
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !animated) {
            animated = true;
            numbers.forEach((el) => animateCount(el));
            obs.disconnect();
          }
        });
      },
      { threshold: 0.4 }
    );

    observer.observe(statsPanel);
  }

  /* -------------------------------------------------------------
     4. Points de pagination — Gallery (.gallery-cluster-dots)
     n'est visible qu'en carrousel mobile. Un clic sur un point fait
     défiler jusqu'à la carte correspondante ; un IntersectionObserver
     sur les cartes met à jour le point actif pendant le scroll
     tactile, dans les deux sens.

     Featured Works n'utilise plus ce mécanisme : la section n'a
     plus de swipe horizontal sur mobile, les cartes s'empilent
     simplement à la verticale (voir featured-works.css).
     ------------------------------------------------------------- */
  function initDotSync(viewportSelector, cardSelector, dotsSelector, dotSelector, activeClass) {
    const viewport = document.querySelector(viewportSelector);
    const dotsNav = document.querySelector(dotsSelector);
    if (!viewport || !dotsNav) return;

    const cards = Array.from(viewport.querySelectorAll(cardSelector));
    const dots = Array.from(dotsNav.querySelectorAll(dotSelector));
    if (!cards.length || !dots.length) return;

    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        const card = cards[i];
        if (!card) return;
        card.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          inline: 'center',
          block: 'nearest'
        });
      });
    });

    if (typeof IntersectionObserver === 'undefined') return;

    const visibility = new Map();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => visibility.set(entry.target, entry.intersectionRatio));

        // La carte la plus visible dans le viewport pilote le point actif.
        let mostVisibleIndex = 0;
        let highestRatio = 0;
        cards.forEach((card, i) => {
          const ratio = visibility.get(card) || 0;
          if (ratio > highestRatio) {
            highestRatio = ratio;
            mostVisibleIndex = i;
          }
        });

        dots.forEach((dot, i) => dot.classList.toggle(activeClass, i === mostVisibleIndex));
      },
      { root: viewport, threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    cards.forEach((card) => observer.observe(card));
  }

  function initCarousels() {
    initDotSync('.gallery-mosaic', '.gallery-cluster .gallery-card', '.gallery-cluster-dots', '.dot', 'is-active');
  }

  /* -------------------------------------------------------------
     4bis. Featured Works — aperçus vidéo en arrière-plan des cartes.

     Chaque .work-card-image peut contenir une <video data-src="…">
     en plus de son poster <img>. Trois mécanismes indépendants
     coopèrent sur le même élément <video>, qui reste la seule
     source de vérité (on ne duplique jamais l'état "lecture" dans
     une variable séparée — on lit toujours video.paused) :

       a) Chargement paresseux — la vraie source (data-src) n'est
          assignée à la <video> qu'au moment où sa carte APPROCHE du
          viewport (rootMargin généreux), pas seulement quand elle
          y entre pleinement. Ainsi la vidéo a le temps de charger
          avant de devoir démarrer.

       b) Lecture pilotée par le scroll — dès qu'une carte entre
          dans le viewport (à 50 % visible), sa vidéo démarre en
          boucle ; dès qu'elle en sort, la vidéo est mise en pause
          et remise à 0 (le poster réapparaît). Ce mécanisme est
          prioritaire sur tout état manuel : une carte qu'on a mise
          en pause à la main puis qui sort/rentre du viewport
          repart automatiquement, comme les autres.

       c) Bouton play/pause manuel — seule la carte Free Guy en a
          un. Il ne fait qu'appeler video.play()/pause() ; l'icône
          (▶ / ❚❚) se synchronise elle-même sur les évènements
          natifs 'play'/'pause' de la vidéo, donc elle reste juste
          que le déclencheur soit le clic ou le scroll.
     ------------------------------------------------------------- */
  function initWorkCardVideos() {
    const videos = Array.from(document.querySelectorAll('.work-card-video'));
    if (!videos.length) return;

    // Respect du mouvement réduit : on n'installe même pas les
    // observers, les vidéos restent des posters statiques (voir
    // aussi le display:none de secours en CSS).
    if (prefersReducedMotion) return;

    function setActive(video, active) {
      const wrapper = video.closest('.work-card-image');
      if (wrapper) wrapper.classList.toggle('is-video-active', active);
    }

    videos.forEach((video) => {
      // On force muted/playsInline en propriétés JS en plus des attributs
      // HTML : certains navigateurs (ou certains outils de build qui
      // réécrivent le HTML) ne respectent l'autoplay que si la propriété
      // JS est explicitement vraie au moment de l'appel à .play().
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;

      video.addEventListener('play', () => setActive(video, true));
      video.addEventListener('pause', () => setActive(video, false));

      // Diagnostic : si le fichier n'existe pas (mauvais chemin, pas
      // encore déposé dans /assets/video/home/…), la carte reste
      // silencieusement sur son poster — mais on log une erreur claire
      // en console pour ne pas chercher un bug ailleurs pour rien.
      video.addEventListener('error', () => {
        console.error(
          `[work-card-video] Impossible de charger "${video.currentSrc || video.dataset.src}". ` +
          `Vérifie que le fichier existe bien à cet emplacement et que le format (mp4/H.264) est lisible par le navigateur.`
        );
      });
    });

    // a) Chargement paresseux : on n'assigne la vraie source que
    // lorsque la carte s'approche du viewport (marge généreuse),
    // pour ne jamais télécharger les 4 vidéos au chargement initial
    // de la page.
    if (typeof IntersectionObserver !== 'undefined') {
      const loadObserver = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const video = entry.target;
            const src = video.dataset.src;
            if (src) {
              video.src = src;
              video.load();
            }
            obs.unobserve(video);
          });
        },
        { rootMargin: '400px 0px', threshold: 0 }
      );
      videos.forEach((video) => loadObserver.observe(video));

      // b) Lecture/pause pilotée par le scroll. Seuil volontairement
      // bas (15 %) avec une marge négative légère : sur beaucoup
      // d'écrans (surtout laptop, hauteur de viewport réduite), la
      // rangée de cartes ne montre jamais 50 % d'une carte à la fois
      // sans scroller pile dessus — un seuil trop strict comme 0.5
      // fait que la vidéo ne se déclenche quasiment jamais en pratique.
      const playObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const video = entry.target;
            if (entry.isIntersecting) {
              // On révèle la vidéo immédiatement (fondu poster → vidéo)
              // au lieu d'attendre l'évènement natif 'play' : sur
              // certains navigateurs/versions, ce dernier peut être
              // retardé ou ne pas remonter comme attendu, ce qui
              // laissait le fondu bloqué à l'opacité 0 alors même que
              // la vidéo se chargeait/jouait déjà (visible dans le
              // Network en 206 Partial Content).
              setActive(video, true);
              const playAttempt = video.play();
              if (playAttempt && typeof playAttempt.catch === 'function') {
                playAttempt.catch((err) => {
                  console.warn('[work-card-video] Lecture différée (autoplay bloqué) :', err && err.message);
                  // Si la lecture est réellement refusée par le
                  // navigateur, on revient au poster plutôt que de
                  // rester sur une vidéo figée à l'image 0.
                  setActive(video, false);
                });
              }
            } else {
              setActive(video, false);
              video.pause();
              video.currentTime = 0;
            }
          });
        },
        { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
      );
      videos.forEach((video) => playObserver.observe(video));
    }

    // c) Bouton play/pause manuel (carte Free Guy uniquement).
    const toggleButton = document.querySelector('[data-video-toggle]');
    if (toggleButton) {
      const card = toggleButton.closest('.work-card');
      const video = card ? card.querySelector('.work-card-video') : null;

      if (video) {
        const icon = toggleButton.querySelector('.play-icon');

        function syncButton() {
          const isPlaying = !video.paused;
          toggleButton.setAttribute('aria-pressed', String(isPlaying));
          toggleButton.setAttribute('aria-label', isPlaying ? 'Pause trailer' : 'Play trailer');
          if (icon) icon.textContent = isPlaying ? '❚❚' : '▶';
        }

        video.addEventListener('play', syncButton);
        video.addEventListener('pause', syncButton);

        toggleButton.addEventListener('click', () => {
          if (video.paused) {
            // Si la vidéo approche à peine du viewport, sa source a
            // peut-être déjà été assignée par le loadObserver — sinon
            // (clic avant l'approche du scroll, cas rare), on force
            // le chargement immédiat pour répondre à l'intention
            // explicite de l'utilisateur.
            if (!video.src && video.dataset.src) {
              video.src = video.dataset.src;
              video.load();
            }
            setActive(video, true);
            const playAttempt = video.play();
            if (playAttempt && typeof playAttempt.catch === 'function') {
              playAttempt.catch((err) => {
                console.warn('[work-card-video] Lecture différée (autoplay bloqué) :', err && err.message);
                setActive(video, false);
              });
            }
          } else {
            video.pause();
          }
        });
      }
    }
  }

  /* -------------------------------------------------------------
     5. En-tête élevé au scroll
     ------------------------------------------------------------------
     Ajoute .is-scrolled (stylé dans /styles/shared/header.css) une
     fois qu'on a défilé au-delà du haut de page, pour que le header
     vitré gagne un peu d'opacité et une ombre douce — même
     comportement que Career/Fan Club, désormais commun aux 5 pages.
     rAF-throttled + passive : pas de coût de layout par frame de
     scroll. */
  function initHeaderScrollState() {
    const header = document.querySelector('.header');
    if (!header) return;

    let ticking = false;
    const SCROLL_THRESHOLD = 24;

    const updateHeaderState = () => {
      header.classList.toggle('is-scrolled', window.scrollY > SCROLL_THRESHOLD);
      ticking = false;
    };

    updateHeaderState();

    window.addEventListener(
      'scroll',
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(updateHeaderState);
      },
      { passive: true }
    );
  }

  /* -------------------------------------------------------------
     Boot
     ------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    initMobileNav();
    initScrollReveal();
    initStatCounters();
    initCarousels();
    initWorkCardVideos();
    initHeaderScrollState();
  });
})();