# humanintheloopgame.com

The landing page for [Human in the Loop](https://github.com/justinlindh/human-in-the-loop), an AI-era company sim. The game itself is served from play.humanintheloopgame.com.

Plain static HTML and CSS, no build step. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

`npm ci` installs the check dependencies. `scripts/check.sh` runs the same checks as CI: regression tests, HTML validation, and deployed-file checks. It recreates `_site` with `scripts/stage-site.sh`, the shared Pages allowlist, and Pages uploads that checked directory.

The checker reads the deployed pages, their scripts and stylesheets. It checks `src`, `href`, `poster`, every `srcset` candidate, CSS URLs, lazy and wide media attributes, script-assigned media, module imports and `fetch()` URLs. Local URLs resolve relative to the document (or stylesheet/module for their dependencies), including root paths and URL encoding; external URLs and fragments are skipped. Script URLs must resolve statically from strings, constants, alternatives or page data attributes. An unresolved fetch or media assignment fails the check instead of silently skipping it. `npm test` runs the checker regression tests.

Pushes to `main` deploy to GitHub Pages. Changes go through pull requests with Conventional Commits titles.

## License

Copyright (c) 2026 Justin Lindh. All rights reserved. See [LICENSE](LICENSE).
