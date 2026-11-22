# Hosting on Netlify

The site is a static site: one `npm run build` produces a `dist/` folder (about 54 MB, 138 files), and that folder is the whole website. No server, database or environment variables are needed.

`netlify.toml` in the project root already tells Netlify how to build it (`npm run build`, publish `dist`, Node 22) and sets caching headers for the art, sounds and fonts.

Pick **one** of the three ways below. Option A is the quickest for a first look; Option C is best if you'll keep making changes.

---

## Option A: drag and drop (2 minutes, no tools)

1. In Terminal, build the site:
   ```bash
   cd "/Users/afifa.nasir/Desktop/Afifas Retirement World Assets/retreat"
   ```
   ```bash
   npm run build
   ```
2. Open https://app.netlify.com/drop and sign in (or create a free account).
3. Drag the **`dist`** folder (inside `retreat/`) onto the page.
4. Netlify uploads it and gives you a link like `https://random-name-123.netlify.app`.
5. Optional: in the site's **Site configuration → Change site name**, rename it (e.g. `afifas-retreat.netlify.app`).

To update later: build again and drag the new `dist` onto the site's **Deploys** tab.

## Option B: Netlify CLI (from Terminal)

1. Build: `npm run build` (as above).
2. Log in once (opens the browser):
   ```bash
   npx netlify-cli login
   ```
3. Preview deploy (gives a draft URL to check):
   ```bash
   npx netlify-cli deploy --dir=dist
   ```
4. When it looks right, publish to the live URL:
   ```bash
   npx netlify-cli deploy --dir=dist --prod
   ```
   The first time, it asks you to create a new site or link an existing one.

## Option C: connect a Git repository (auto-deploys on every change)

1. Put the `retreat/` folder in a GitHub, GitLab or Bitbucket repository. `.gitignore` already leaves out `node_modules`, `dist`, the local `_backup_*` folders and `asset-library`, so the repo stays small.
2. In Netlify: **Add new site → Import an existing project**, pick the repository.
3. Netlify reads `netlify.toml` automatically. Check the settings show **Build command** `npm run build` and **Publish directory** `dist`, then **Deploy**.
4. From then on, every push to the main branch rebuilds and republishes the site.

---

## After deploying: check these

- The title screen loads and "tap anywhere to enter" starts the scene and the sound.
- Day/night and mute buttons work in the nav bar.
- Prayer bubbles: open `https://<your-site>.netlify.app/?prayer=1` (forces prayer time). Without `?prayer=1` the site follows real Bengaluru prayer times.
- Test once in Safari and on a phone.

## Custom domain (optional)

**Domain management → Add a domain** in the site settings. Netlify walks you through pointing your domain's DNS at it and adds HTTPS automatically.
