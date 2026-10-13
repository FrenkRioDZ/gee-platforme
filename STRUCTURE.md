GEE Plateforme — Structure Mise à Jour
=======================================

gee-plateforme/
├── backend/
│   ├── config/
│   │   └── db.js
│   │
│   ├── models/
│   │   ├── User.js
│   │   ├── Bureau.js
│   │   ├── Project.js
│   │   ├── WeeklyReport.js
│   │   └── Notification.js
│   │
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── bureauController.js
│   │   ├── userController.js
│   │   ├── projectController.js
│   │   ├── weeklyReportController.js
│   │   ├── notificationController.js
│   │   └── dashboardController.js
│   │
│   ├── routes/
│   │   ├── auth.js
│   │   ├── bureaus.js
│   │   ├── users.js
│   │   ├── projects.js
│   │   ├── weeklyReports.js
│   │   ├── notifications.js
│   │   └── dashboard.js
│   │
│   ├── middleware/
│   │   ├── auth.js
│   │   └── validate.js
│   │
│   ├── utils/
│   │   ├── jwt.js
│   │   ├── email.js
│   │   ├── scheduler.js
│   │   └── excelExport.js
│   │
│   ├── .env.example
│   ├── package.json
│   ├── seed.js
│   └── server.js
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    │
    └── src/
        ├── components/
        │   ├── layout/
        │   │   ├── Layout.jsx               ✅ Built
        │   │   ├── Sidebar.jsx              ✅ Built
        │   │   ├── Navbar.jsx               ✅ Built
        │   │   └── NotificationBell.jsx     ✅ Built
        │   │
        │   ├── ui/
        │   │   ├── StatCard.jsx             ✅ Built
        │   │   ├── StatusBadge.jsx          ✅ Built
        │   │   ├── Modal.jsx                🔲 Next steps
        │   │   └── LoadingSpinner.jsx       🔲 Next steps
        │   │
        │   └── reports/
        │       ├── WeeklyReportForm.jsx     🔲 Next step
        │       ├── ObservationModal.jsx     🔲 Next step
        │       └── ReportTimeline.jsx       🔲 Next step
        │
        ├── pages/
        │   ├── Login.jsx                    ✅ Built
        │   ├── GeeDashboard.jsx             ✅ Built  (replaces Dashboard.jsx)
        │   ├── BureauDashboard.jsx          ✅ Built  (replaces Dashboard.jsx)
        │   ├── WeeklyReports.jsx            🔲 Next step
        │   ├── ReportDetail.jsx             🔲 Next step
        │   ├── Projects.jsx                 🔲 Next step
        │   ├── Users.jsx                    🔲 Next step
        │   ├── Bureaus.jsx                  🔲 Next step
        │   └── Settings.jsx                 🔲 Next step
        │
        ├── context/
        │   ├── AuthContext.jsx              ✅ Built
        │   └── NotificationContext.jsx      ✅ Built
        │
        ├── utils/
        │   ├── api.js                       ✅ Built
        │   └── roles.js                     ✅ Built
        │
        ├── locales/
        │   ├── fr.json                      ✅ Built
        │   ├── en.json                      ✅ Built
        │   └── ar.json                      ✅ Built
        │
        ├── App.jsx                          ✅ Built
        ├── main.jsx                         ✅ Built
        ├── index.css                        ✅ Built
        ├── theme.js                         ✅ Built
        └── i18n.js                          ✅ Built


=======================================
NOTES ON CHANGES FROM ORIGINAL STRUCTURE
=======================================

REMOVED (merged or replaced):
- hooks/useAuth.js          → logic lives in AuthContext.jsx
- hooks/useNotifications.js → logic lives in NotificationContext.jsx
- hooks/useReports.js       → inline in pages
- utils/dates.js            → not needed on frontend
- components/ui/Button.jsx  → using MUI Button directly
- components/ui/Table.jsx   → using MUI Table directly
- components/ui/Badge.jsx   → replaced by StatusBadge.jsx
- components/dashboard/     → merged into GeeDashboard + BureauDashboard
- public/index.html         → index.html at frontend/ root (Vite standard)

RENAMED:
- Dashboard.jsx → GeeDashboard.jsx + BureauDashboard.jsx

ADDED:
- components/layout/Layout.jsx
- components/ui/StatCard.jsx
- components/ui/StatusBadge.jsx


=======================================
REMAINING TO BUILD
=======================================

🔲 WeeklyReports.jsx       — report list + filters
🔲 ReportDetail.jsx        — view + accept/reject + observations
🔲 WeeklyReportForm.jsx    — report submission form
🔲 ObservationModal.jsx    — GEE rejection with observation
🔲 Projects.jsx            — project list + create/edit
🔲 Users.jsx               — user management
🔲 Bureaus.jsx             — bureau + cell management
🔲 Settings.jsx            — profile, password, language
🔲 Modal.jsx               — reusable modal wrapper
🔲 LoadingSpinner.jsx      — reusable loader
