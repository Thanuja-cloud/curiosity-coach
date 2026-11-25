#!/usr/bin/env node
// Curiosity Coach: one topic, one 10-minute task, zero guilt.
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const DATA_FILE = process.env.COACH_DATA || path.join(__dirname, "data.json");
const MODEL = process.env.COACH_MODEL || "claude-opus-5-5";
const DAY = 24 * 60 * 60 * 1000;

// ---------- storage ----------
function load() {
  if (!fs.existsSync(DATA_FILE)) save({ topics: [], log: [], current: null });
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}
function save(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + "\n");
}
const today = () => new Date().toISOString().slice(0, 10);
const same = (a, b) => a.toLowerCase() === b.toLowerCase();
const findTopic = (data, name) => data.topics.find((t) => same(t.name, name));

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a.trim()); }));
}

// When did I last touch this topic? (0 = never, so it floats to the top)
function lastTouched(data, name) {
  const dates = data.log.filter((e) => same(e.topic, name)).map((e) => Date.parse(e.date));
  return dates.length ? Math.max(...dates) : 0;
}
function daysAgo(ms) {
  if (!ms) return "never";
  const d = Math.floor((Date.now() - ms) / DAY);
  return d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
}

// ---------- picking ----------
// Prefer topics that match the mood, then the one untouched for longest.
// Skipped topics are just set aside for today; they are never penalised.
function pick(data, mood, skipped) {
  let pool = data.topics.filter((t) => !skipped.some((s) => same(s, t.name)));
  if (!pool.length) pool = data.topics; // skipped everything? start fresh
  const moodPool = pool.filter((t) => t.kind === mood);
  if (moodPool.length) pool = moodPool;
  const ranked = pool
    .map((t) => ({ t, last: lastTouched(data, t.name), r: Math.random() }))
    .sort((a, b) => a.last - b.last || a.r - b.r);
  return ranked[0].t;
}

// ---------- task generation (Claude API) ----------
async function makeTask(topic, mood, recentNotes) {
  if (!process.env.ANTHROPIC_API_KEY) return fallbackTask(topic, "(No ANTHROPIC_API_KEY set, so here's an offline task.)");
  try {
    const Anthropic = require("@anthropic-ai/sdk");
    const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 1000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // if a request is declined, the API retries on a suitable model
      system:
        "You are a warm, concise learning coach. Write ONE task that takes about 10 minutes. " +
        "It must be small, concrete and finishable, with exactly one thing to try OR one question to answer. " +
        "Format: a short title line, then 2-4 short steps, then a line starting 'Done when:'. " +
        "Plain text, under 90 words, no markdown headings, no pep talk.",
      messages: [{
        role: "user",
        content: `Topic: ${topic}\nMood: ${mood}\n` +
          (recentNotes.length ? `What I learned last times: ${recentNotes.join(" | ")}\nBuild on that a little.` : "I'm new to this or it's been a while."),
      }],
    });
    if (res.stop_reason === "refusal") return fallbackTask(topic, "(Couldn't generate a task this time, so here's a simple one.)");
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    return text || fallbackTask(topic, "");
  } catch (err) {
    return fallbackTask(topic, `(Couldn't reach Claude${err.status ? ` (error ${err.status})` : ""}. Here's an offline task.)`);
  }
}
function fallbackTask(topic, why) {
  return `${why ? why + "\n\n" : ""}Explain one idea in ${topic}\n` +
    `1. Search "${topic} explained simply" and read one short article.\n` +
    `2. Pick ONE concept you met and write 3 sentences explaining it to a friend.\n` +
    `Done when: you can say those 3 sentences out loud without looking.`;
}

async function present(data, mood, skipped) {
  if (!data.topics.length) return console.log('Your wish list is empty. Try: coach add "Kubernetes"');
  const topic = pick(data, mood, skipped);
  const notes = data.log.filter((e) => same(e.topic, topic.name)).slice(-2).map((e) => e.note);
  console.log(`\n🎯 Today: ${topic.name}  (last touched: ${daysAgo(lastTouched(data, topic.name))})\n`);
  const task = await makeTask(topic.name, mood, notes);
  console.log(task + "\n");
  console.log("Not feeling it? `coach swap`. Finished? `coach done \"what I learned\"`.");
  data.current = { date: today(), topic: topic.name, mood, task, skipped };
  save(data);
}

// ---------- commands ----------
const commands = {
  async add(args) {
    const name = args.filter((a) => !a.startsWith("--")).join(" ").trim();
    if (!name) return console.log('Usage: coach add "Topic" [--tech | --curious]');
    const data = load();
    if (findTopic(data, name)) return console.log(`"${name}" is already on your list. 👍`);
    let kind = args.includes("--curious") ? "curious" : args.includes("--tech") ? "technical" : null;
    if (!kind) kind = /^c/i.test(await ask(`Is "${name}" more (t)echnical or (c)urious? [t/c] `)) ? "curious" : "technical";
    data.topics.push({ name, kind, added: today() });
    save(data);
    console.log(`Added "${name}" (${kind}). It'll come up when the time is right.`);
  },

  list() {
    const data = load();
    if (!data.topics.length) return console.log('Nothing here yet. Try: coach add "SQL"');
    console.log("Your wish list:\n");
    for (const t of data.topics)
      console.log(`  • ${t.name.padEnd(20)} ${t.kind.padEnd(10)} last touched: ${daysAgo(lastTouched(data, t.name))}`);
  },

  remove(args) {
    const name = args.join(" ").trim();
    const data = load();
    const before = data.topics.length;
    data.topics = data.topics.filter((t) => !same(t.name, name));
    save(data);
    console.log(data.topics.length < before ? `Removed "${name}". Your history for it is kept.` : `"${name}" wasn't on your list.`);
  },

  async today() {
    const data = load();
    const a = await ask("Feeling (t)echnical or (c)urious today? [t/c] ");
    await present(data, /^c/i.test(a) ? "curious" : "technical", []);
  },

  async swap() {
    const data = load();
    const cur = data.current && data.current.date === today() ? data.current : null;
    if (!cur) return commands.today();
    console.log(`No problem, ${cur.topic} will wait. Here's something else.`);
    await present(data, cur.mood, [...cur.skipped, cur.topic]);
  },

  async done(args) {
    const data = load();
    const minIdx = args.indexOf("--min");
    const minutes = minIdx >= 0 ? Number(args.splice(minIdx, 2)[1]) || 10 : 10;
    const topic = data.current && data.current.topic;
    if (!topic) return console.log("Nothing picked yet. Run `coach today` first.");
    const note = args.join(" ").trim() || (await ask("One line: what did you learn? "));
    data.log.push({ topic, date: new Date().toISOString(), minutes, note });
    data.current = null;
    save(data);
    console.log(`✅ Logged ${minutes} min of ${topic}. Nice, that counts.`);
  },

  recap() {
    const data = load();
    const weekAgo = Date.now() - 7 * DAY;
    const week = data.log.filter((e) => Date.parse(e.date) >= weekAgo);
    console.log("\n📅 This week\n");
    if (!week.length) console.log("  A quiet week. That's fine; curiosity comes back.\n");
    for (const e of week) console.log(`  ${e.date.slice(0, 10)}  ${e.topic}: ${e.note}`);

    const totals = {};
    for (const e of week) totals[e.topic] = (totals[e.topic] || 0) + e.minutes;
    const max = Math.max(1, ...Object.values(totals));
    if (week.length) {
      console.log("\n⏱  Minutes per topic\n");
      for (const [t, m] of Object.entries(totals).sort((a, b) => b[1] - a[1]))
        console.log(`  ${t.padEnd(16)} ${"█".repeat(Math.max(1, Math.round((m / max) * 20)))} ${m}`);
    }
    const quiet = data.topics.filter((t) => lastTouched(data, t.name) < weekAgo);
    if (quiet.length) {
      console.log("\n🌱 Waiting patiently for you\n");
      for (const t of quiet) console.log(`  ${t.name} (last touched: ${daysAgo(lastTouched(data, t.name))})`);
    }
    console.log("");
  },

  help() {
    console.log(`Curiosity Coach
  coach add "Topic" [--tech|--curious]   add to your wish list
  coach list                             show your wish list
  coach remove "Topic"                   remove a topic
  coach today                            pick one topic + a 10-minute task
  coach swap                             try a different one, no guilt
  coach done ["what I learned"] [--min N] log it (default 10 min)
  coach recap                            your week at a glance`);
  },
};

const [cmd = "help", ...args] = process.argv.slice(2);
(commands[cmd] || commands.help)(args);
