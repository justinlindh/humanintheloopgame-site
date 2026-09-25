# humanintheloopgame.com

The landing page for [Human in the Loop](https://github.com/justinlindh/human-in-the-loop), an AI-era company sim. The game itself is served from play.humanintheloopgame.com.

Plain static HTML and CSS, no build step. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

`scripts/check.sh` runs the same checks as CI: HTML validation and a check that every local file the pages reference exists.

Pushes to `main` deploy to GitHub Pages. Changes go through pull requests with Conventional Commits titles.

## License

Copyright (c) 2026 Justin Lindh. All rights reserved. See [LICENSE](LICENSE).
