// End-to-end check of the live class against a running app server + the Supabase project of .env.local.
// Creates SYNTHETIC accounts (…@test.invalid), one class, runs the flow, verifies Realtime private channels
// with real Supabase Auth tokens, then deletes everything it created (always, even on failure).
//   node live-e2e.mjs <projectDir> <appBaseUrl>
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const [projectDir, BASE] = process.argv.slice(2);
const env = fs.readFileSync(path.join(projectDir, ".env.local"), "utf8");
const get = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const URL_ = get("NEXT_PUBLIC_SUPABASE_URL"), ANON = get("NEXT_PUBLIC_SUPABASE_ANON_KEY"), SERVICE = get("SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? "  " + detail : ""}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = crypto.randomBytes(3).toString("hex");
const people = {
  T: { email: `live-test-teacher-${tag}@test.invalid`, name: "Test Enseignante", role: "teacher" },
  A: { email: `live-test-eleve-a-${tag}@test.invalid`, name: "Test Amina", role: "student" },
  B: { email: `live-test-eleve-b-${tag}@test.invalid`, name: "Test Bilal", role: "student" },
  X: { email: `live-test-dehors-${tag}@test.invalid`, name: "Test Xavier", role: "student" },
};
const password = crypto.randomBytes(18).toString("base64url");
const created = []; let classId = null;

// ── app HTTP helpers (real login through /api/auth, cookie kept per person) ──
const jar = {};
async function login(key) {
  const r = await fetch(`${BASE}/api/auth`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: people[key].email, password }) });
  const cookie = r.headers.get("set-cookie")?.split(";")[0];
  if (!r.ok || !cookie) throw new Error(`login ${key} failed: ${r.status}`);
  jar[key] = cookie;
}
async function api(key, method, p, body) {
  const r = await fetch(BASE + p, { method, headers: { "content-type": "application/json", cookie: jar[key] }, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
}
async function join(token, topic) {
  const client = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  await client.realtime.setAuth(token);
  const received = [];
  const channel = client.channel(topic, { config: { private: true, broadcast: { self: false } } });
  channel.on("broadcast", { event: "*" }, (m) => received.push(m.event));
  const status = await new Promise((resolve) => {
    const t = setTimeout(() => resolve("TIMED_OUT"), 8000);
    channel.subscribe((s, err) => { if (s === "SUBSCRIBED" || s === "CHANNEL_ERROR" || s === "CLOSED" || s === "TIMED_OUT") { clearTimeout(t); resolve(err ? `${s}:${err.message.slice(0, 60)}` : s); } });
  });
  return { channel, received, status, close: () => client.removeAllChannels() };
}

const ALPHABET_IDS = [1, 2, 3];
const slide = (target) => ({ kind: "findLetter", target: { id: target, isolated: "x", initial: "x", medial: "x", final: "x", name: "x", color: "#000" },
  choices: ALPHABET_IDS.map((id) => ({ id, isolated: "x", initial: "x", medial: "x", final: "x", name: "x", color: "#000" })) });
const state = (index, target) => ({ index, total: 3, step: 0, revealed: false, slide: slide(target) });

try {
  // ── fixtures ──
  for (const [key, p] of Object.entries(people)) {
    const { data, error } = await admin.auth.admin.createUser({ email: p.email, password, email_confirm: true, user_metadata: { name: p.name, role: p.role } });
    if (error) throw new Error(`createUser ${key}: ${error.message}`);
    p.id = data.user.id; created.push(p.id);
    const { error: pe } = await admin.from("users").insert({ id: p.id, email: p.email, name: p.name, role: p.role });
    if (pe) throw new Error(`users insert ${key}: ${pe.message}`);
  }
  const { data: cls, error: ce } = await admin.from("classes").insert({ teacher_id: people.T.id, name: `Classe test ${tag}` }).select("id").single();
  if (ce) throw new Error("classes insert: " + ce.message);
  classId = cls.id;
  const { error: me } = await admin.from("class_members").insert([{ class_id: classId, student_id: people.A.id }, { class_id: classId, student_id: people.B.id }]);
  if (me) throw new Error("members insert: " + me.message);
  console.log("fixtures ready (class", classId, ")");

  for (const k of ["T", "A", "B", "X"]) await login(k);
  check("real login through /api/auth for 4 synthetic accounts", true);

  // ── live flow through the API ──
  const start = await api("T", "POST", `/api/classes/${classId}/live`);
  check("teacher starts the live class", start.status === 200 && !!start.data?.room, `status=${start.status}`);
  const room = start.data.room;
  const q = (p) => `/api/classes/${classId}/live/${p}?room=${room}`;

  const put = await api("T", "PUT", q("state"), state(0, 2));
  check("teacher deposits slide 0", put.status === 200, `status=${put.status}`);
  const aState = await api("A", "GET", q("state"));
  check("member A reads the live state", aState.status === 200 && aState.data?.status === "live" && aState.data.state?.index === 0, `status=${aState.status}`);
  const xState = await api("X", "GET", q("state"));
  check("outsider X with the room id gets 404 and no state", xState.status === 404 && !JSON.stringify(xState.data).includes("findLetter"), `status=${xState.status}`);
  const aWrong = await api("A", "POST", q("answers"), { slideIndex: 0, choiceId: "1", correct: true, studentId: people.B.id });
  const aRight = await api("A", "POST", q("answers"), { slideIndex: 0, choiceId: "2" });
  check("A's answers: server computes correctness (forged fields ignored)", aWrong.status === 201 && aWrong.data?.correct === false && aRight.status === 201 && aRight.data?.correct === true, `${aWrong.status}/${JSON.stringify(aWrong.data)} ${aRight.status}/${JSON.stringify(aRight.data)}`);
  const bAnswers = await api("B", "GET", q("answers"));
  check("classmate B cannot read answers (403, nothing about A)", bAnswers.status === 403 && !JSON.stringify(bAnswers.data).includes("Amina"), `status=${bAnswers.status}`);
  const tAnswers = await api("T", "GET", q("answers"));
  const names = (tAnswers.data?.answers ?? []).map((a) => `${a.name}:${a.correct}`);
  check("teacher sees A's attempts with name + presence", tAnswers.status === 200 && names.join(",") === "Test Amina:false,Test Amina:true" && (tAnswers.data.participants ?? []).some((p) => p.id === people.A.id), JSON.stringify({ names, participants: tAnswers.data?.participants?.length }));
  const aPut = await api("A", "PUT", q("state"), state(1, 1));
  const aMute = await api("A", "POST", q("mute"));
  check("student cannot deposit state or mute (403)", aPut.status === 403 && aMute.status === 403, `${aPut.status}/${aMute.status}`);

  // ── Realtime: tokens and private channels ──
  const aTok = await api("A", "GET", q("token"));
  check("member A gets a Realtime token (Supabase Auth session, no HS256 secret configured)", aTok.status === 200 && typeof aTok.data?.token === "string", `status=${aTok.status} ${aTok.data?.error ?? ""}`);
  const xTok = await api("X", "GET", q("token"));
  check("outsider X gets no token (404)", xTok.status === 404, `status=${xTok.status}`);
  const tTok = await api("T", "GET", q("token"));
  const control = aTok.data.topics.control, video = aTok.data.topics.video;

  const a = await join(aTok.data.token, control);
  check("A joins the private control channel", a.status === "SUBSCRIBED", a.status);
  await api("T", "PUT", q("state"), state(1, 3));
  await wait(2500);
  check("A receives the server's 'state' poke after the teacher moves on", a.received.includes("state"), JSON.stringify(a.received));

  // X with a REAL Supabase session of their own (login via Supabase Auth directly)
  const xClient = createClient(URL_, ANON, { auth: { persistSession: false } });
  const xLogin = await xClient.auth.signInWithPassword({ email: people.X.email, password });
  const x = await join(xLogin.data.session.access_token, control);
  check("outsider with a valid Supabase session cannot join the control channel", x.status !== "SUBSCRIBED", x.status);
  const xv = await join(xLogin.data.session.access_token, video);
  check("outsider cannot join the video channel", xv.status !== "SUBSCRIBED", xv.status);

  const t = await join(tTok.data.token, control);
  const sent = await a.channel.send({ type: "broadcast", event: "muteAll", payload: {} }).catch((e) => "error:" + e.message);
  await wait(2000);
  check("student publish on the control channel is refused / not delivered", sent !== "ok" || !t.received.includes("muteAll"), `send=${sent} teacherGot=${JSON.stringify(t.received)}`);
  await api("T", "POST", q("mute"));
  await wait(2000);
  check("server 'muteAll' poke reaches the member", a.received.includes("muteAll"), JSON.stringify(a.received));

  const av = await join(aTok.data.token, video), tv = await join(tTok.data.token, video);
  check("A and T join the video channel", av.status === "SUBSCRIBED" && tv.status === "SUBSCRIBED", `${av.status}/${tv.status}`);
  await av.channel.send({ type: "broadcast", event: "offer", payload: { to: "x" } });
  await wait(2000);
  check("teacher receives A's video signalling", tv.received.includes("offer"), JSON.stringify(tv.received));

  // ── Data API lockdown with A's user token ──
  const rest = await fetch(`${URL_}/rest/v1/lessons?select=id&limit=5`, { headers: { apikey: ANON, authorization: `Bearer ${aTok.data.token}` } });
  const rows = await rest.json().catch(() => null);
  check("Data API: a student's Supabase token reads no lessons (lockdown migration applied)", rest.ok && Array.isArray(rows) && rows.length === 0 || rest.status === 401 || rest.status === 403, `status=${rest.status} rows=${Array.isArray(rows) ? rows.length : JSON.stringify(rows).slice(0, 60)}`);

  // ── removal + end ──
  await admin.from("class_members").delete().eq("class_id", classId).eq("student_id", people.A.id);
  const aAfter = await api("A", "GET", q("state"));
  const aTokAfter = await api("A", "GET", q("token"));
  const aRejoin = await join(aTok.data.token, control);
  check("removed member: state 404, no new token, rejoin with old token refused", aAfter.status === 404 && aTokAfter.status === 404 && aRejoin.status !== "SUBSCRIBED", `${aAfter.status}/${aTokAfter.status}/${aRejoin.status}`);
  const bState = await api("B", "GET", q("state"));
  check("B (still member) continues", bState.status === 200 && bState.data?.status === "live", `status=${bState.status}`);
  const end = await api("T", "DELETE", q("").replace("/?", "?"));
  const bEnded = await api("B", "GET", q("state"));
  check("teacher ends; B sees 'ended'; answers cleared", end.status === 200 && bEnded.data?.status === "ended", `${end.status} ${JSON.stringify(bEnded.data)}`);
  const { count } = await admin.from("live_answers").select("*", { count: "exact", head: true }).eq("class_id", classId);
  check("live_answers cleared at end", count === 0, `count=${count}`);

  for (const c of [a, x, xv, t, av, tv, aRejoin]) await c.close().catch(() => {});
} catch (e) {
  check("script completed without exception", false, e.message);
} finally {
  // ── cleanup, always ──
  if (classId) await admin.from("classes").delete().eq("id", classId);
  for (const id of created) {
    await admin.from("users").delete().eq("id", id);
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  const { data: left } = await admin.from("users").select("id").like("email", `%-${tag}@test.invalid`);
  console.log(`cleanup: ${created.length} synthetic accounts deleted, leftovers: ${left?.length ?? "?"}`);
}
const fails = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - fails}/${results.length} checks passed`);
process.exit(fails ? 1 : 0);
