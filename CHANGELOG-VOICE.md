# Writing a changelog day

The page at `changelog/index.html` renders `changelog/entries.json`: one entry per day, newest first. This file is the voice and the format for an entry. A drafter (human or model) follows it; `npm test` enforces the mechanical parts.

## Entry format

The file is a JSON array. One object per day:

```json
{
  "date": "2026-10-05",
  "headline": "Two or three of the day's biggest changes, one line",
  "items": [
    {
      "area": "Decisions",
      "title": "Short, plain title",
      "body": "2 to 5 sentences.",
      "refs": ["#1540"],
      "media": [{ "src": "media/2026-10-05/name.webp", "kind": "image", "caption": "what it shows, a few words" }]
    }
  ]
}
```

- `date` is unique, `YYYY-MM-DD`. `headline` and at least one item are required.
- `area`, `title` and `body` are required strings on every item. `refs` (the 1 to 4 PRs that built it) and `media` are optional.
- `area` is one of the existing values: Art, Behind the scenes, Company, Decisions, Economy, Eras, Fixes, Game speed, Interface, Moments, Office, Pacing, People, Sound, Touch, Yak.
- Stills only, never video (`kind` is `image`). A still is a file under `changelog/media/<date>/` (webp or png, referenced as `media/<date>/<name>`), or an `https://raw.githubusercontent.com/justinlindh/human-in-the-loop/feature-media/<name>.webp|png` link. At most 3 per item, and a still that no item uses fails the test, so do not copy spare ones in.
- Newest day goes first in the array.

## Order and size

- Gameplay changes first: what a player does, sees or decides differently. Then new objects and art. Then one `Fixes` item that groups the small fixes in a few sentences. Tooling, CI, tests, refactors and docs are left out unless a player felt them.
- 3 to 8 items for a busy day, 1 to 3 for a quiet one. A day with nothing a player saw gets one honest item, area `Behind the scenes`, "A quiet day under the hood".
- If something added on the day was removed or replaced the same day, describe the end state. If it was reverted later, still describe it as it was that day.

## Voice

Plain, specific, a friend telling you what the dev did this week. Say what changed for someone playing and what it does. No marketing words (robust, seamless, leverage, enhance), no hype.

- Say "the game now ..." or name the thing ("Staff now ...", "The office ..."). Never "we".
- Game text says "company" or "lab", never "startup", except inside a parody joke.
- No em dashes anywhere: use a comma, a colon or a new sentence.
- No codebase words (module names, "sim", "render", "contract", "snapshot").
- Name a joke when the joke is the point.

## Every new object says what it does

For any new thing in the office (prop, poster, machine, decoration, person's item), the entry says what it is, what it does in the game and what it costs or changes, with the numbers. Take them from `docs/effects/` and `docs/features/` in the game repo, and confirm each figure against `src/sim/balance.js` or `src/data/` at the commit the day shipped (`git show <commit>:<path>`). A figure you cannot confirm is removed, not guessed. Stills of objects come from the art lane's feature-media branch; use a still only when its name clearly shows this item.

## Do not invent

If a PR body does not say what it does for the player, read its diff stat or the docs entry, or leave it out. Wrong media is worse than none.
