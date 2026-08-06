/* ===========================================================================
   MEMBERS DIRECTORY — annuaire complet + fiche profil intégrée
   ---------------------------------------------------------------------------
   Toutes les données viennent de /data/members.json : aucun membre n'est
   écrit en dur dans le HTML. La recherche, le tri et le filtre opèrent
   sur l'intégralité du roster (pas de pagination : c'est pour ça que le
   lien "View all members" a disparu, tout est déjà là).

   Cliquer sur "View Public Profile" ne charge pas une nouvelle page :
   l'URL passe à #member=<id>, un écouteur hashchange bascule la vue
   annuaire → vue profil (et inversement), en repeuplant la fiche avec
   les données du membre cliqué. Ça reste un lien standard (clic milieu,
   ouvrir dans un nouvel onglet, bouton retour du navigateur — tout
   fonctionne) tout en évitant un rechargement complet de page.
   ========================================================================= */

(function () {
  "use strict";

  const { sleep, randInt, clamp, formatNumber, fetchJSON } = Utils;

  const LOCK_ICON_SVG =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<rect x="5" y="10.5" width="14" height="9" rx="1.5" stroke="currentColor" stroke-width="1.7"/>' +
    '<path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" stroke-width="1.7"/></svg>';

  const HEART_ICON_SVG =
    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M12 20s-7-4.35-9.5-8.8C1 8.3 2.4 5 5.7 5c1.9 0 3.3 1 4.3 2.5C11 6 12.4 5 14.3 5c3.3 0 4.7 3.3 3.2 6.2C15 15.65 12 20 12 20z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

  let allMembers = [];
  let communityStats = {};
  let els = {};

  function fullName(member) {
    return member.firstName + " " + member.lastName;
  }

  /* ---------------------------------------------------------------
     Rendu — carte de l'annuaire
     --------------------------------------------------------------- */

  function buildMemberCard(member) {
    const li = document.createElement("li");
    li.className = "member-directory-list__item";

    const article = document.createElement("article");
    article.className = "member-directory-card surface-card";
    article.dataset.memberId = member.id;

    const avatarWrap = document.createElement("div");
    avatarWrap.className = "member-directory-card__avatar-wrap";
    const avatar = Avatar.createElement(fullName(member), "md", {
      colorIndex: member.colorIndex,
      online: member.online,
    });
    if (member.verified) {
      const mark = document.createElement("span");
      mark.className = "verified-mark verified-mark--corner";
      mark.setAttribute("aria-label", "Verified member");
      avatar.appendChild(mark);
    }
    avatarWrap.appendChild(avatar);
    article.appendChild(avatarWrap);

    const name = document.createElement("h3");
    name.className = "member-directory-card__name";
    name.textContent = fullName(member);
    article.appendChild(name);

    const country = document.createElement("p");
    country.className = "member-directory-card__country";
    country.textContent = member.country;
    article.appendChild(country);

    const meta = document.createElement("p");
    meta.className = "member-directory-card__meta";
    meta.textContent = "Member Since " + member.memberSince;
    article.appendChild(meta);

    const primaryBadge = member.badges.find((b) => b !== "Verified Member");
    if (primaryBadge) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = primaryBadge;
      article.appendChild(badge);
    }

    const favorite = document.createElement("p");
    favorite.className = "member-directory-card__favorite";
    favorite.innerHTML =
      '<span class="member-directory-card__favorite-icon" aria-hidden="true">' + HEART_ICON_SVG + "</span>Favorite: " + member.favoriteMovie;
    article.appendChild(favorite);

    const bio = document.createElement("p");
    bio.className = "member-directory-card__bio";
    bio.textContent = member.bio;
    article.appendChild(bio);

    const link = document.createElement("a");
    link.className = "member-directory-card__link";
    link.href = "#member=" + encodeURIComponent(member.id);
    link.textContent = "View Public Profile";
    article.appendChild(link);

    li.appendChild(article);
    return li;
  }

  /* ---------------------------------------------------------------
     Recherche / filtre / tri
     --------------------------------------------------------------- */

  function getFilteredSortedMembers() {
    const query = els.search.value.trim().toLowerCase();
    const filterValue = els.filter.value;
    const sortValue = els.sort.value;

    let list = allMembers.filter((m) => {
      if (query) {
        const haystack = (fullName(m) + " " + m.country).toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (filterValue === "top-contributor" && !m.badges.includes("Top Contributor")) return false;
      if (filterValue === "verified" && !m.verified) return false;
      if (filterValue === "online" && !m.online) return false;
      return true;
    });

    list = list.slice().sort((a, b) => {
      if (sortValue === "newest") return b.memberSince - a.memberSince;
      if (sortValue === "points") return b.stats.communityPoints - a.stats.communityPoints;
      return fullName(a).localeCompare(fullName(b));
    });

    return list;
  }

  function renderGrid() {
    const list = getFilteredSortedMembers();

    els.grid.innerHTML = "";
    list.forEach((member) => els.grid.appendChild(buildMemberCard(member)));

    els.count.textContent = list.length + (list.length === 1 ? " member" : " members");
    els.empty.hidden = list.length !== 0;
  }

  /* ---------------------------------------------------------------
     Community statistics
     --------------------------------------------------------------- */

  function renderStaticStats() {
    els.statTotal.textContent = formatNumber(communityStats.totalMembers);
    els.statNew.textContent = formatNumber(communityStats.newThisMonth);
  }

  async function onlineStatLoop(config) {
    /** Même logique de rythme jour/nuit que forum-engine.js (voir ce
     *  fichier pour le détail) : dupliquée ici volontairement, ce script
     *  n'important pas forum-engine.js. */
    function currentActivityMultiplier() {
      const rhythm = config.activityRhythm;
      if (!rhythm || !rhythm.enabled) return 1;
      const hour = new Date().getHours();
      const value = rhythm.hourlyMultiplier[hour];
      return typeof value === "number" ? value : 1;
    }

    let value = Math.round(config.startingCounters.onlineMembers * currentActivityMultiplier());
    els.statOnline.textContent = formatNumber(value);

    for (;;) {
      await sleep(randInt(config.onlineCounter.intervalMs.minMs, config.onlineCounter.intervalMs.maxMs));
      const factor = currentActivityMultiplier();
      const dynMin = Math.round(config.onlineCounter.min * factor);
      const dynMax = Math.round(config.onlineCounter.max * factor);
      const delta = randInt(config.onlineCounter.delta.min, config.onlineCounter.delta.max);
      value = clamp(value + delta, dynMin, dynMax);
      els.statOnline.textContent = formatNumber(value);
      els.statOnline.classList.remove("is-pulsing");
      void els.statOnline.offsetWidth;
      els.statOnline.classList.add("is-pulsing");
    }
  }

  /* ---------------------------------------------------------------
     Vue profil — peuplée depuis members.json, aucune navigation réelle
     --------------------------------------------------------------- */

  function renderProfileDetail(member) {
    document.title = fullName(member) + " - Ryan Reynolds Fan Club";

    const avatar = Avatar.createElement(fullName(member), "lg", {
      colorIndex: member.colorIndex,
      online: member.online,
    });
    avatar.classList.add("profile-header__avatar");

    const badgesHtml = member.badges
      .map((b) => {
        const icon = b === "Verified Member" ? "✓" : "★";
        return '<li class="badge"><span class="icon" aria-hidden="true">' + icon + "</span>" + b + "</li>";
      })
      .join("");

    els.profileContent.innerHTML = `
      <article class="profile-header surface-card">
        <div class="profile-header__body">
          <div class="profile-header__identity" id="profile-avatar-slot"></div>
          <div class="profile-header__info">
            <h1 class="profile-header__name">
              ${fullName(member)}
              ${member.verified ? '<span class="verified-mark verified-mark--inline" role="img" aria-label="Verified member"></span>' : ""}
            </h1>
            <p class="profile-header__meta">
              <span class="profile-header__meta-item">${member.country}</span>
              <span aria-hidden="true">•</span>
              <span class="profile-header__meta-item">Member Since ${member.memberSince}</span>
            </p>
            <ul class="profile-header__badges">${badgesHtml}</ul>
            <p class="profile-header__bio">${member.bio}</p>
          </div>
          <div class="profile-header__actions">
            <button class="button button--secondary button--locked" type="button" disabled>
              <span class="button__icon" aria-hidden="true">${LOCK_ICON_SVG}</span>
              Send Message
            </button>
            <button class="button button--secondary button--locked" type="button" disabled>
              <span class="button__icon" aria-hidden="true">${LOCK_ICON_SVG}</span>
              Follow Activity
            </button>
            <p class="access-notice">
              <span class="access-notice__icon" aria-hidden="true">${LOCK_ICON_SVG}</span>
              <span class="access-notice__label">Interactions reserved for Active Members</span>
            </p>
          </div>
        </div>
      </article>
    `;

    document.getElementById("profile-avatar-slot").appendChild(avatar);
  }

  /* ---------------------------------------------------------------
     Routage par ancre — #member=<id> affiche la fiche, sinon la grille
     --------------------------------------------------------------- */

  function closeProfile() {
    if (location.hash.startsWith("#member=")) location.hash = "";
  }

  function renderFromHash() {
    const match = location.hash.match(/^#member=(.+)$/);
    const member = match ? allMembers.find((m) => m.id === decodeURIComponent(match[1])) : null;

    if (member) {
      renderProfileDetail(member);
      els.detailView.hidden = false;
      els.detailView.scrollTop = 0;
      document.body.classList.add("modal-open");
    } else {
      els.detailView.hidden = true;
      document.body.classList.remove("modal-open");
      document.title = "Membres | Ryan Reynolds Fan Club";
      if (match && !member) location.hash = "";
    }
  }

  /* ---------------------------------------------------------------
     Démarrage
     --------------------------------------------------------------- */

  async function init() {
    els.mainScroll = document.querySelector(".app-main");
    els.directoryView = document.getElementById("directory-view");
    els.detailView = document.getElementById("member-detail-view");
    if (!els.directoryView) return; // cette page n'a pas d'annuaire

    els.grid = document.getElementById("member-directory-list");
    els.count = document.getElementById("members-directory-count");
    els.empty = document.getElementById("member-directory-empty");
    els.search = document.getElementById("member-search");
    els.filter = document.getElementById("member-filter");
    els.sort = document.getElementById("member-sort");
    els.statTotal = document.getElementById("stat-total-members");
    els.statOnline = document.getElementById("stat-online-members");
    els.statNew = document.getElementById("stat-new-members");
    els.profileContent = document.getElementById("profile-page-content");

    // Popup : croix, clic sur le fond assombri, ou touche Échap referment.
    const closeBtn = document.getElementById("member-detail-close");
    if (closeBtn) closeBtn.addEventListener("click", closeProfile);
    els.detailView.addEventListener("click", (e) => {
      if (e.target === els.detailView) closeProfile();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !els.detailView.hidden) closeProfile();
    });

    try {
      const [membersData, config] = await Promise.all([
        fetchJSON("data/members.json"),
        fetchJSON("data/forum-config.json"),
      ]);

      allMembers = membersData.members;
      communityStats = Object.assign(
        { totalMembers: allMembers.length },
        membersData.communityStats
      );

      renderStaticStats();
      renderGrid();
      renderFromHash();
      onlineStatLoop(config);

      els.search.addEventListener("input", renderGrid);
      els.filter.addEventListener("change", renderGrid);
      els.sort.addEventListener("change", renderGrid);
      window.addEventListener("hashchange", renderFromHash);
    } catch (err) {
      console.error("[members-directory] Failed to load the directory:", err);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
