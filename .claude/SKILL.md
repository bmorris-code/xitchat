---
name: claude
preamble-tier: 3
version: 1.0.0
description: |
  Claude-native code review — three modes. Review: structured diff review with
  PASS/FAIL gate against the base branch. Challenge: adversarial mode that hunts
  for edge cases, race conditions, and failure paths in your changes. Consult:
  ask anything about the codebase with full file-read access.
  Use when asked to "claude review", "claude challenge", "ask claude", or
  "claude consult". Complements /codex (different model = independent opinion).
triggers:
  - claude review
  - claude challenge
  - claude consult
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
---

## Step 0: Detect base branch

```bash
git remote get-url origin 2>/dev/null
gh pr view --json baseRefName -q .baseRefName 2>/dev/null \
  || git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||' \
  || echo "main"
```

Use the result as `<base>` in all subsequent diff commands.

---

## Step 1: Detect mode

Parse the user's input:

1. `/claude review` or `/claude review <focus>` → **Review mode** (Step 2A)
2. `/claude challenge` or `/claude challenge <focus>` → **Challenge mode** (Step 2B)
3. `/claude consult <question>` or `/claude <question>` → **Consult mode** (Step 2C)
4. `/claude` with no args:
   - Check for a diff: `git diff origin/<base> --stat 2>/dev/null | tail -1`
   - If diff exists → offer Review or Challenge via AskUserQuestion
   - Otherwise → Consult mode, ask what the user wants to know

---

## Step 2A: Review Mode

Structured diff review with a PASS/FAIL gate.

### 1. Gather the diff

```bash
git diff origin/<base> 2>/dev/null || git diff <base> 2>/dev/null
```

If the diff is empty, report: "No changes against `<base>`. Nothing to review."

### 2. Read changed files

For every file in the diff, use the Read tool to load its current content.
Cross-reference with the diff to understand the full context of each change.

### 3. Review checklist

Evaluate each changed file against:

- **Correctness** — does the logic match the intent of the change?
- **Edge cases** — null/undefined, empty arrays, off-by-one, concurrent calls
- **Error handling** — are errors caught, surfaced, or silently swallowed?
- **Security** — XSS, injection, exposed secrets, insecure defaults
- **Performance** — N+1 queries, unbounded loops, missing memoization, memory leaks
- **Type safety** — `any` casts that hide real bugs, missing null checks
- **React-specific** — stale closures, missing deps in useEffect, unstable references causing re-render loops
- **Mesh/P2P-specific** — duplicate message handling, ID normalization, channel key alignment, subscription cleanup

### 4. Present findings

Use this format for each finding:

```
[P1] CRITICAL — short title
  File: path/to/file.tsx:line
  Problem: what is wrong
  Impact: what breaks for users
  Fix: concrete suggestion

[P2] WARNING — short title
  File: path/to/file.tsx:line
  Problem: what is wrong
  Impact: what breaks for users
  Fix: concrete suggestion

[P3] NOTE — short title
  File: path/to/file.tsx:line
  Observation: what to consider
```

### 5. Gate verdict

```
GATE: PASS     — no [P1] findings
GATE: FAIL     — N critical finding(s)
```

---

## Step 2B: Challenge (Adversarial) Mode

Hunt for ways the code will fail in production.

### 1. Gather the diff

```bash
git diff origin/<base> 2>/dev/null || git diff <base> 2>/dev/null
```

### 2. Read changed files in full

Use Read on every touched file. Understand what the code does before attacking it.

### 3. Attack vectors to check

Think like a chaos engineer + attacker:

- **Race conditions** — two concurrent calls, out-of-order events, state torn mid-update
- **Retry storms** — what happens if a mesh send fails and retries collide?
- **ID collisions** — are IDs truly unique? What if two peers generate the same one?
- **Channel key drift** — does participant.id drift from the actual channel key across restarts?
- **Message replay** — can a delayed message reinsert itself after deletion?
- **Subscription leaks** — does the cleanup function always fire? What if the component unmounts during an async?
- **localStorage corruption** — what if JSON.parse throws on a malformed stored value?
- **Nostr relay failures** — what if the relay drops mid-handshake? Does the app degrade gracefully?
- **XSS in message content** — is user content ever set as innerHTML or eval'd?
- **Auth bypass** — can a peer spoof another peer's handle or ID?

### 4. Present findings

Same `[P1]` / `[P2]` / `[P3]` format as Review mode, but focus exclusively on failure paths.
No compliments. Every finding must name the exact file and line.

---

## Step 2C: Consult Mode

Answer any question about the codebase with full read access.

### 1. Understand the question

Restate it in one sentence to confirm scope.

### 2. Read relevant files

Use Glob and Grep to find relevant code, then Read to understand it fully.
Trace call chains across files when the question spans multiple layers.

### 3. Answer directly

- Name the file and line number for every claim
- Show the exact code path, not a paraphrase
- If the answer is "this is broken", say so plainly
- If there are multiple valid approaches, list them with tradeoffs

---

## Important Rules

- **Read before you claim.** Never assert what code does without reading it.
- **Name specifics.** File + line number for every finding.
- **No summaries of summaries.** Show the actual code, not a description of it.
- **Connect to user impact.** Every P1/P2 must say what breaks for a real user.
- **Don't fix.** This skill is read-only. Describe the fix but don't apply it (unless the user explicitly asks afterward).

---

## Completion Status

End every run with one of:

- **DONE** — review complete, evidence provided for each finding
- **DONE_WITH_CONCERNS** — completed, but flagging issues the user should resolve before shipping
- **BLOCKED** — cannot complete; state what is missing
