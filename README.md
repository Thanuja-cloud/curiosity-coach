# 🌱 Curiosity Coach

A tiny command-line coach for people whose interests jump around.
Some weeks it's JavaScript, then SQL, then Kubernetes, then maths. This tool goes along with that and doesn't push one plan on you.

- **One topic a day, one 10-minute task.** It's small enough to finish.
- **Prefers whatever you haven't touched for the longest time**, so nothing gets lost.
- **Swapping costs nothing.** A skipped topic isn't penalised and keeps its place in line.
- **No streaks and no shaming.** Quiet topics are just "waiting patiently for you".
- **Your data stays local** in one `data.json` file. No accounts, no database.

## Setup

Needs Node.js 18 or newer.

```bash
git clone <your-repo-url> curiosity-coach
cd curiosity-coach
npm install
npm link            # makes the `coach` command available everywhere (optional)
```

Set your Claude API key as an environment variable. It is never stored in the code or in `data.json`:

```bash
export ANTHROPIC_API_KEY="your-key-here"
```

No key? The coach still works and gives you a simple built-in task instead.

Optional settings:

| Variable      | Default                  | Purpose                         |
| ------------- | ------------------------ | ------------------------------- |
| `COACH_DATA`  | `data.json` next to `index.js` | Where your data lives    |
| `COACH_MODEL` | `claude-opus-5-5`        | Which Claude model writes tasks |

## Commands

```text
coach add "Topic" [--tech|--curious]    add to your wish list
coach list                              show your wish list
coach remove "Topic"                    remove a topic (history is kept)
coach today                             pick one topic + a 10-minute task
coach swap                              try a different one, no guilt
coach done ["what I learned"] [--min N] log it (default 10 min)
coach recap                             your week at a glance
```

(Without `npm link`, run `node index.js <command>` instead.)

## Example session

```text
$ coach add "Kubernetes" --tech
Added "Kubernetes" (technical). It'll come up when the time is right.

$ coach add "Maths"
Is "Maths" more (t)echnical or (c)urious? [t/c] c
Added "Maths" (curious). It'll come up when the time is right.

$ coach list
Your wish list:

  • JavaScript           technical  last touched: 3 days ago
  • SQL                  technical  last touched: never
  • Kubernetes           technical  last touched: never
  • Maths                curious    last touched: yesterday
  • Science              curious    last touched: never

$ coach today
Feeling (t)echnical or (c)urious today? [t/c] t

🎯 Today: SQL  (last touched: never)

Find your top 3 with ORDER BY + LIMIT
1. Open an online SQL playground (e.g. sqliteonline.com).
2. Create a table `snacks(name, rating)` and insert 5 rows.
3. Write one query that returns the 3 highest-rated snacks.
Done when: your query returns exactly 3 rows, best first.

Not feeling it? `coach swap`. Finished? `coach done "what I learned"`.

$ coach swap
No problem, SQL will wait. Here's something else.

🎯 Today: Kubernetes  (last touched: never)
...

$ coach done "A Pod is the smallest thing Kubernetes schedules, not a container"
✅ Logged 10 min of Kubernetes. Nice, that counts.

$ coach recap

📅 This week

  2026-11-23  JavaScript: Array.at(-1) gets the last item
  2026-11-24  Maths: Primes thin out roughly like 1/ln n
  2026-11-25  Kubernetes: A Pod is the smallest thing Kubernetes schedules

⏱  Minutes per topic

  Maths            ████████████████████ 15
  JavaScript       █████████████ 10
  Kubernetes       █████████████ 10

🌱 Waiting patiently for you

  SQL (last touched: never)
  Science (last touched: never)
```

(Task text comes from Claude, so yours will differ.)

## How it works

- **Data:** `data.json` holds `topics` (name and kind), a `log` of finished sessions (topic, date, minutes, note) and `current` (today's pick plus anything you swapped away). It's created automatically.
- **Picking:** It takes the topics that match your mood (if you have none of that kind, it uses all of them). Then it sorts by when you last logged each one, oldest first. Topics you've never touched come first, and ties are broken at random.
- **Swap:** It sets the current topic aside *for today only*. That is never written to your history, so skipping doesn't change how soon the topic comes back.
- **Tasks:** It sends one request to the Claude API with the topic, your mood and your last two notes on that topic, so each task builds on the last one a little. The request uses low effort and asks for a short answer, which keeps it quick and cheap. If the API can't be reached, you get an offline task instead.

## How I built it

> I kept dropping learning plans. My interests move between JavaScript, SQL, Kubernetes, maths and science, and every rigid roadmap ended with me feeling guilty. So I built a tool that works with how my brain actually behaves.
>
> **Curiosity Coach** is a ~200-line Node.js CLI. Each day it asks one question: *"Feeling technical or curious today?"* Then it picks the topic I've neglected the longest and has Claude write a single 10-minute task. The task is small and concrete, with one thing to try or one question to answer.
>
> A few design choices mattered most:
> - **Swapping is free.** Skipping a topic isn't penalised, so I never avoid opening the tool.
> - **No streaks.** The weekly recap shows what I touched and which topics are "waiting patiently". It never tells me what I "failed".
> - **Small and local.** Plain JavaScript, one JSON file, no accounts. The API key comes from an environment variable.
> - **It remembers what I learned.** My one-line notes go back into the next task prompt, so each session builds on the last.
>
> I started with the simplest version that worked (add, list, today, done) and added swap and the text bar-chart recap after that. The biggest lesson: for learning, a tool that removes guilt beats a tool that adds discipline.
>
> #NodeJS #JavaScript #LearningInPublic #AI #Claude
