# Check-Yourself Screener -- Deploy and Clinical Verification

**Repo:** https://github.com/TEAMHMC/Check-Yourself
**Live URL:** https://check-yourself.healthmatters.clinic (or GitHub Pages URL)
**Hosting:** GitHub Pages

---

## CRITICAL: Clinical Scoring Integrity

The scoring thresholds in this tool are clinically validated. They must never
be changed without explicit citation of the source literature.

- **GAD-7 thresholds:** cite Spitzer RL, Kroenke K, Williams JBW, Lowe B.
  A brief measure for assessing generalized anxiety disorder. Arch Intern Med.
  2006;166(10):1092-1097.
- **PHQ-9 thresholds:** cite Kroenke K, Spitzer RL, Williams JBW. The PHQ-9:
  validity of a brief depression severity measure. J Gen Intern Med.
  2001;16(9):606-613.

Any pull request that modifies scoring logic must include the citation in the
PR description. Any deploy that changes scoring output without citation must be
rolled back immediately as a P0 incident.

---

## Prerequisites

- Node 18 or higher (`node --version`)
- Repository cloned and up to date:

```bash
git pull origin main
```

- TypeScript type-check must pass with zero errors:

```bash
npx tsc --noEmit
```

- Build must succeed:

```bash
npm run build
```

Do not push if either command exits with an error.

---

## Deploy

Push to `main` to trigger the GitHub Actions deploy to GitHub Pages:

```bash
git add .
git commit -m "describe your change here"
git push origin main
```

Monitor the Actions tab at https://github.com/TEAMHMC/Check-Yourself/actions.
Wait for the Pages deploy job to show a green checkmark before running the
clinical verification checklist. Propagation typically takes 1 to 3 minutes.

---

## Post-Deploy Clinical Verification Checklist

Run this checklist after every deploy, without exception. A wrong clinical
label is a patient safety issue.

Open the live screener URL in a private browser window to avoid cached assets.

### GAD-7 Verification

| Score Range | Expected Label |
|---|---|
| 0 to 4 | Minimal Anxiety |
| 5 to 9 | Mild Anxiety |
| 10 to 14 | Moderate Anxiety |
| 15 to 21 | Severe Anxiety |

Enter a representative score from each range and confirm the label matches
exactly. The label for scores 10 to 14 must read "Moderate Anxiety" and must
NOT read "Moderately Severe" -- that label belongs to PHQ-9, not GAD-7. A
previous incident introduced this error; verify explicitly on every deploy.

### PHQ-9 Verification

| Score Range | Expected Label |
|---|---|
| 0 to 4 | Minimal Depression |
| 5 to 9 | Mild Depression |
| 10 to 14 | Moderate Depression |
| 15 to 19 | Moderately Severe Depression |
| 20 to 27 | Severe Depression |

Enter a score between 15 and 19 and confirm the label reads
"Moderately Severe Depression."

### Sign-Off

After passing all checks, add a comment to the deployment commit or PR:

```
Clinical verification passed: GAD-7 and PHQ-9 labels confirmed correct.
Verified by: [your name], [date]
```

---

## If Clinical Output Is Wrong

1. Roll back immediately -- do not attempt a hotfix on the live branch first:

```bash
git revert HEAD
git push origin main
```

2. Confirm the rollback deploy completes and the correct labels appear on the
   live URL.
3. Open a P0 issue in TEAMHMC/Check-Yourself titled:
   `[P0] Clinical scoring error -- [screener name] [date]`
4. Label it `clinical-integrity` and `p0`.
5. Notify Erica Robinson at erica@healthmatters.clinic immediately.
6. Do not re-deploy the reverted code until the scoring logic has been reviewed
   against the cited literature and a second person has verified the fix.

---

## Rollback

```bash
git revert HEAD
git push origin main
```

This creates a new commit that undoes the previous change and triggers an
automatic GitHub Actions deploy. Confirm the Pages deploy completes, then run
the full clinical verification checklist on the rolled-back version.
