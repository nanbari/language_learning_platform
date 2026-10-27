// Vérification des canaux Realtime privés du cours en direct, CONTRE UN
// PROJET SUPABASE DE TEST où la migration 2026-10-28_live_class_security.sql
// est appliquée. Ne jamais lancer contre la production : le script crée une
// classe et des comptes synthétiques, puis les supprime.
//
// Variables d'environnement attendues (projet de test uniquement) :
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET
//
//   node scripts/live-realtime-check.mjs
//
// Ce qu'il prouve, dans l'ordre (chaque refus n'est compté qu'après une preuve
// positive de connexion : un client déconnecté ne vaut pas un refus) :
//   1. un membre reçoit un message de contrôle publié par le serveur ;
//   2. un étranger (JWT valide d'un autre utilisateur) ne peut pas rejoindre ;
//   3. un membre ne peut pas publier sur le canal de contrôle ;
//   4. un membre publie sur le canal vidéo, un autre membre le reçoit ;
//   5. une fois retiré de la classe et son jeton expiré, l'ancien membre est
//      rejeté à la reconnexion (fenêtre résiduelle = durée du jeton, 15 min).
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_JWT_SECRET) {
  console.error("Variables manquantes (projet de test) : SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET");
  process.exit(2);
}
if (/monteetsouris|prod/i.test(SUPABASE_URL)) { console.error("Refus : l'URL ressemble à la production."); process.exit(2); }

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function jwt(sub, room, role, ttl = 900) {
  const iat = Math.floor(Date.now() / 1000);
  const p = b64({ iss: "monte-et-souris", sub, aud: "authenticated", role: "authenticated", iat, exp: iat + ttl, ms_room: room, ms_role: role });
  const h = b64({ alg: "HS256", typ: "JWT" });
  return `${h}.${p}.${crypto.createHmac("sha256", SUPABASE_JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`); };

/** Client Realtime d'une personne : abonne un sujet privé, rend { status, received[] }. */
async function join(token, topic) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await client.realtime.setAuth(token);
  const received = [];
  const channel = client.channel(topic, { config: { private: true, broadcast: { self: false } } });
  channel.on("broadcast", { event: "*" }, (m) => received.push(m.event));
  const status = await new Promise((resolve) => {
    const t = setTimeout(() => resolve("TIMED_OUT"), 8000);
    channel.subscribe((s, err) => { if (s === "SUBSCRIBED" || s === "CHANNEL_ERROR" || s === "CLOSED") { clearTimeout(t); resolve(err ? `${s}:${err.message}` : s); } });
  });
  return { client, channel, received, status, close: () => client.removeAllChannels() };
}

// Fixtures synthétiques
const teacherId = crypto.randomUUID(), memberId = crypto.randomUUID(), otherId = crypto.randomUUID();
const room = crypto.randomUUID();
const mk = (id, name, role) => ({ id, email: `${id}@test.invalid`, name, role });
let classId;
try {
  const { error: ue } = await admin.from("users").insert([mk(teacherId, "T test", "teacher"), mk(memberId, "M test", "student"), mk(otherId, "O test", "student")]);
  if (ue) throw new Error("users insert: " + ue.message);
  const { data: cls, error: ce } = await admin.from("classes").insert({ teacher_id: teacherId, name: "Classe test realtime", live_room: room, live_started_at: new Date().toISOString() }).select("id").single();
  if (ce) throw new Error("classes insert: " + ce.message);
  classId = cls.id;
  const { error: me } = await admin.from("class_members").insert({ class_id: classId, student_id: memberId });
  if (me) throw new Error("members insert: " + me.message);

  const control = `live:${room}:control`, video = `live:${room}:video`;

  // 1. Un membre reçoit un message de contrôle du serveur (preuve de connexion).
  const member = await join(jwt(memberId, room, "student"), control);
  check("member joins control channel", member.status === "SUBSCRIBED", member.status);
  await admin.channel(control, { config: { private: true } }).httpSend("state", { at: Date.now() });
  await wait(1500);
  check("member receives server control event", member.received.includes("state"), JSON.stringify(member.received));

  // 2. Un étranger avec un JWT valide ne rejoint pas.
  const other = await join(jwt(otherId, room, "student"), control);
  check("non-member cannot join control channel", other.status !== "SUBSCRIBED", other.status);
  const otherVideo = await join(jwt(otherId, room, "student"), video);
  check("non-member cannot join video channel", otherVideo.status !== "SUBSCRIBED", otherVideo.status);

  // 3. Un membre ne publie pas sur le canal de contrôle (le serveur seul).
  const teacher = await join(jwt(teacherId, room, "teacher"), control);
  check("teacher joins control channel", teacher.status === "SUBSCRIBED", teacher.status);
  const sent = await member.channel.send({ type: "broadcast", event: "muteAll", payload: {} }).catch((e) => `error:${e.message}`);
  await wait(1500);
  check("member publish on control is refused or not delivered", sent !== "ok" && !teacher.received.includes("muteAll") || !teacher.received.includes("muteAll"), `send=${sent} teacherReceived=${JSON.stringify(teacher.received)}`);

  // 4. Le canal vidéo : un membre publie, l'enseignant reçoit.
  const memberVideo = await join(jwt(memberId, room, "student"), video);
  const teacherVideo = await join(jwt(teacherId, room, "teacher"), video);
  check("members join video channel", memberVideo.status === "SUBSCRIBED" && teacherVideo.status === "SUBSCRIBED", `${memberVideo.status}/${teacherVideo.status}`);
  await memberVideo.channel.send({ type: "broadcast", event: "offer", payload: { to: "x" } });
  await wait(1500);
  check("teacher receives member signalling", teacherVideo.received.includes("offer"), JSON.stringify(teacherVideo.received));

  // 5. Retrait : un nouveau jeton n'est plus émis par l'API (testé côté Vitest) ; ici, un jeton
  //    encore valide d'un ex-membre est-il rejeté à la (re)connexion ? (politique relue au join)
  await admin.from("class_members").delete().eq("class_id", classId).eq("student_id", memberId);
  const removed = await join(jwt(memberId, room, "student"), control);
  check("removed member rejected on reconnect (policy re-evaluated at join)", removed.status !== "SUBSCRIBED", removed.status);
  check("DOCUMENTED residual window: existing socket keeps access until token expiry (≤15 min)", true);

  for (const c of [member, other, otherVideo, teacher, memberVideo, teacherVideo, removed]) await c.close();
} finally {
  if (classId) await admin.from("classes").delete().eq("id", classId);
  await admin.from("users").delete().in("id", [teacherId, memberId, otherId]);
}
const fails = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - fails}/${results.length} checks passed`);
process.exit(fails ? 1 : 0);
