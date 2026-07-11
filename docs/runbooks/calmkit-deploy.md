# CalmKit -- Deploy and Verify

**Repo:** https://github.com/TEAMHMC/CalmKit
**Live URL:** https://calmkit.healthmatters.clinic
**Hosting:** GitHub Pages

---

## Prerequisites

- Node 18 or higher (`node --version`)
- Repository cloned and up to date:

```bash
git pull origin main
```

- TypeScript type-check must pass with zero errors before any push:

```bash
npx tsc --noEmit
```

Do not push if `tsc` reports errors. Fix all type errors first.

- Confirm no API keys are present in source files before building:

```bash
grep -r "AIza" src/
# Must return nothing. Any match is a critical security issue -- do not proceed.
```

---

## Build Locally

Install dependencies if not already done:

```bash
npm install
```

Run the production build:

```bash
npm run build
```

The output is written to the `dist/` directory. Review the build output for
warnings. Unexpected large bundle sizes (above 500 KB uncompressed) should be
investigated before deploying.

---

## Deploy

### Automatic Deploy (GitHub Actions)

If the repository has a GitHub Actions workflow configured for GitHub Pages,
push to `main` and the workflow handles the deploy:

```bash
git add .
git commit -m "describe your change here"
git push origin main
```

Monitor the Actions tab at https://github.com/TEAMHMC/CalmKit/actions to
confirm the Pages deploy job completes successfully. A green checkmark
indicates the new version is live. Propagation to the CDN typically takes
1 to 3 minutes.

### Manual Deploy (gh-pages branch)

If GitHub Actions is not configured, deploy manually using the `gh-pages`
package:

```bash
npm run build
npx gh-pages -d dist
```

This pushes the `dist/` contents to the `gh-pages` branch, which GitHub Pages
serves automatically.

---

## Verify

After the deploy completes:

1. Open https://calmkit.healthmatters.clinic in a private browser window to
   avoid cached assets.
2. Confirm the page loads without console errors.
3. Test the Guided Walk flow end to end:
   - Start a Guided Walk session.
   - Confirm step-by-step narration plays or displays correctly.
   - Confirm the walk completes and shows a closing message.
4. Confirm Gemini narration is proxied through the portal API and not called
   directly from the browser. Open the browser Network tab and verify that
   Gemini API requests go to `volunteer.healthmatters.clinic/api/...` and not
   to `generativelanguage.googleapis.com` directly from the client.

---

## Check for API Key Exposure

This check must be run on every deploy. A leaked API key is a P0 security
incident.

```bash
grep -r "AIza" dist/
# Must return nothing.
```

If any match is found:

1. Do not push or deploy.
2. Rotate the exposed key immediately in the Google Cloud Console at
   https://console.cloud.google.com/apis/credentials?project=hmc-prod-473121
3. Update the key value in Secret Manager.
4. Fix the code so the key is accessed only server-side through the portal API.
5. Rebuild and re-verify before attempting deploy again.

---

## Rollback

If a deployed version is broken, revert the last commit and push:

```bash
git revert HEAD
git push origin main
```

This creates a new commit that undoes the previous change and triggers the
GitHub Actions deploy automatically. Do not use `git reset --hard` on a shared
branch.

After rolling back, open a GitHub issue in TEAMHMC/CalmKit describing what
broke and why.
