# Demo film

`yoru-merge-demo.mp4` — an 11-second tour of the app: 1920×1080, 30 fps, no
sound. Four beats built from real captures of the running app, and an end card:

1. History, and the context menu of a commit.
2. The diff workspace and its single header.
3. Changes and the commit composer.
4. The theme sweep, from Yoru Night to Moonlit Workbench.
5. The mark and the tagline.

## How it is made

`src/` is a [HyperFrames](https://github.com/heygen-com/hyperframes) project
(Apache 2.0): HTML compositions that a paused GSAP timeline drives, rendered to
MP4 frame by frame through headless Chrome and FFmpeg, so the same source always
gives the same film.

- `src/index.html` — the root: the ground and one host per scene.
- `src/compositions/` — one file per scene (`history`, `workspace`, `changes`,
  `end`), each with its own timeline.
- `src/assets/shots/` — the captures, taken from the dev build at twice the
  window's resolution so a punch-in stays sharp.
- `src/assets/fonts/`, `src/assets/logo.png` — the app's own fonts and logo.

The captures show the default identity (dark theme, cyan accent, comfortable
density, 13 px). They include the author name and e-mail the app displays for
each commit.

## Rendering it again

Needs Node.js 22+ and FFmpeg.

```bash
cd docs/video/src
DO_NOT_TRACK=1 npx hyperframes@0.9.40 check     # lint, layout, motion, contrast
DO_NOT_TRACK=1 npx hyperframes@0.9.40 render    # writes renders/*.mp4
```

Two things the CLI does that are worth knowing before running it:

- It sends usage telemetry unless `DO_NOT_TRACK=1` is set; `npx hyperframes
  telemetry disable` turns it off for good.
- `npx hyperframes init` — not needed here, the project already exists —
  installs its agent skills into the user's home folder.

The committed film is the render re-encoded for size:

```bash
ffmpeg -i renders/<file>.mp4 -c:v libx264 -preset slow -crf 22 \
  -pix_fmt yuv420p -movflags +faststart -an ../yoru-merge-demo.mp4
```

## Retaking the captures

After a change to the interface the captures go stale. Run the dev build with
its WebView debug port open and take them over the Chrome DevTools Protocol:

```bash
WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222 pnpm tauri dev
```

`Page.captureScreenshot` with `clip.scale: 2` gives the 3840-wide frames, and
it leaves an open context menu open. The dev build shares its preferences with
the installed app: put back any theme, accent or density changed for a capture.
