/* ===========================================================================
   ADMIN APP — logique de Dashboard et Members
   ---------------------------------------------------------------------------
   Un seul fichier, chargé sur les deux pages : il détecte sur laquelle il
   tourne (présence de #applications-view ou #members-list-view) et
   n'exécute que ce qui correspond.

   Toutes les données passent maintenant par SupabaseDB (../../assets/js/
   supabase-client.js, partagé avec le site public) : une candidature
   soumise depuis community/apply.html apparaît donc ici directement, et
   une approbation faite ici débloque directement community/login.html.
   ========================================================================= */

(function () {
  "use strict";

  const { formatDateLong, formatDateTime, relativeTime, fullName } = AdminUtils;

  /* ---------------------------------------------------------------
     Badge "candidatures en attente" — partagé par les deux pages
     --------------------------------------------------------------- */
  async function refreshPendingBadge() {
    const badge = document.getElementById("sidebar-pending-badge");
    if (!badge) return;
    try {
      const applications = await SupabaseDB.getApplications();
      const pending = applications.filter((a) => a.status === "pending");
      badge.textContent = pending.length;
      badge.hidden = pending.length === 0;
    } catch (err) {
      console.error("[admin-app] Failed to update the badge:", err);
    }
  }

  /* ===================================================================
     DASHBOARD — liste des candidatures + fiche détail en pop-up
     =================================================================== */

  function initDashboard() {
    const applicationsView = document.getElementById("applications-view");
    if (!applicationsView) return;

    const els = {
      applicationsView,
      detailView: document.getElementById("application-detail-view"),
      list: document.getElementById("application-list"),
      empty: document.getElementById("application-list-empty"),
      statPending: document.getElementById("stat-pending-value"),
      statMembers: document.getElementById("stat-total-members-value"),
      panelBadge: document.getElementById("panel-pending-badge"),
      detailContent: document.getElementById("application-detail-content"),
      mainScroll: document.querySelector(".main"),
    };

    let applications = [];
    let membersCount = 0;

    function pendingApplications() {
      return applications.filter((a) => a.status === "pending");
    }

    function renderStats() {
      const pending = pendingApplications().length;
      els.statPending.textContent = pending;
      els.statMembers.textContent = membersCount;
      els.panelBadge.textContent = pending + " awaiting review";
    }

    function buildApplicationItem(app) {
      const li = document.createElement("li");
      li.className = "application-item";
      li.dataset.applicationId = app.id;

      li.innerHTML = `
        <span class="avatar avatar--md" aria-hidden="true">${app.initials}</span>
        <div class="application-item__identity">
          <p class="application-item__name">${fullName(app)}</p>
          <p class="application-item__email">${app.email}</p>
        </div>
        <div class="application-item__meta">
          <span class="application-item__country">${app.country}</span>
          <span aria-hidden="true">&middot;</span>
          <span class="application-item__submitted">Submitted ${relativeTime(app.submittedAt)}</span>
        </div>
        <div class="application-item__actions">
          <button class="btn--approve" type="button" data-action="approve">Approve</button>
          <button class="btn--reject" type="button" data-action="reject">Reject</button>
        </div>
        <a href="#application=${encodeURIComponent(app.id)}" class="application-item__details">Details &rarr;</a>
      `;

      li.querySelector('[data-action="approve"]').addEventListener("click", () => decide(app.id, "approved"));
      li.querySelector('[data-action="reject"]').addEventListener("click", () => decide(app.id, "rejected"));

      return li;
    }

    async function refreshFromDB() {
      applications = await SupabaseDB.getApplications();
      const members = await SupabaseDB.getMembers();
      membersCount = members.length;
    }

    function renderList() {
      const list = pendingApplications();
      els.list.innerHTML = "";
      list.forEach((app) => els.list.appendChild(buildApplicationItem(app)));
      els.empty.hidden = list.length !== 0;
      renderStats();
    }

    /* Petite notification discrète après une décision — confirme ce qui
       vient de se passer sans bloquer l'écran avec une alert(). */
    function showToast(message) {
      let toast = document.getElementById("admin-toast");
      if (!toast) {
        toast = document.createElement("p");
        toast.id = "admin-toast";
        toast.className = "admin-toast";
        document.body.appendChild(toast);
      }
      toast.textContent = message;
      toast.classList.remove("admin-toast--visible");
      void toast.offsetWidth;
      toast.classList.add("admin-toast--visible");
      clearTimeout(showToast._t);
      showToast._t = setTimeout(() => toast.classList.remove("admin-toast--visible"), 3200);
    }

    async function decide(id, status) {
      const wasOpenInDetail = location.hash === "#application=" + encodeURIComponent(id);

      if (status === "approved") {
        const member = await SupabaseDB.approveApplication(id);
        if (member) showToast(`✓ Approved: ${member.email} can now sign in.`);
      } else {
        await SupabaseDB.rejectApplication(id);
        showToast("Application rejected.");
      }

      await refreshFromDB();
      renderList();
      refreshPendingBadge();

      if (wasOpenInDetail) location.hash = "";
    }

    function buildDetail(app) {
      els.detailContent.innerHTML = `
        <section class="panel applicant-card" aria-labelledby="applicant-info-title">
          <header class="panel__header">
            <h2 id="applicant-info-title" class="panel__title">Applicant Information</h2>
          </header>

          <div class="applicant-card__profile">
            <div class="avatar avatar--lg" aria-hidden="true">${app.initials}</div>

            <div class="applicant-card__identity">
              <h3 class="applicant-card__name">${fullName(app)}</h3>
              <p class="applicant-card__email"><a href="mailto:${app.email}">${app.email}</a></p>

              <p class="applicant-card__meta">
                <span>${app.country}</span>
                <span class="applicant-card__separator" aria-hidden="true">&middot;</span>
                <span>Submitted ${formatDateLong(app.submittedAt)}</span>
              </p>

              <span class="badge--status badge--pending">Pending Review</span>
            </div>

            <div class="applicant-card__actions">
              <button class="btn--approve" type="button" id="detail-approve-btn">Approve</button>
              <button class="btn--reject" type="button" id="detail-reject-btn">Reject</button>
            </div>
          </div>

          <dl class="info-list">
            <div class="info-list__row"><dt class="info-list__term">Full Name</dt><dd class="info-list__value">${fullName(app)}</dd></div>
            <div class="info-list__row"><dt class="info-list__term">Phone Number</dt><dd class="info-list__value">${app.phone || "Not provided"}</dd></div>
            <div class="info-list__row"><dt class="info-list__term">Address</dt><dd class="info-list__value">${app.address}</dd></div>
            <div class="info-list__row"><dt class="info-list__term">City</dt><dd class="info-list__value">${app.city}</dd></div>
            <div class="info-list__row"><dt class="info-list__term">State / Province</dt><dd class="info-list__value">${app.state || "Not provided"}</dd></div>
            <div class="info-list__row"><dt class="info-list__term">Zip Code</dt><dd class="info-list__value">${app.zip}</dd></div>
            <div class="info-list__row"><dt class="info-list__term">Country</dt><dd class="info-list__value">${app.country}</dd></div>
            <div class="info-list__row"><dt class="info-list__term">Favorite Movie</dt><dd class="info-list__value">${app.favoriteMovie}</dd></div>
            <div class="info-list__row"><dt class="info-list__term">Submitted</dt><dd class="info-list__value">${formatDateTime(app.submittedAt)}</dd></div>
            <div class="info-list__row"><dt class="info-list__term">Application ID</dt><dd class="info-list__value">#APP-${app.id.toUpperCase()}</dd></div>
          </dl>

          <div class="applicant-card__motivation">
            <h3 class="applicant-card__subtitle">Why do you want to join?</h3>
            <blockquote class="quote-block"><p>${app.motivation}</p></blockquote>
          </div>
        </section>
      `;

      document.getElementById("detail-approve-btn").addEventListener("click", () => decide(app.id, "approved"));
      document.getElementById("detail-reject-btn").addEventListener("click", () => decide(app.id, "rejected"));
    }

    function closeDetail() {
      if (location.hash.startsWith("#application=")) location.hash = "";
    }

    function renderFromHash() {
      const match = location.hash.match(/^#application=(.+)$/);
      const app = match ? applications.find((a) => a.id === decodeURIComponent(match[1])) : null;

      if (app && app.status === "pending") {
        buildDetail(app);
        els.detailView.hidden = false;
        els.detailView.scrollTop = 0;
        document.body.classList.add("modal-open");
      } else {
        els.detailView.hidden = true;
        document.body.classList.remove("modal-open");
        if (match && (!app || app.status !== "pending")) location.hash = "";
      }
    }

    // Pop-up : croix, clic sur le fond assombri, ou touche Échap referment.
    const closeBtn = document.getElementById("application-detail-close");
    if (closeBtn) closeBtn.addEventListener("click", closeDetail);
    els.detailView.addEventListener("click", (e) => {
      if (e.target === els.detailView) closeDetail();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !els.detailView.hidden) closeDetail();
    });

    refreshFromDB()
      .then(() => {
        renderList();
        renderFromHash();
        window.addEventListener("hashchange", renderFromHash);
      })
      .catch((err) => console.error("[admin-app] Dashboard : chargement impossible", err));
  }

  /* ===================================================================
     MEMBERS — tableau + fiche détail qui remplace entièrement la liste
     =================================================================== */

  function initMembers() {
    const listView = document.getElementById("members-list-view");
    if (!listView) return;

    const els = {
      listView,
      detailView: document.getElementById("member-detail-view"),
      detailContent: document.getElementById("member-detail-content"),
      statTotal: document.getElementById("stat-total-members-value"),
      search: document.getElementById("member-search"),
      countryFilter: document.getElementById("country-filter"),
      sortSelect: document.getElementById("sort-order"),
      tbody: document.getElementById("members-table-body"),
      empty: document.getElementById("members-table-empty"),
      mainScroll: document.querySelector(".main"),
    };

    let members = [];

    function populateCountryFilter() {
      const countries = Array.from(new Set(members.map((m) => m.country))).sort();
      countries.forEach((country) => {
        const opt = document.createElement("option");
        opt.value = country;
        opt.textContent = country;
        els.countryFilter.appendChild(opt);
      });
    }

    function getFilteredSorted() {
      const query = els.search.value.trim().toLowerCase();
      const country = els.countryFilter.value;
      const sort = els.sortSelect.value;

      let list = members.filter((m) => {
        if (country !== "all" && m.country !== country) return false;
        if (query) {
          const haystack = (fullName(m) + " " + m.email).toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      });

      list = list.slice().sort((a, b) => {
        if (sort === "name-asc") return fullName(a).localeCompare(fullName(b));
        if (sort === "name-desc") return fullName(b).localeCompare(fullName(a));
        if (sort === "oldest") return new Date(a.memberSince) - new Date(b.memberSince);
        return new Date(b.memberSince) - new Date(a.memberSince); // recent
      });

      return list;
    }

    function buildRow(member, index) {
      const tr = document.createElement("tr");
      tr.className = "member-row row-hover";
      tr.dataset.memberId = member.id;
      tr.tabIndex = 0;

      tr.innerHTML = `
        <td class="member-row__index">${index + 1}</td>
        <td class="member-row__member" data-label="Member">
          <div class="member-identity">
            <span class="avatar avatar--md" aria-hidden="true">${member.initials}</span>
            <div>
              <p class="member-identity__name">${fullName(member)}</p>
              <p class="member-identity__email">${member.email}</p>
            </div>
          </div>
        </td>
        <td class="data-table__country" data-label="Country">${member.country}</td>
        <td data-label="Status">
          <span class="badge--status ${member.accessRevoked ? "badge--revoked" : "badge--active"}">
            ${member.accessRevoked ? "Access Revoked" : "Active"}
          </span>
        </td>
      `;

      const open = () => { location.hash = "#member=" + encodeURIComponent(member.id); };
      tr.addEventListener("click", open);
      tr.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });

      return tr;
    }

    function renderTable() {
      const list = getFilteredSorted();
      els.tbody.innerHTML = "";
      list.forEach((m, i) => els.tbody.appendChild(buildRow(m, i)));
      els.empty.hidden = list.length !== 0;
      els.statTotal.textContent = members.length;
    }

    function renderDetail(member) {
      document.title = fullName(member) + " - Members - Ryan Reynolds Fan Club Admin";

      const isSelf = currentUserId && member.id === currentUserId;
      const revokeDisabled = member.accessRevoked || isSelf;
      let revokeLabel = "Revoke Member Access";
      if (member.accessRevoked) revokeLabel = "Access Already Revoked";
      else if (isSelf) revokeLabel = "You Can't Revoke Your Own Access";

      els.detailContent.innerHTML = `
        <section class="panel applicant-card" aria-labelledby="member-detail-name">
          <header class="panel__header">
            <h2 class="panel__title">Member Information</h2>
          </header>

          <div class="applicant-card__profile">
            <div class="avatar avatar--lg" aria-hidden="true">${member.initials}</div>

            <div class="applicant-card__identity">
              <h3 class="applicant-card__name" id="member-detail-name">${fullName(member)}</h3>
              <p class="applicant-card__email"><a href="mailto:${member.email}">${member.email}</a></p>

              <p class="applicant-card__meta">
                <span>${member.country}</span>
                <span class="applicant-card__separator" aria-hidden="true">&middot;</span>
                <span>Member since ${formatDateLong(member.memberSince)}</span>
              </p>

              <span class="badge--status ${member.accessRevoked ? "badge--revoked" : "badge--active"}">
                ${member.accessRevoked ? "Access Revoked" : "Active"}
              </span>
            </div>

            <div class="applicant-card__actions">
              <button type="button" class="btn--danger" id="revoke-btn" ${revokeDisabled ? "disabled" : ""} ${isSelf ? 'title="You cannot revoke your own admin access — ask another admin, or do it directly in Supabase if needed."' : ""}>
                ${revokeLabel}
              </button>
            </div>
          </div>

          <dl class="info-list">
            <div class="info-list__row"><dt class="info-list__term">Application ID</dt><dd class="info-list__value">${member.applicationId}</dd></div>
            <div class="info-list__row"><dt class="info-list__term">Phone Number</dt><dd class="info-list__value">${member.phone || "Not provided"}</dd></div>
            <div class="info-list__row"><dt class="info-list__term">Address</dt><dd class="info-list__value">${member.address || "Not provided"}</dd></div>
            <div class="info-list__row"><dt class="info-list__term">City</dt><dd class="info-list__value">${member.city || "Not provided"}</dd></div>
            <div class="info-list__row"><dt class="info-list__term">State / Province</dt><dd class="info-list__value">${member.state || "Not provided"}</dd></div>
            <div class="info-list__row"><dt class="info-list__term">Zip Code</dt><dd class="info-list__value">${member.zip || "Not provided"}</dd></div>
            <div class="info-list__row"><dt class="info-list__term">Country</dt><dd class="info-list__value">${member.country}</dd></div>
            <div class="info-list__row"><dt class="info-list__term">Favorite Movie</dt><dd class="info-list__value">${member.favoriteMovie}</dd></div>
            <div class="info-list__row"><dt class="info-list__term">Membership Card</dt><dd class="info-list__value">${member.membershipCardActive ? "Activated" : "Not activated"}</dd></div>
            <div class="info-list__row"><dt class="info-list__term">Last Login</dt><dd class="info-list__value">${member.lastLogin ? formatDateLong(member.lastLogin) : "Never logged in yet"}</dd></div>
          </dl>

          <div class="applicant-card__motivation">
            <h3 class="applicant-card__subtitle">Why did they want to join?</h3>
            <blockquote class="quote-block"><p>${member.motivation || "Not provided."}</p></blockquote>
          </div>

          <div class="applicant-card__motivation">
            <h3 class="applicant-card__subtitle">Access Control</h3>
            <p class="access-control__description">
              Revoking access will immediately deactivate this member's account. The next time they try to log in
              (correct credentials or not), they'll see: "Access denied. Your account has been suspended for violating
              community guidelines."
            </p>
            <p class="access-control__note">This action can be reversed by re-approving a new application.</p>
          </div>
        </section>
      `;

      const revokeBtn = document.getElementById("revoke-btn");
      revokeBtn.addEventListener("click", async () => {
        await SupabaseDB.setMemberRevoked(member.id, true);
        members = members.map((m) => (m.id === member.id ? Object.assign({}, m, { accessRevoked: true }) : m));
        renderTable();
        renderDetail(members.find((m) => m.id === member.id));
      });
    }

    function closeDetail() {
      if (location.hash.startsWith("#member=")) location.hash = "";
    }

    function renderFromHash() {
      const match = location.hash.match(/^#member=(.+)$/);
      const member = match ? members.find((m) => m.id === decodeURIComponent(match[1])) : null;

      if (member) {
        renderDetail(member);
        els.detailView.hidden = false;
        els.detailView.scrollTop = 0;
        document.body.classList.add("modal-open");
      } else {
        els.detailView.hidden = true;
        document.body.classList.remove("modal-open");
        document.title = "Members - Ryan Reynolds Fan Club Admin";
        if (match && !member) location.hash = "";
      }
    }

    // Pop-up : croix, clic sur le fond assombri, ou touche Échap referment.
    const closeBtn = document.getElementById("member-detail-close");
    if (closeBtn) closeBtn.addEventListener("click", closeDetail);
    els.detailView.addEventListener("click", (e) => {
      if (e.target === els.detailView) closeDetail();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !els.detailView.hidden) closeDetail();
    });

    els.search.addEventListener("input", renderTable);
    els.countryFilter.addEventListener("change", renderTable);
    els.sortSelect.addEventListener("change", renderTable);
    window.addEventListener("hashchange", renderFromHash);

    let currentUserId = null;

    SupabaseDB.getCurrentProfile()
      .then((current) => {
        if (current.session) currentUserId = current.session.user.id;
      })
      .catch((err) => console.error("[admin-app] Impossible de récupérer l'identité de l'admin connecté", err));

    SupabaseDB.getMembers()
      .then((data) => {
        members = data;
        populateCountryFilter();
        renderTable();
        renderFromHash();
      })
      .catch((err) => console.error("[admin-app] Members : chargement impossible", err));
  }

  /* ===================================================================
     TIROIR MOBILE — sidebar, présent sur les deux pages
     =================================================================== */

  function initSidebarDrawer() {
    const toggle = document.getElementById("sidebar-toggle");
    const closeBtn = document.getElementById("sidebar-close");
    const overlay = document.getElementById("sidebar-overlay");
    if (!toggle) return;

    let lockedScrollY = 0;

    function lockScroll() {
      lockedScrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${lockedScrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
    }

    function unlockScroll() {
      if (document.body.style.position !== "fixed") return;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      window.scrollTo(0, lockedScrollY);
    }

    function open() {
      document.documentElement.classList.add("sidebar-open");
      document.body.classList.add("sidebar-open");
      lockScroll();
      toggle.setAttribute("aria-expanded", "true");
      if (overlay) overlay.hidden = false;
    }

    function close() {
      document.documentElement.classList.remove("sidebar-open");
      document.body.classList.remove("sidebar-open");
      unlockScroll();
      toggle.setAttribute("aria-expanded", "false");
      if (overlay) overlay.hidden = true;
    }

    toggle.addEventListener("click", () => {
      document.body.classList.contains("sidebar-open") ? close() : open();
    });

    if (closeBtn) closeBtn.addEventListener("click", close);
    if (overlay) overlay.addEventListener("click", close);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 1023) close();
    });

    const EDGE_ZONE_PX = 24;
    const SWIPE_THRESHOLD_PX = 60;
    let touchStartX = null;
    let touchStartY = null;
    let openedFromEdge = false;

    function onTouchStart(e) {
      if (window.innerWidth > 1023) return;
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      openedFromEdge = !document.body.classList.contains("sidebar-open") && touchStartX <= EDGE_ZONE_PX;
    }

    function onTouchMove(e) {
      if (touchStartX === null) return;
      const t = e.touches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      if (Math.abs(dy) > Math.abs(dx)) return;

      if (openedFromEdge && dx > SWIPE_THRESHOLD_PX) {
        open();
        touchStartX = null;
      } else if (document.body.classList.contains("sidebar-open") && dx < -SWIPE_THRESHOLD_PX) {
        close();
        touchStartX = null;
      }
    }

    function onTouchEnd() {
      touchStartX = null;
      touchStartY = null;
      openedFromEdge = false;
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
  }

  /* ===================================================================
     LOGOUT — présent sur les deux pages (topbar + pied du sidebar)
     =================================================================== */

  function initLogout() {
    document.querySelectorAll(".js-logout").forEach((el) => {
      el.addEventListener("click", async (e) => {
        e.preventDefault();
        await SupabaseDB.clearSession();
        window.location.href = "../community/login.html";
      });
    });
  }

  async function displayAccountEmail() {
    const label = document.getElementById("topbar-account-label");
    if (!label) return;
    const current = await SupabaseDB.getCurrentProfile();
    if (current.profile && current.profile.email) label.textContent = current.profile.email;
  }

  document.addEventListener("DOMContentLoaded", function () {
    refreshPendingBadge();
    initSidebarDrawer();
    initLogout();
    displayAccountEmail();
    initDashboard();
    initMembers();
  });
})();
