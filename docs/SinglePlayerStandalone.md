# Publishing a story on your own website

**Export for web** on the landing page (next to **Export**) downloads `<story>-web.zip`: the whole game as plain files that any web host can serve. No server, database or login is needed to play it.

## What is in the zip

```
index.html      the player (SinglePlayer)
player/         its scripts and styles
play.json       the story's name, author, description and file list (never its password)
data/  types/   the story's source and images, loaded by the player as it goes
tsconfig.json   not needed to play; kept so the folder is also a valid story export
```

## Putting it online

1. Unzip it.
2. Upload the **whole folder** (all of the above, keeping the structure) to your web host: an existing site's subfolder, GitHub Pages, Netlify, an S3 bucket, a plain nginx or Apache, …
3. Open `index.html` through its web address, e.g. `https://example.com/my-story/` or `https://example.com/my-story/index.html`. Share that link.

The player finds `play.json`, `data/` and `types/` next to the page (relative to the page's address), so the folder can be renamed or moved anywhere.

## Things to know

- **It must be served over `http://` or `https://`.** Double-clicking `index.html` opens it as `file://`, where browsers block the page from loading its files; the player then says so. To try it locally, serve the folder with any static server, e.g. `npx serve .` or `python3 -m http.server` inside it, and open the printed address.
- **Any static host works**: there is no server code, no rewrites, no special headers. `.ts` files are fetched as text, so their content type does not matter.
- **Content-Security-Policy**: the player compiles the story's TypeScript in the browser and runs it with `new Function`. If your host sends a CSP header, its `script-src` must allow `'self'` and `'unsafe-eval'`; `style-src` must allow `'unsafe-inline'` (the UI injects its styles at run time). Allow `https://fonts.googleapis.com` in `style-src` and `https://fonts.gstatic.com` in `font-src` too, or the player falls back to a system font. Without a CSP header nothing needs to be done.
- **Saves** live in the player's browser (`localStorage`), per site: a player continues where they left off on the same address.
- **Updating**: export again and replace the uploaded folder. A save from an older version may not fit a changed story; players can start a new game from the landing screen.
- The export is a snapshot: later edits in the Visualizer do not reach it, and a private story's password does not protect it (anyone with the link can play, and the story's source is readable).

## For server operators

The server builds the zip from the standalone player in the folder `SINGLE_PLAYER_STANDALONE_DIR` (default `clients/SinglePlayer/dist-standalone`). Build it with `yarn workspace @story/single-player build:standalone` (also part of `yarn build`); the production image builds it and sets the variable. Until it is built, **Export for web** answers `503 unavailable` with a message saying so. The route is `GET /api/stories/:storyId/export/web` (`exportPlayable`) and needs the same access as **Export**: a public story, or the story's password.
