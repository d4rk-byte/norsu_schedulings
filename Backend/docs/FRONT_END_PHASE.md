es, it's absolutely possible to migrate this frontend to Next.js.
This project already has a partial API layer (JWT auth + faculty API endpoints), and Symfony can serve purely as a backend API. Here's what the migration involves:

Current State Summary
Aspect	Details
Templates	~94 Twig files
User Roles	3 roles: Admin, Department Head, Faculty
Pages	~50+ unique pages across all roles
Auth	JWT (already exists for API) + Session-based (Twig)
API	Partial — only Faculty endpoints + login exist
Styling	Tailwind CSS (transfers directly to Next.js)
PDF Exports	5+ PDF generation services (server-side)
Forms	13 Symfony form types
Migration Plan
Phase 0: Prepare the Symfony Backend as a Full API
The biggest gap: Only /api/login and /api/faculty/* endpoints exist as JSON APIs. You need API endpoints for everything — admin CRUD, department head operations, schedules, reports, etc.

Tasks:

Create API controllers for Admin operations (colleges, departments, subjects, rooms, users, curricula, academic years, schedules, settings, reports, department groups, activity logs)
Create API controllers for Department Head operations (faculty management, schedules, rooms, curricula, reports, settings)
Ensure all endpoints return JSON and accept JSON input
Keep PDF export endpoints as-is (they return file downloads)
Add proper API error responses and validation

Phase 1: Next.js Project Setup
Initialize Next.js project (App Router, TypeScript)
Configure Tailwind CSS (reuse existing tailwind.config.js — it transfers directly)
Set up JWT authentication (store token, refresh logic, protected routes)
Set up API client (Axios/fetch wrapper pointing to Symfony backend)
Create role-based middleware (Admin, Department Head, Faculty route guards)

Phase 2: Shared Components & Layouts
Base layout with navigation (per role)
Reusable UI components: tables, forms, modals, alerts, pagination, search bars
Error pages (403, 404, 500)
Profile modal component
Login & registration pages

Phase 3: Admin Module (~20 pages)

Dashboard (with stats cards, charts, recent activities)
Colleges CRUD (list, create, edit, view, bulk actions)
Departments CRUD
Subjects CRUD
Rooms CRUD (with history)
Users management (faculty, department heads, admins, all, invalid roles)
Academic years management
Curricula management (with subject assignment)
Schedule management (create, edit, conflict detection, faculty loading)
Department groups
Reports (faculty workload, room utilization) — PDF download buttons
System settings
Activity log viewer

Phase 4: Department Head Module (~15 pages)

Dashboard
Faculty management (list, create, edit, view, activate/deactivate)
Schedule management
Room management
Curricula viewer
Faculty assignments
Reports
Department settings

Phase 5: Faculty Module (~6 pages)

Dashboard
Schedule viewer + PDF export
Classes list
Performance metrics
Office hours management
Profile

Phase 6: Testing & Polish

End-to-end testing
Responsive design verification
PDF export integration testing
Role-based access testing
CORS configuration between Next.js and Symfony
Architecture
What Transfers Easily
Tailwind config — copy directly
Color scheme & design — recreate with same CSS classes
JWT auth — already implemented
Faculty API — already 
┌─────────────────┐         ┌─────────────────────┐
│   Next.js App   │  JSON   │   Symfony Backend    │
│   (Frontend)    │ ◄─────► │   (API Only)         │
│                 │  JWT    │                       │
│ - Pages/Routes  │         │ - API Controllers     │
│ - Components    │         │ - Services            │
│ - Auth Context  │         │ - Entities/Repos      │
│ - Tailwind CSS  │         │ - PDF Generation      │
│ - State Mgmt    │         │ - Schedule Conflicts   │
└─────────────────┘         └─────────────────────┘

Business logic — stays in Symfony services (untouched)
What Needs Significant Work
~60+ new API endpoints for Admin & Department Head operations
~40+ Next.js pages to rebuild from Twig
Form validation — move from Symfony Forms to client-side + API validation
CSRF protection — replaced by JWT for API calls
PDF exports — keep as Symfony endpoints, Next.js just triggers downloads
Estimated Scope
Phase 0 (API build-out): Largest effort — ~60 new endpoints
Phases 1-5 (Next.js frontend): ~40-50 pages + components
Total: A substantial project, but very doable