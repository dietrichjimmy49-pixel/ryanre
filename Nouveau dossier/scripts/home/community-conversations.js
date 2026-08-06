/* ===========================================================================
   RYAN REYNOLDS — OFFICIAL SITE
   COMMUNITY-CONVERSATIONS.JS — Rotation aléatoire du panneau
   "COMMUNITY CONVERSATIONS" sur la page d'accueil.
   ---------------------------------------------------------------------------
   Charge le pool de conversations depuis
   /scripts/home/data/community-conversations.json, puis toutes les
   `intervalMs` millisecondes, remplace les `visibleCount` cartes affichées
   par un nouveau tirage aléatoire (sans reprendre les cartes actuellement
   visibles), avec un fondu géré via la classe CSS
   .conversations-list--updating (voir styles/home/sections/home-community.css).
   ========================================================================= */

(function () {
  'use strict';

  const DATA_URL = '/scripts/home/data/community-conversations.json';
  const FADE_MS = 320; // doit matcher la transition CSS de .conversations-list

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ICONS = {
    fire: '<path d="M12 2c0 6-6 8-6 14a6 6 0 0 0 12 0c0-6-3-8-3-12-1 2-3 3-3 5 0-4-2-5-2-7z"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    bolt: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.6z"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'
  };

  function avatarSrc(n) {
    return `/assets/images/shared/avatar/avatar-${n}.png`;
  }

  function conversationMarkup(item) {
    const iconSvg = ICONS[item.icon] || ICONS.chat;
    const participants = (item.participants || [])
      .map((n) => `<img src="${avatarSrc(n)}" alt="" width="24" height="24" loading="lazy" decoding="async">`)
      .join('');

    return `
      <li class="conversation-item">
        <span class="conversation-fire">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8">${iconSvg}</svg>
        </span>
        <div class="conversation-avatar"><img src="${avatarSrc(item.avatar)}" alt="" width="34" height="34" loading="lazy" decoding="async"></div>
        <div class="conversation-body">
          <p class="conversation-title">${item.title}</p>
          <p class="conversation-sub">${item.sub}</p>
        </div>
        <div class="conversation-participants">${participants}</div>
        <div class="conversation-stats">
          <span class="conversation-replies"><strong>${item.replies}</strong> REPLIES</span>
          <span class="conversation-time">${item.time}</span>
        </div>
      </li>`;
  }

  // Tire `count` éléments au hasard dans `pool`, en excluant si possible les
  // ids listés dans `excludeIds` (pour éviter de réafficher le set courant).
  function pickRandom(pool, count, excludeIds) {
    const candidates = pool.filter((item) => !excludeIds.has(item.id));
    const source = candidates.length >= count ? candidates : pool.slice();
    const shuffled = source.slice().sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  function initCommunityConversations() {
    const list = document.querySelector('.conversations-list');
    if (!list) return;

    fetch(DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const pool = Array.isArray(data.conversations) ? data.conversations : [];
        const intervalMs = Number(data.intervalMs) || 9000;
        const visibleCount = Number(data.visibleCount) || 3;

        if (!pool.length) return;

        // On ne connaît pas les ids déjà présents dans le HTML statique au
        // chargement, donc on part d'un set vide pour le tout premier tirage.
        let currentIds = new Set();

        function rotate() {
          const nextSet = pickRandom(pool, visibleCount, currentIds);
          currentIds = new Set(nextSet.map((item) => item.id));

          const render = () => {
            list.innerHTML = nextSet.map(conversationMarkup).join('');
            list.classList.remove('conversations-list--updating');
          };

          if (prefersReducedMotion) {
            render();
            return;
          }

          list.classList.add('conversations-list--updating');
          window.setTimeout(render, FADE_MS);
        }

        window.setInterval(rotate, intervalMs);
      })
      .catch((err) => {
        // Si le fichier de données est indisponible, on garde le contenu
        // statique déjà présent dans le HTML plutôt que de casser la page.
        console.warn('Community conversations: rotation disabled —', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCommunityConversations);
  } else {
    initCommunityConversations();
  }
})();
