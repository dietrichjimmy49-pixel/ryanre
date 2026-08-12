/* ===========================================================================
   FORUM ENGINE — simulation d'un forum vivant
   ---------------------------------------------------------------------------
   Aucun réglage de vitesse, de délai ou de probabilité n'est codé en dur
   ici : tout vient de /data/forum-config.json. Le contenu (fil de départ,
   textes générés, réactions possibles) vient de /data/forum-seed.json.
   Les auteurs simulés sont tirés de /data/members.json, pour que "qui
   poste ici" et "qui apparaît dans l'annuaire" soit la même communauté.

   Principe : plusieurs boucles asynchrones indépendantes tournent en
   parallèle (nouveaux commentaires, réponses, réactions, vues, membres
   en ligne) — comme sur un vrai forum, rien n'est synchronisé ou
   séquentiel. Chaque boucle attend un délai aléatoire tiré de sa plage
   de configuration, agit, puis recommence indéfiniment.

   NOTE : les fichiers JSON sont chargés via fetch(), ce qui exige de
   servir ces pages en http(s) (ex: `npx serve`, `python -m http.server`)
   plutôt que de les ouvrir directement en double-cliquant (file://),
   sans quoi le navigateur bloque la lecture des fichiers locaux.
   ========================================================================= */

(function () {
  "use strict";

  const LOCK_ICON_SVG =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<rect x="5" y="10.5" width="14" height="9" rx="1.5" stroke="currentColor" stroke-width="1.7"/>' +
    '<path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" stroke-width="1.7"/></svg>';

  let config = null;
  let membersById = new Map();
  let activeMembers = [];
  let seed = null;

  // État vivant du fil : liste ordonnée des commentaires visibles
  // (du plus ancien au plus récent, puisque les nouveaux s'ajoutent en bas).
  const visibleComments = []; // [{ id, el, replies: [{id, el}], reactions: {...}, replyListEl }]
  const usedCommentTexts = new Set();
  const usedReplyTexts = new Set();

  let counters = { views: 0, replies: 0, online: 0 };
  let els = {}; // références DOM (compteurs, liste de commentaires)

  /* ---------------------------------------------------------------
     Utilitaires spécifiques au moteur (sleep/randInt/pickRandom/
     clamp/formatNumber/fetchJSON viennent de utils.js)
     --------------------------------------------------------------- */

  const { sleep, randInt, pickRandom, clamp, formatNumber, fetchJSON, random } = Utils;

  /** Tire un texte au hasard dans un pool en évitant de répéter tant que possible. */
  function pickUnusedText(pool, usedSet) {
    if (usedSet.size >= pool.length) usedSet.clear();
    let text;
    let attempts = 0;
    do {
      text = pickRandom(pool);
      attempts++;
    } while (usedSet.has(text) && attempts < 10);
    usedSet.add(text);
    return text;
  }

  function scaledDelay(range) {
    return randInt(range.minMs, range.maxMs) * config.speedMultiplier;
  }

  /** Multiplicateur d'activité courant (0.2 à 1.3 environ), basé sur l'heure
   *  locale du visiteur et le tableau config.activityRhythm.hourlyMultiplier.
   *  Retourne 1 (rythme neutre) si la fonctionnalité est désactivée ou
   *  absente de la config. */
  function currentActivityMultiplier() {
    const rhythm = config.activityRhythm;
    if (!rhythm || !rhythm.enabled) return 1;
    const hour = new Date().getHours();
    const value = rhythm.hourlyMultiplier[hour];
    return typeof value === "number" ? value : 1;
  }

  /** Comme scaledDelay, mais ralenti quand l'activité horaire est basse
   *  (nuit) et accéléré quand elle est haute (heures de pointe). Réservé
   *  aux délais liés à la publication de contenu (nouveaux messages,
   *  réponses, réactions) — pas aux intervalles de tick des compteurs. */
  function activityScaledDelay(range) {
    const factor = Math.max(currentActivityMultiplier(), 0.15); // plancher de sécurité, jamais de division par ~0
    return scaledDelay(range) / factor;
  }

  /** Nombre de messages/réponses à garder visibles, ajusté selon le même
   *  rythme jour/nuit : la nuit (activité basse) on en garde davantage
   *  affichés pour qu'il y ait de quoi lire ; en heure de pointe (activité
   *  haute) on purge plus vite pour ne pas surcharger la page. `baseKey`
   *  pointe vers maxVisibleComments ou maxVisibleRepliesPerComment,
   *  `capKey` vers activityRhythm.commentCap ou .replyCap. */
  function dynamicVisibleCap(baseKey, capKey) {
    const base = config[baseKey];
    const rhythm = config.activityRhythm;
    const capRange = rhythm && rhythm[capKey];
    if (!rhythm || !rhythm.enabled || !capRange) return base;
    const factor = Math.max(currentActivityMultiplier(), 0.15);
    const raw = Math.round(base / factor);
    return clamp(raw, capRange.min, capRange.max);
  }

  function pulse(el) {
    el.classList.remove("is-pulsing");
    // force reflow pour pouvoir rejouer l'animation si elle vient de tourner
    void el.offsetWidth;
    el.classList.add("is-pulsing");
  }

  function fullName(member) {
    return member.firstName + " " + member.lastName;
  }

  /* ---------------------------------------------------------------
     Sons — indicateur de frappe (boucle) + message envoyé (aperçu).
     Best-effort : beaucoup de navigateurs bloquent la lecture tant
     qu'aucune interaction n'a eu lieu sur la page, et le fichier
     typingLoop peut ne pas encore exister sur disque. Dans les deux
     cas, l'échec est silencieux et ne bloque jamais le reste du
     moteur (comment/reply s'affichent normalement même sans son).

     typingRefCount existe parce que plusieurs indicateurs "is typing"
     peuvent être visibles en même temps (un nouveau commentaire ET
     une réponse en cours de frappe simultanément) : la boucle ne
     doit s'arrêter que quand le dernier disparaît, pas au premier.
     --------------------------------------------------------------- */
  const sounds = {
    enabled: false,
    volume: 0.4,
    typingLoop: null,
    messageSent: null,
    typingRefCount: 0,
  };

  function initSounds(soundsConfig) {
    if (!soundsConfig || soundsConfig.enabled === false) return;

    sounds.enabled = true;
    sounds.volume = typeof soundsConfig.volume === "number" ? soundsConfig.volume : 0.4;

    if (soundsConfig.typingLoop) {
      const audio = new Audio(soundsConfig.typingLoop);
      audio.loop = true;
      audio.volume = sounds.volume;
      audio.addEventListener("error", () => { sounds.typingLoop = null; });
      sounds.typingLoop = audio;
    }

    if (soundsConfig.messageSent) {
      const audio = new Audio(soundsConfig.messageSent);
      audio.volume = sounds.volume;
      audio.addEventListener("error", () => { sounds.messageSent = null; });
      sounds.messageSent = audio;
    }
  }

  function startTypingSound() {
    if (!sounds.enabled || !sounds.typingLoop) return;
    sounds.typingRefCount += 1;
    if (sounds.typingRefCount === 1) {
      sounds.typingLoop.currentTime = 0;
      sounds.typingLoop.play().catch(() => {});
    }
  }

  function stopTypingSound() {
    if (!sounds.enabled || !sounds.typingLoop) return;
    sounds.typingRefCount = Math.max(0, sounds.typingRefCount - 1);
    if (sounds.typingRefCount === 0) sounds.typingLoop.pause();
  }

  function playMessageSentSound() {
    if (!sounds.enabled || !sounds.messageSent) return;
    sounds.messageSent.currentTime = 0;
    sounds.messageSent.play().catch(() => {});
  }

  /* ---------------------------------------------------------------
     Construction du DOM — commentaire / réponse
     --------------------------------------------------------------- */

  function buildReactionSummary(reactions) {
    const entries = Object.entries(reactions || {});
    if (entries.length === 0) return null;

    const ul = document.createElement("ul");
    ul.className = "reaction-summary reaction-summary--compact";
    ul.setAttribute("aria-label", "Reactions");

    entries.forEach(([emoji, count]) => {
      const li = document.createElement("li");
      li.className = "reaction-summary__item";
      li.dataset.emoji = emoji;
      li.innerHTML =
        '<span class="reaction-summary__icon" aria-hidden="true">' + emoji + "</span>" +
        '<span class="reaction-summary__count">' + count + "</span>";
      ul.appendChild(li);
    });

    return ul;
  }

  function buildAccessNotice() {
    const p = document.createElement("p");
    p.className = "access-notice access-notice--inline";
    p.innerHTML =
      '<span class="access-notice__icon" aria-hidden="true">' + LOCK_ICON_SVG + "</span>" +
      '<button class="access-notice__action" type="button" disabled>Reply</button>' +
      '<span class="access-notice__label">Active Members Only</span>';
    return p;
  }

  function buildAuthorBlock(member, timestampLabel) {
    const wrap = document.createElement("div");
    wrap.className = "author";

    const avatar = Avatar.createElement(fullName(member), "md", {
      colorIndex: member.colorIndex,
      online: member.online,
    });
    avatar.classList.add("author__avatar");
    wrap.appendChild(avatar);

    const identity = document.createElement("div");
    identity.className = "author__identity";
    identity.innerHTML =
      '<span class="author__name">' + fullName(member) + "</span>" +
      '<span class="badge">' + member.role + "</span>" +
      '<time class="author__timestamp">' + timestampLabel + "</time>";
    wrap.appendChild(identity);

    return wrap;
  }

  function buildCommentElement(commentData, member, timestampLabel) {
    const article = document.createElement("article");
    article.className = "comment surface-card";
    article.dataset.commentId = commentData.id;

    const header = document.createElement("header");
    header.className = "comment__header";
    header.appendChild(buildAuthorBlock(member, timestampLabel));
    article.appendChild(header);

    const body = document.createElement("div");
    body.className = "comment__body";
    const text = document.createElement("p");
    text.className = "comment__text";
    text.textContent = commentData.text;
    body.appendChild(text);

    if (commentData.attachment) {
      const figure = document.createElement("figure");
      figure.className = "comment__attachment";
      figure.innerHTML = '<img class="comment__attachment-image" src="" alt="Attachment shared by ' + fullName(member) + '">';
      body.appendChild(figure);
    }
    article.appendChild(body);

    const footer = document.createElement("footer");
    footer.className = "comment__footer";
    const reactionsEl = buildReactionSummary(commentData.reactions);
    if (reactionsEl) footer.appendChild(reactionsEl);
    footer.appendChild(buildAccessNotice());
    article.appendChild(footer);

    const replyList = document.createElement("ol");
    replyList.className = "reply-list";
    article.appendChild(replyList);

    return { article, replyList };
  }

  function buildReplyElement(replyData, member, timestampLabel) {
    const article = document.createElement("article");
    article.className = "reply";
    article.dataset.replyId = replyData.id;

    const header = document.createElement("header");
    header.className = "reply__header";
    header.appendChild(buildAuthorBlock(member, timestampLabel));
    article.appendChild(header);

    const body = document.createElement("div");
    body.className = "reply__body";
    body.innerHTML = '<p class="reply__text"></p>';
    body.querySelector(".reply__text").textContent = replyData.text;
    article.appendChild(body);

    const footer = document.createElement("footer");
    footer.className = "reply__footer";
    const reactionsEl = buildReactionSummary(replyData.reactions);
    if (reactionsEl) footer.appendChild(reactionsEl);
    footer.appendChild(buildAccessNotice());
    article.appendChild(footer);

    return article;
  }

  /* ---------------------------------------------------------------
     Insertion / suppression animées
     --------------------------------------------------------------- */

  function isNearBottom(container) {
    return container.scrollHeight - container.scrollTop - container.clientHeight < config.autoScrollThresholdPx;
  }

  function removeWithAnimation(li, durationMs) {
    li.style.overflow = "hidden";
    li.style.maxHeight = li.scrollHeight + "px";
    requestAnimationFrame(() => {
      li.style.transition = "all " + durationMs + "ms ease";
      li.style.opacity = "0";
      li.style.transform = "translateY(-8px)";
      li.style.maxHeight = "0px";
      li.style.marginTop = "0px";
      li.style.marginBottom = "0px";
      li.style.paddingTop = "0px";
      li.style.paddingBottom = "0px";
    });
    setTimeout(() => li.remove(), durationMs + 60);
  }

  function pruneCommentsIfNeeded() {
    const max = dynamicVisibleCap("maxVisibleComments", "commentCap");
    while (visibleComments.length > max) {
      const oldest = visibleComments.shift();
      removeWithAnimation(oldest.li, config.commentFadeOutMs);
    }
  }

  function pruneRepliesIfNeeded(commentEntry) {
    const max = dynamicVisibleCap("maxVisibleRepliesPerComment", "replyCap");
    while (commentEntry.replies.length > max) {
      const oldest = commentEntry.replies.shift();
      removeWithAnimation(oldest.li, config.commentFadeOutMs);
    }
  }

  /* ---------------------------------------------------------------
     Compteurs (vues, réponses, membres en ligne)
     --------------------------------------------------------------- */

  function setCounterText(el, value) {
    el.textContent = formatNumber(value);
    pulse(el);
  }

  function bumpReplyCounter() {
    counters.replies += 1;
    setCounterText(els.repliesCount, counters.replies);
  }

  /* ---------------------------------------------------------------
     Ajout d'un commentaire / d'une réponse au DOM
     --------------------------------------------------------------- */

  function appendComment(commentData, member, timestampLabel) {
    const { article, replyList } = buildCommentElement(commentData, member, timestampLabel);
    article.classList.add("is-entering");

    const li = document.createElement("li");
    li.className = "comment-list__item";
    li.appendChild(article);

    const wasNearBottom = isNearBottom(els.mainScroll);
    els.commentList.appendChild(li);
    if (wasNearBottom) {
      els.mainScroll.scrollTop = els.mainScroll.scrollHeight;
    }

    visibleComments.push({
      id: commentData.id,
      li,
      replyListEl: replyList,
      reactions: Object.assign({}, commentData.reactions || {}),
      replies: [],
    });

    pruneCommentsIfNeeded();
    return visibleComments[visibleComments.length - 1];
  }

  function appendReply(commentEntry, replyData, member, timestampLabel, countTowardsTotal) {
    const article = buildReplyElement(replyData, member, timestampLabel);
    article.classList.add("is-entering");

    const li = document.createElement("li");
    li.className = "reply-list__item";
    li.appendChild(article);

    commentEntry.replyListEl.appendChild(li);

    commentEntry.replies.push({
      id: replyData.id,
      li,
      reactions: Object.assign({}, replyData.reactions || {}),
    });

    pruneRepliesIfNeeded(commentEntry);
    if (countTowardsTotal) bumpReplyCounter();
  }

  /* ---------------------------------------------------------------
     Indicateur de frappe
     --------------------------------------------------------------- */

  function showTyping(member) {
    const p = document.createElement("p");
    p.className = "typing-indicator is-entering";
    p.innerHTML =
      '<span>' + fullName(member) + " is typing</span>" +
      '<span class="typing-indicator__dots"><span></span><span></span><span></span></span>';
    return p;
  }

  /* ---------------------------------------------------------------
     Reactions vivantes
     --------------------------------------------------------------- */

  function addOrIncrementReaction(entry, listEl) {
    const emoji = pickRandom(seed.generatedContent.reactions);
    const increment = randInt(config.reactionIncrement.min, config.reactionIncrement.max);
    entry.reactions[emoji] = (entry.reactions[emoji] || 0) + increment;

    let ul = listEl.querySelector(".reaction-summary");
    if (!ul) {
      ul = document.createElement("ul");
      ul.className = "reaction-summary reaction-summary--compact";
      ul.setAttribute("aria-label", "Reactions");
      listEl.insertBefore(ul, listEl.firstChild);
    }

    let li = ul.querySelector('[data-emoji="' + emoji + '"]');
    if (!li) {
      li = document.createElement("li");
      li.className = "reaction-summary__item is-entering";
      li.dataset.emoji = emoji;
      li.innerHTML =
        '<span class="reaction-summary__icon" aria-hidden="true">' + emoji + "</span>" +
        '<span class="reaction-summary__count">' + entry.reactions[emoji] + "</span>";
      ul.appendChild(li);
    } else {
      const countEl = li.querySelector(".reaction-summary__count");
      countEl.textContent = entry.reactions[emoji];
      pulse(countEl);
    }
  }

  function pickRandomVisibleTarget() {
    const candidates = [];
    visibleComments.forEach((c) => {
      candidates.push({ entry: c, footerEl: c.li.querySelector(".comment__footer") });
      c.replies.forEach((r) => {
        candidates.push({ entry: r, footerEl: r.li.querySelector(".reply__footer") });
      });
    });
    if (candidates.length === 0) return null;
    return pickRandom(candidates);
  }

  /* ---------------------------------------------------------------
     Boucles autonomes — chacune tourne indéfiniment, à son rythme propre
     --------------------------------------------------------------- */

  async function newCommentLoop() {
    for (;;) {
      await sleep(activityScaledDelay(config.newCommentInterval));

      const member = pickRandom(activeMembers);
      const typingEl = showTyping(member);
      // L'indicateur de frappe vit tout en bas du flux, comme un
      // commentaire en cours d'arrivée, dans son propre <li>.
      const li = document.createElement("li");
      li.className = "comment-list__item comment-list__item--typing";
      li.appendChild(typingEl);
      els.commentList.appendChild(li);
      startTypingSound();
      if (isNearBottom(els.mainScroll)) {
        els.mainScroll.scrollTop = els.mainScroll.scrollHeight;
      }

      await sleep(scaledDelay(config.typingIndicator));
      li.remove();
      stopTypingSound();

      const text = pickUnusedText(seed.generatedContent.comments, usedCommentTexts);
      const commentData = {
        id: "gen-c-" + Date.now(),
        text: text,
        reactions: {},
      };
      const entry = appendComment(commentData, member, "Just now");
      playMessageSentSound();

      maybeScheduleReply(entry, 0);
    }
  }

  async function maybeScheduleReply(commentEntry, depth) {
    // La toute première réponse (depth 0) est garantie : un vrai forum
    // n'a quasiment jamais de message qui reste sans aucune réponse. Les
    // réponses suivantes (depth >= 1, une conversation qui s'enchaîne)
    // restent probabilistes, avec une décroissance naturelle.
    const probability = depth === 0 ? 1 : config.replyProbability * Math.pow(0.6, depth);
    if (random() > probability) return;

    await sleep(activityScaledDelay(config.replyDelayAfterComment));

    // Le commentaire a peut-être déjà défilé hors du flux entre-temps.
    if (!visibleComments.includes(commentEntry)) return;

    const member = pickRandom(activeMembers);
    const typingEl = showTyping(member);
    const li = document.createElement("li");
    li.className = "reply-list__item reply-list__item--typing";
    li.appendChild(typingEl);
    commentEntry.replyListEl.appendChild(li);
    startTypingSound();

    await sleep(scaledDelay(config.typingIndicator));
    li.remove();
    stopTypingSound();

    if (!visibleComments.includes(commentEntry)) return;

    const text = pickUnusedText(seed.generatedContent.replies, usedReplyTexts);
    const replyData = { id: "gen-r-" + Date.now(), text: text, reactions: {} };
    appendReply(commentEntry, replyData, member, "Just now", true);
    playMessageSentSound();

    maybeScheduleReply(commentEntry, depth + 1);
  }

  async function reactionLoop() {
    for (;;) {
      await sleep(activityScaledDelay(config.reactionCheckInterval));
      if (random() > config.reactionProbability) continue;

      const target = pickRandomVisibleTarget();
      if (!target) continue;

      addOrIncrementReaction(target.entry, target.footerEl);
    }
  }

  async function viewCounterLoop() {
    for (;;) {
      await sleep(activityScaledDelay(config.viewCounter.intervalMs));
      counters.views += randInt(config.viewCounter.increment.min, config.viewCounter.increment.max);
      setCounterText(els.viewsCount, counters.views);
    }
  }

  async function onlineCounterLoop() {
    for (;;) {
      await sleep(scaledDelay(config.onlineCounter.intervalMs));
      const factor = currentActivityMultiplier();
      // La fourchette min/max "respire" avec l'heure : resserrée et basse
      // la nuit, large et haute en soirée — sans jamais dépasser les
      // bornes d'origine définies dans la config.
      const dynMin = Math.round(config.onlineCounter.min * factor);
      const dynMax = Math.round(config.onlineCounter.max * factor);
      const delta = randInt(config.onlineCounter.delta.min, config.onlineCounter.delta.max);
      counters.online = clamp(counters.online + delta, dynMin, dynMax);
      setCounterText(els.onlineCount, counters.online);

      // Petit effet secondaire : un ou deux auteurs déjà affichés
      // passent en ligne / hors ligne, pour que le point vert vive
      // aussi visuellement, pas seulement le chiffre global.
      const avatars = els.commentList.querySelectorAll(".author__avatar");
      if (avatars.length > 0) {
        const el = pickRandom(Array.from(avatars));
        el.classList.toggle("is-online");
      }
    }
  }

  /* ---------------------------------------------------------------
     Rendu initial du fil (contenu de départ, depuis forum-seed.json)
     --------------------------------------------------------------- */

  function renderSeedThread() {
    document.title = seed.thread.title + " - Ryan Reynolds Fan Club";
    const titleEl = document.getElementById("discussion-title");
    if (titleEl) titleEl.textContent = seed.thread.title;

    seed.comments.forEach((commentData) => {
      const member = membersById.get(commentData.authorId);
      if (!member) return;
      const entry = appendComment(commentData, member, seedTimestampLabel(commentData));
      // Retire l'animation d'entrée pour le contenu de départ : seul le
      // contenu généré ensuite doit sembler "arriver en direct".
      entry.li.querySelector(".comment, .reply").classList.remove("is-entering");

      (commentData.replies || []).forEach((replyData) => {
        const replyMember = membersById.get(replyData.authorId);
        if (!replyMember) return;
        appendReply(entry, replyData, replyMember, seedTimestampLabel(replyData));
        const lastReplyLi = entry.replies[entry.replies.length - 1].li;
        lastReplyLi.querySelector(".reply").classList.remove("is-entering");
      });
    });

    // Les réponses du contenu de départ ne sont pas comptées une à une
    // (appendReply reçoit countTowardsTotal=false plus haut) : le total
    // de départ vient directement de la configuration.
    counters.replies = config.startingCounters.replies;
    els.repliesCount.textContent = formatNumber(counters.replies);
  }

  /** Les messages du fil de départ (seed.comments, figés dans
   *  forum-seed.json) doivent sembler "récents mais pas d'aujourd'hui" —
   *  entre 2 et 3 semaines avant la date réelle de consultation, pas une
   *  date fixe codée en dur qui se périme. randInt() vient du générateur
   *  à graine fixe (voir utils.js) : le résultat reste identique pour
   *  tout le monde qui consulte la page le même jour. */
  function seedTimestampLabel() {
    const daysAgo = randInt(14, 21);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  /** Convertit un nombre de minutes écoulées en libellé lisible
   *  ("Just now", "12 min ago", "3 hr ago"). Utilisé par backfillThread
   *  pour donner des horodatages crédibles et variés aux messages
   *  pré-remplis, plutôt que "Just now" partout à la fois. */
  function relativeTimeLabel(minutes) {
    if (minutes < 1) return "Just now";
    if (minutes < 60) return minutes + " min ago";
    return Math.round(minutes / 60) + " hr ago";
  }

  /** Pré-remplit le fil au chargement avec plusieurs messages déjà "là"
   *  (horodatés dans le passé récent, pas "Just now"), en plus du fil de
   *  départ figé (seed.comments). Objectif : même si le visiteur arrive
   *  pendant une plage horaire creuse (nuit) où newCommentLoop met long-
   *  temps à produire un nouveau message, il y a déjà de quoi lire dès
   *  l'arrivée sur la page — cohérent avec le plafond dynamique de
   *  dynamicVisibleCap, qui monte justement quand l'activité est basse. */
  function backfillThread() {
    const cap = dynamicVisibleCap("maxVisibleComments", "commentCap");
    // On vise ~75% du plafond courant : assez rempli pour être lisible et
    // crédible, sans le saturer totalement (garde de la place pour que
    // les premiers messages "Just now" restent visibles à leur arrivée).
    const target = Math.max(0, Math.floor(cap * 0.75) - visibleComments.length);
    if (target <= 0) return;

    const oldestMinutes = 240; // jusqu'à ~4h avant l'arrivée du visiteur
    const newestMinutes = 6;   // jusqu'à ~6 min avant

    for (let i = 0; i < target; i++) {
      const member = pickRandom(activeMembers);
      const progress = target === 1 ? 1 : i / (target - 1);
      const minutesAgo = Math.round(oldestMinutes - progress * (oldestMinutes - newestMinutes));
      const reactionCount = randInt(0, 9);
      const commentData = {
        id: "backfill-c-" + i + "-" + Date.now(),
        text: pickUnusedText(seed.generatedContent.comments, usedCommentTexts),
        reactions: reactionCount > 0 ? { "👍": reactionCount } : {},
      };
      const entry = appendComment(commentData, member, relativeTimeLabel(minutesAgo));
      // Comme pour le fil de départ : pas d'animation d'entrée, ces
      // messages sont censés être déjà là au moment où la page s'affiche.
      entry.li.querySelector(".comment, .reply").classList.remove("is-entering");

      // Un vrai forum n'a (quasiment) jamais de message sans une seule
      // réponse : chaque commentaire pré-rempli en reçoit au moins une,
      // parfois deux, horodatées un peu après le commentaire lui-même.
      const replyCount = randInt(1, 2);
      for (let r = 0; r < replyCount; r++) {
        const replyMember = pickRandom(activeMembers);
        const replyMinutesAgo = Math.max(1, minutesAgo - randInt(1, Math.max(1, Math.round(minutesAgo / 2))));
        const replyReactionCount = randInt(0, 5);
        const replyData = {
          id: "backfill-r-" + i + "-" + r + "-" + Date.now(),
          text: pickUnusedText(seed.generatedContent.replies, usedReplyTexts),
          reactions: replyReactionCount > 0 ? { "👍": replyReactionCount } : {},
        };
        appendReply(entry, replyData, replyMember, relativeTimeLabel(replyMinutesAgo));
        const lastReplyLi = entry.replies[entry.replies.length - 1].li;
        lastReplyLi.querySelector(".reply").classList.remove("is-entering");
      }
    }
  }

  /* ---------------------------------------------------------------
     Démarrage
     --------------------------------------------------------------- */

  async function init() {
    els.mainScroll = document.querySelector(".app-main");
    els.commentList = document.querySelector(".comment-list");
    els.viewsCount = document.getElementById("thread-views-count");
    els.repliesCount = document.getElementById("thread-replies-count");
    els.onlineCount = document.getElementById("thread-online-count");

    if (!els.commentList) return; // cette page n'a pas de fil de discussion

    try {
      const [configData, membersData, seedData] = await Promise.all([
        fetchJSON("data/forum-config.json"),
        fetchJSON("data/members.json"),
        fetchJSON("data/forum-seed.json"),
      ]);

      config = configData;
      seed = seedData;
      initSounds(config.sounds);
      membersData.members.forEach((m) => membersById.set(m.id, m));
      activeMembers = membersData.members.filter((m) => m.role === "Active Member");

      counters.views = config.startingCounters.views;
      counters.online = Math.round(config.startingCounters.onlineMembers * currentActivityMultiplier());
      els.viewsCount.textContent = formatNumber(counters.views);
      els.onlineCount.textContent = formatNumber(counters.online);

      renderSeedThread();
      backfillThread();
      scrollToLatest();

      // Chaque boucle démarre indépendamment — aucune n'attend les autres.
      newCommentLoop();
      reactionLoop();
      viewCounterLoop();
      onlineCounterLoop();
    } catch (err) {
      console.error("[forum-engine] Failed to start the simulation:", err);
    }
  }

  /** Atterrissage direct sur les messages les plus récents (bas du fil),
      comme sur une appli de messagerie — pas un défilement animé, juste
      la bonne position dès l'affichage. Le rAF laisse le temps au layout
      du fil de départ de se calculer avant de lire scrollHeight, sinon
      on atterrit un cran trop haut. */
  function scrollToLatest() {
    requestAnimationFrame(() => {
      els.mainScroll.scrollTop = els.mainScroll.scrollHeight;
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
