/* ===========================================================================
   SUPABASE CLIENT — remplace progressivement fake-db.js
   ---------------------------------------------------------------------------
   Ce fichier vit au même endroit que fake-db.js (racine du projet, partagé
   par community/ et admin/) et va prendre sa place petit à petit, fonction
   par fonction, à mesure qu'on avance dans le plan.

   ⚠️ À REMPLIR avant toute chose : colle ta clé "anon public" ci-dessous
   (Project Settings → API → Project API keys → anon public). Ce n'est PAS
   un secret à cacher — elle est faite pour vivre dans du code exécuté dans
   le navigateur, toute la sécurité repose sur les règles RLS écrites côté
   base de données, pas sur le fait de cacher cette clé.
   ========================================================================= */

const SUPABASE_URL = "https://hedgwufofybqvibftzmi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlZGd3dWZvZnlicXZpYmZ0em1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0NzIxNjcsImV4cCI6MjEwMDA0ODE2N30.Qv_T5td_jDdzdbGsq7fc2601LLfHA8jayTr-tzZzGMY";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SupabaseDB = (function () {
  "use strict";

  /* Même vocabulaire que FakeDB.LOGIN_RESULT, plus PENDING (un candidat
     pas encore approuvé par l'admin) qui n'existait pas côté FakeDB. */
  const LOGIN_RESULT = {
    SUCCESS_MEMBER: "success-member",
    SUCCESS_ADMIN: "success-admin",
    PENDING: "pending",
    REJECTED: "rejected",
    REVOKED: "revoked",
    INVALID: "invalid",
  };

  /**
   * Connexion réelle : vérifie l'e-mail/mot de passe auprès de Supabase
   * Auth, PUIS va lire le statut dans `profiles` (pending/approved/revoked
   * + is_admin) pour décider si l'accès est autorisé.
   *
   * Important : si le compte n'est pas "approved", on se déconnecte tout
   * de suite (supabaseClient garde sinon une session valide en local
   * storage même si on refuse l'accès côté UI).
   */
  async function signIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      return { result: LOGIN_RESULT.INVALID };
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("status, is_admin, first_name, last_name, access_revoked")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      await supabaseClient.auth.signOut();
      return { result: LOGIN_RESULT.INVALID };
    }

    if (profile.access_revoked) {
      await supabaseClient.auth.signOut();
      return { result: LOGIN_RESULT.REVOKED };
    }

    if (profile.status === "pending") {
      await supabaseClient.auth.signOut();
      return { result: LOGIN_RESULT.PENDING };
    }

    if (profile.status === "rejected") {
      await supabaseClient.auth.signOut();
      return { result: LOGIN_RESULT.REJECTED };
    }

    if (profile.status !== "approved") {
      /* Tout autre statut inattendu : pas d'accès. */
      await supabaseClient.auth.signOut();
      return { result: LOGIN_RESULT.INVALID };
    }

    return {
      result: profile.is_admin ? LOGIN_RESULT.SUCCESS_ADMIN : LOGIN_RESULT.SUCCESS_MEMBER,
      profile: profile,
    };
  }

  /* Session réelle : gérée automatiquement par le SDK Supabase (stockée
     en localStorage, survit même à la fermeture de l'onglet — contraire
     à FakeDB qui utilisait sessionStorage). getSession() sert juste à
     vérifier si quelqu'un est déjà connecté (ex: au chargement de
     login.html, pour le rediriger direct vers discussion.html). */
  async function getSession() {
    const { data } = await supabaseClient.auth.getSession();
    return data.session;
  }

  async function clearSession() {
    await supabaseClient.auth.signOut();
  }

  /* Utilisé par les pages communauté (nav "Admin", futur auth-guard...) :
     un seul appel pour savoir qui est connecté et si c'est un admin. */
  async function getCurrentProfile() {
    const { data } = await supabaseClient.auth.getSession();
    const session = data.session;
    if (!session) return { session: null, profile: null };

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("status, is_admin, first_name, last_name, email, access_revoked")
      .eq("id", session.user.id)
      .single();

    return { session: session, profile: profile || null };
  }

  /**
   * Crée un compte réel : Supabase gère le mot de passe (jamais vu par
   * notre code en clair après cet appel, jamais stocké par nous). Les
   * infos du formulaire (prénom, pays, motivation...) partent dans
   * `user_metadata` — le trigger SQL qu'on a écrit à l'étape 2 les copie
   * automatiquement dans la table `profiles` dès que le compte existe.
   */
  async function signUp({ email, password, firstName, lastName, address, city, state, zip, country, phone, favoriteMovie, motivation }) {
    const { data, error } = await supabaseClient.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          address: address,
          city: city,
          state: state,
          zip: zip,
          country: country,
          phone: phone,
          favorite_movie: favoriteMovie,
          motivation: motivation,
        },
      },
    });

    if (error) return { error: error };
    return { user: data.user };
  }

  /* ===================================================================
     ADMIN — candidatures (status="pending"), membres (status="approved"),
     décisions (approve/reject/revoke). Réservé aux comptes is_admin=true
     (RLS "Admins can read/update all profiles" côté base).
     =================================================================== */

  function initialsOf(firstName, lastName) {
    var a = (firstName || "").trim().charAt(0);
    var b = (lastName || "").trim().charAt(0);
    return (a + b).toUpperCase() || "?";
  }

  /* admin-app.js (et utils.js: fullName) attendent le même format d'objet
     que l'ancien FakeDB (camelCase, + quelques champs calculés qui
     n'existent pas tels quels côté base : initials, applicationId...).
     Cette fonction fait le pont entre la ligne `profiles` (snake_case)
     et ce format, pour ne pas avoir à réécrire tout admin-app.js. */
  function normalizeProfile(row) {
    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      country: row.country,
      language: row.language,
      phone: row.phone,
      address: row.address,
      city: row.city,
      state: row.state,
      zip: row.zip,
      favoriteMovie: row.favorite_movie,
      motivation: row.motivation,
      status: row.status,
      isAdmin: row.is_admin,
      accessRevoked: !!row.access_revoked,
      submittedAt: row.created_at,
      memberSince: row.created_at,
      reviewedAt: row.reviewed_at,
      initials: initialsOf(row.first_name, row.last_name),
      applicationId: "#APP-" + String(row.id).slice(0, 8).toUpperCase(),
      /* Pas encore suivis côté base — voir remarque plus bas. */
      membershipCardActive: row.status === "approved",
      lastLogin: null,
    };
  }

  async function getApplications() {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[SupabaseDB] getApplications:", error);
      return [];
    }
    return data.map(normalizeProfile);
  }

  async function getMembers() {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[SupabaseDB] getMembers:", error);
      return [];
    }
    return data.map(normalizeProfile);
  }

  async function approveApplication(id) {
    const { data, error } = await supabaseClient
      .from("profiles")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[SupabaseDB] approveApplication:", error);
      return null;
    }
    return normalizeProfile(data);
  }

  async function rejectApplication(id) {
    const { error } = await supabaseClient
      .from("profiles")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", id);

    if (error) console.error("[SupabaseDB] rejectApplication:", error);
  }

  async function setMemberRevoked(id, revoked) {
    const { error } = await supabaseClient
      .from("profiles")
      .update({ access_revoked: revoked })
      .eq("id", id);

    if (error) console.error("[SupabaseDB] setMemberRevoked:", error);
  }

  return {
    LOGIN_RESULT: LOGIN_RESULT,
    signUp: signUp,
    signIn: signIn,
    getSession: getSession,
    getCurrentProfile: getCurrentProfile,
    clearSession: clearSession,
    getApplications: getApplications,
    getMembers: getMembers,
    approveApplication: approveApplication,
    rejectApplication: rejectApplication,
    setMemberRevoked: setMemberRevoked,
  };
})();
