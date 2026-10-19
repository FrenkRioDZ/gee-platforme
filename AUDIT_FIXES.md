# Audit fixes — 2026-10-19

Each fix is its own commit, so any one can be reverted with `git revert <hash>`.

| # | Issue | Status | Commit |
|---|-------|--------|--------|
| 1 | Plain FTP + open admin ports on the VPS (server-side, no code) | pending | — |
| 2 | Any logged-in user could read any project's last report (`GET /reports/weekly/project/:id/last-values`) | fixed — bureau users limited to lead/participant projects | daf8ac9 |
| 3 | Late/extension reports blocked by cumulative check against a *later* week | fixed — only earlier weeks are compared | 12418e3 |
| 4 | "Missing reports" notification never sent (`report_missing` not in Notification enum) | fixed — type added | 7514620 |
| 5 | GEE dashboard "pending" counts non-existent statuses | fixed — counts submitted + bureau_approved | 80aa5a1 |
| 6 | Bureau super admins always refused on cell management | fixed — compare bureau._id | bb16a5c |
| 7 | "Create project" crashes for GEE super admin | fixed — create route is bureau super admin only (UI already hid it from GEE) | dc8fc89 |
| 8 | Bureau super admin can promote a user to bureau super admin via edit | fixed — same rule as user creation | 288bdc1 |
| 9 | Live notifications reach only the last-opened tab | fixed — one socket.io room per user | 42ad659 |
| 10 | Participant bureaus can't see projects they participate in | fixed — project list and detail include participant projects | e07d5ce |
| 11 | New-report form lists projects without weekly reports (`hasWeeklyReport` vs `weekly` param) | fixed — form sends weekly=true | 297f6b5 |
| 12 | No test for week/deadline logic | fixed — `backend/tests/week.test.js`, run with `npm test` in backend | d7db7c6 |
| 13 | Leftover dead code / duplicates | fixed — removed duplicate 429 block, unused canvas query, debug logs; one validatePassword; clear geeReviewedBy/At on redraft | 3f5d844 |

**Deployed to production 2026-10-19** (archive `gee_deploy_20261019.tar.gz`, backup `/var/www/gee_backup_20261019` + `/root/mongo_backups/pre_deploy_20261019.gz`). Health check and socket.io handshake verified after restart.
