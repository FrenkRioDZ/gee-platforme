# Audit fixes — 2026-10-19

Each fix is its own commit, so any one can be reverted with `git revert <hash>`.

| # | Issue | Status | Commit |
|---|-------|--------|--------|
| 1 | Plain FTP + open admin ports on the VPS (server-side, no code) | pending | — |
| 2 | Any logged-in user could read any project's last report (`GET /reports/weekly/project/:id/last-values`) | fixed — bureau users limited to lead/participant projects | daf8ac9 |
| 3 | Late/extension reports blocked by cumulative check against a *later* week | fixed — only earlier weeks are compared | see git log |
| 4 | "Missing reports" notification never sent (`report_missing` not in Notification enum) | pending | — |
| 5 | GEE dashboard "pending" counts non-existent statuses | pending | — |
| 6 | Bureau super admins always refused on cell management | pending | — |
| 7 | "Create project" crashes for GEE super admin | pending | — |
| 8 | Bureau super admin can promote a user to bureau super admin via edit | pending | — |
| 9 | Live notifications reach only the last-opened tab | pending | — |
| 10 | Participant bureaus can't see projects they participate in | pending | — |
| 11 | New-report form lists projects without weekly reports (`hasWeeklyReport` vs `weekly` param) | pending | — |
| 12 | No test for week/deadline logic | pending | — |
| 13 | Leftover dead code / duplicates | pending | — |
