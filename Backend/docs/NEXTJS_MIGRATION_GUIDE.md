# Next.js Frontend Migration Guide

## Smart Scheduling System — Twig to Next.js

> **Project**: NORSU Smart Scheduling System  
> **Backend**: Symfony 6 (PHP) — remains as API server  
> **New Frontend**: Next.js (App Router, TypeScript)  
> **Date Created**: March 9, 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Current System Summary](#2-current-system-summary)
3. [Architecture](#3-architecture)
4. [Phase 0 — Symfony API Build-Out](#4-phase-0--symfony-api-build-out)
5. [Phase 1 — Next.js Project Setup](#5-phase-1--nextjs-project-setup)
6. [Phase 2 — Shared Components & Layouts](#6-phase-2--shared-components--layouts)
7. [Phase 3 — Admin Module](#7-phase-3--admin-module)
8. [Phase 4 — Department Head Module](#8-phase-4--department-head-module)
9. [Phase 5 — Faculty Module](#9-phase-5--faculty-module)
10. [Phase 6 — Testing & Polish](#10-phase-6--testing--polish)
11. [Entity Reference](#11-entity-reference)
12. [API Endpoint Reference](#12-api-endpoint-reference)
13. [Authentication & Roles](#13-authentication--roles)
14. [Design System Reference](#14-design-system-reference)
15. [File & Folder Structure](#15-file--folder-structure)

---

## 1. Overview

### What We're Doing

Migrating the **Twig-based server-rendered frontend** to a **Next.js single-page application** while keeping the Symfony backend as a **REST API server**.

### Why

- Modern, reactive UI with client-side routing
- Better developer experience (TypeScript, component reuse)
- Separation of concerns (frontend/backend decoupled)
- Easier to maintain and scale independently

### What Stays the Same

- Symfony backend (entities, services, business logic, database)
- MySQL database and all migrations
- JWT authentication (already implemented)
- PDF export services (called via API, return file downloads)
- All business rules (conflict detection, validation, etc.)

### What Changes

| Before (Twig) | After (Next.js) |
|---|---|
| Server-rendered HTML via Twig | Client-rendered React components |
| Symfony Forms (server-side) | React Hook Form (client-side) + API validation |
| Session-based auth (main firewall) | JWT-only auth (API firewall) |
| CSRF tokens | JWT Authorization header |
| Symfony routing for pages | Next.js App Router |
| Inline Twig JS + Stimulus.js | React state + hooks |

---

## 2. Current System Summary

### Templates: ~94 Twig Files

| Section | Template Count | Description |
|---|---|---|
| Admin | ~40 | Dashboard, CRUD pages, reports, settings |
| Department Head | ~20 | Dashboard, faculty/schedule/room management |
| Faculty | ~8 | Dashboard, schedule, classes, profile |
| Security | 3 | Login, register, base layout |
| Profile | 3 | View, edit, change password |
| Home | 1 | Landing/redirect page |
| Error Pages | 4 | 403, 404, 500, generic |
| Components | 2 | Profile modal, alerts |
| Base Layouts | 4 | Main, admin, faculty, dept head |

### Controllers: 11 Total

| Controller | Prefix | Role Required |
|---|---|---|
| SecurityController | `/` | PUBLIC |
| HomeController | `/` | Authenticated |
| ProfileController | `/profile` | Authenticated |
| AdminController | `/admin` | ROLE_ADMIN |
| FacultyController | `/faculty` | ROLE_FACULTY |
| DepartmentHeadController | `/department-head` | ROLE_DEPARTMENT_HEAD |
| ScheduleController | `/admin/schedule` | ROLE_ADMIN |
| DepartmentGroupController | `/admin/department-groups` | ROLE_ADMIN |
| HealthController | `/health` | PUBLIC |
| ApiLoginController | `/api/login` | PUBLIC |
| ApiFacultyController | `/api/faculty` | ROLE_FACULTY |

### Existing API Endpoints (already JSON)

- `POST /api/login` — JWT authentication
- `GET/PUT /api/faculty/profile` — Faculty profile
- `GET /api/faculty/dashboard` — Faculty dashboard data
- `GET /api/faculty/schedule` — Faculty schedules
- `GET /api/faculty/schedule/weekly` — Weekly schedule view
- `GET /api/faculty/schedule/export-pdf` — PDF export
- `GET /api/faculty/classes` — Faculty classes
- `GET /api/faculty/notifications` — Notifications
- `POST /api/faculty/notifications/{id}/read` — Mark notification read
- `POST /api/faculty/notifications/read-all` — Mark all read
- `DELETE /api/faculty/notifications/{id}` — Delete notification
- `GET /api/faculty/notifications/unread-count` — Unread count

### Services: 22+

All business logic stays in Symfony. Key services:
- `UserService`, `DashboardService`, `CollegeService`, `DepartmentService`
- `SubjectService`, `RoomService`, `ScheduleConflictDetector`
- `ActivityLogService`, `NotificationService`, `SystemSettingsService`
- `CurriculumService`, `CurriculumTermService`, `CurriculumSubjectService`
- `CurriculumUploadService`, `DepartmentHeadService`, `DepartmentGroupService`
- `TeachingLoadPdfService`, `FacultyReportPdfService`, `RoomSchedulePdfService`
- `RoomsReportPdfService`, `SubjectsReportPdfService`, `AcademicYearService`

---

## 3. Architecture

```
┌──────────────────────────┐          ┌──────────────────────────┐
│      Next.js App         │          │    Symfony Backend        │
│      (Frontend)          │  JSON    │    (API Only)             │
│                          │ ◄──────► │                           │
│  - App Router pages      │  JWT     │  - API Controllers        │
│  - React components      │  Auth    │  - Entity/Repository      │
│  - Tailwind CSS          │          │  - Services (biz logic)   │
│  - Auth context/hooks    │          │  - PDF Generation         │
│  - Client-side forms     │          │  - Schedule Conflicts     │
│  - State management      │          │  - Notifications          │
│                          │          │  - Activity Logging        │
│  Port: 3000              │          │  Port: 8000               │
└──────────────────────────┘          └──────────────────────────┘
                                               │
                                      ┌────────┴────────┐
                                      │   MySQL 8.0     │
                                      │  Port: 3306     │
                                      └─────────────────┘
```

### Communication Rules

1. **All frontend ↔ backend communication is via JSON REST API**
2. **Authentication**: JWT token in `Authorization: Bearer <token>` header
3. **PDF exports**: API returns file blob, frontend triggers download
4. **CORS**: Already configured to allow all origins on `/api/*`
5. **Validation**: Client-side for UX + server-side API validation for security

---

## 4. Phase 0 — Symfony API Build-Out

> **Goal**: Create all missing API endpoints so the Next.js frontend has data sources for every page.

### 4.1 API Authentication (Already Done)

- `POST /api/login` — Returns JWT token ✅
- JWT TTL: 86400 seconds (24 hours)
- User identifier claim: `email`

### 4.2 New API Endpoints Needed

#### Admin API (`/api/admin/*`) — Requires ROLE_ADMIN

**Dashboard**
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/dashboard` | Dashboard stats (counts, recent activities) |
| GET | `/api/admin/activities` | Paginated activity logs |

**Colleges**
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/colleges` | List all colleges (with pagination, search) |
| POST | `/api/admin/colleges` | Create college |
| GET | `/api/admin/colleges/{id}` | Get college details |
| PUT | `/api/admin/colleges/{id}` | Update college |
| DELETE | `/api/admin/colleges/{id}` | Delete college |
| POST | `/api/admin/colleges/{id}/activate` | Activate college |
| POST | `/api/admin/colleges/{id}/deactivate` | Deactivate college |
| POST | `/api/admin/colleges/bulk-action` | Bulk actions |

**Departments**
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/departments` | List departments |
| POST | `/api/admin/departments` | Create department |
| GET | `/api/admin/departments/{id}` | Get department |
| PUT | `/api/admin/departments/{id}` | Update department |
| DELETE | `/api/admin/departments/{id}` | Delete department |

**Subjects**
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/subjects` | List subjects |
| POST | `/api/admin/subjects` | Create subject |
| GET | `/api/admin/subjects/{id}` | Get subject |
| PUT | `/api/admin/subjects/{id}` | Update subject |
| DELETE | `/api/admin/subjects/{id}` | Delete subject |

**Rooms**
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/rooms` | List rooms |
| POST | `/api/admin/rooms` | Create room |
| GET | `/api/admin/rooms/{id}` | Get room (with history) |
| PUT | `/api/admin/rooms/{id}` | Update room |
| DELETE | `/api/admin/rooms/{id}` | Delete room |

**Users**
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/users` | List users (filter by role) |
| POST | `/api/admin/users` | Create user |
| GET | `/api/admin/users/{id}` | Get user details |
| PUT | `/api/admin/users/{id}` | Update user |
| DELETE | `/api/admin/users/{id}` | Delete user |
| POST | `/api/admin/users/{id}/activate` | Activate user |
| POST | `/api/admin/users/{id}/deactivate` | Deactivate user |
| GET | `/api/admin/users/invalid-roles` | Users with invalid roles |
| GET | `/api/admin/users/faculty-history` | Faculty assignment history |

**Academic Years**
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/academic-years` | List academic years |
| POST | `/api/admin/academic-years` | Create academic year |
| GET | `/api/admin/academic-years/{id}` | Get academic year |
| PUT | `/api/admin/academic-years/{id}` | Update academic year |
| DELETE | `/api/admin/academic-years/{id}` | Delete academic year |
| POST | `/api/admin/academic-years/{id}/set-current` | Set as current |

**Curricula**
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/curricula` | List curricula |
| POST | `/api/admin/curricula` | Create curriculum |
| GET | `/api/admin/curricula/{id}` | Get curriculum with terms/subjects |
| PUT | `/api/admin/curricula/{id}` | Update curriculum |
| DELETE | `/api/admin/curricula/{id}` | Delete curriculum |
| POST | `/api/admin/curricula/{id}/terms` | Add term |
| POST | `/api/admin/curricula/{id}/terms/{termId}/subjects` | Add subject to term |
| DELETE | `/api/admin/curricula/{id}/terms/{termId}` | Remove term |

**Schedules**
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/schedules` | List schedules (filter by dept, room, semester) |
| POST | `/api/admin/schedules` | Create schedule |
| GET | `/api/admin/schedules/{id}` | Get schedule details |
| PUT | `/api/admin/schedules/{id}` | Update schedule |
| DELETE | `/api/admin/schedules/{id}` | Delete schedule |
| POST | `/api/admin/schedules/check-conflict` | Check for conflicts |
| GET | `/api/admin/schedules/faculty-loading` | Faculty loading view |

**Department Groups**
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/department-groups` | List groups |
| POST | `/api/admin/department-groups` | Create group |
| PUT | `/api/admin/department-groups/{id}` | Update group |
| DELETE | `/api/admin/department-groups/{id}` | Delete group |
| POST | `/api/admin/department-groups/{id}/assign` | Assign department |

**Reports**
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/reports/faculty-workload` | Faculty workload data (JSON) |
| GET | `/api/admin/reports/faculty-workload/pdf` | Faculty workload PDF |
| GET | `/api/admin/reports/room-utilization` | Room utilization data (JSON) |
| GET | `/api/admin/reports/room-utilization/pdf` | Room utilization PDF |

**Settings**
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/settings` | Get system settings |
| PUT | `/api/admin/settings` | Update system settings |

#### Department Head API (`/api/department-head/*`) — Requires ROLE_DEPARTMENT_HEAD

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/department-head/dashboard` | Dashboard data |
| GET | `/api/department-head/department-info` | Department details |
| GET | `/api/department-head/faculty` | Faculty in department |
| POST | `/api/department-head/faculty` | Create faculty |
| GET | `/api/department-head/faculty/{id}` | Get faculty details |
| PUT | `/api/department-head/faculty/{id}` | Update faculty |
| DELETE | `/api/department-head/faculty/{id}` | Delete faculty |
| POST | `/api/department-head/faculty/{id}/activate` | Activate |
| POST | `/api/department-head/faculty/{id}/deactivate` | Deactivate |
| GET | `/api/department-head/schedules` | Department schedules |
| POST | `/api/department-head/schedules` | Create schedule |
| GET | `/api/department-head/schedules/{id}` | Get schedule |
| PUT | `/api/department-head/schedules/{id}` | Update schedule |
| GET | `/api/department-head/rooms` | Department rooms |
| POST | `/api/department-head/rooms` | Create room |
| GET | `/api/department-head/rooms/{id}` | Get room |
| PUT | `/api/department-head/rooms/{id}` | Update room |
| GET | `/api/department-head/curricula` | Department curricula |
| GET | `/api/department-head/curricula/{id}` | Get curriculum |
| GET | `/api/department-head/faculty-assignments` | Faculty assignments |
| GET | `/api/department-head/reports/faculty-workload` | Workload data |
| GET | `/api/department-head/reports/room-utilization` | Room util data |
| GET | `/api/department-head/settings` | Department settings |

### 4.3 API Response Format Convention

All API responses should follow this format:

```json
// Success (single item)
{
  "success": true,
  "data": { ... }
}

// Success (list with pagination)
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}

// Error
{
  "success": false,
  "error": {
    "code": 422,
    "message": "Validation failed",
    "details": {
      "name": "Name is required",
      "code": "Code must be unique"
    }
  }
}
```

### 4.4 Access Control for New API Endpoints

Update `config/packages/security.yaml`:

```yaml
access_control:
    - { path: ^/api/login, roles: PUBLIC_ACCESS }
    - { path: ^/api/admin, roles: ROLE_ADMIN }
    - { path: ^/api/department-head, roles: ROLE_DEPARTMENT_HEAD }
    - { path: ^/api/faculty, roles: ROLE_FACULTY }
    - { path: ^/api, roles: IS_AUTHENTICATED_FULLY }
```

---

## 5. Phase 1 — Next.js Project Setup

### 5.1 Initialize Project

```bash
npx create-next-app@latest scheduling-frontend --typescript --tailwind --eslint --app --src-dir
```

### 5.2 Install Dependencies

```bash
npm install axios
npm install js-cookie
npm install react-hook-form @hookform/resolvers zod
npm install @tanstack/react-query
npm install lucide-react
npm install date-fns
npm install react-hot-toast
```

| Package | Purpose |
|---|---|
| `axios` | HTTP client for API calls |
| `js-cookie` | JWT token storage in cookies |
| `react-hook-form` + `zod` | Form handling + validation |
| `@tanstack/react-query` | Server state management, caching |
| `lucide-react` | Icon library |
| `date-fns` | Date formatting/manipulation |
| `react-hot-toast` | Toast notifications |

### 5.3 Tailwind Configuration

Copy the existing theme directly from the Symfony project:

```js
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        schedule: {
          available: '#10b981',
          booked: '#ef4444',
          pending: '#f59e0b',
          blocked: '#6b7280',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      gridTemplateColumns: {
        schedule: 'auto repeat(7, 1fr)',
        'time-slots': 'auto repeat(auto-fit, minmax(100px, 1fr))',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}

export default config
```

### 5.4 Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### 5.5 API Client Setup

Create `src/lib/api.ts`:

```typescript
import axios from 'axios'
import Cookies from 'js-cookie'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = Cookies.get('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 — redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
```

### 5.6 Auth Context

Create `src/contexts/AuthContext.tsx`:

```typescript
// Manages JWT token, user data, login/logout, role checking
// Key exports:
//   useAuth() — hook returning { user, login, logout, isAdmin, isDeptHead, isFaculty }
//   AuthProvider — context provider wrapping app
```

### 5.7 Route Middleware

Create `src/middleware.ts` — Next.js middleware for:
- Redirect unauthenticated users to `/login`
- Redirect users by role to their dashboard
- Protect `/admin/*` routes for ROLE_ADMIN only
- Protect `/department-head/*` routes for ROLE_DEPARTMENT_HEAD only
- Protect `/faculty/*` routes for ROLE_FACULTY only

---

## 6. Phase 2 — Shared Components & Layouts

### 6.1 Layouts (one per role)

| Layout | Path | Features |
|---|---|---|
| Auth Layout | `src/app/(auth)/layout.tsx` | Centered card, no sidebar |
| Admin Layout | `src/app/(admin)/layout.tsx` | Sidebar nav, header, breadcrumbs |
| Dept Head Layout | `src/app/(department-head)/layout.tsx` | Sidebar nav, header |
| Faculty Layout | `src/app/(faculty)/layout.tsx` | Sidebar nav, header |

### 6.2 Reusable UI Components

Create in `src/components/ui/`:

| Component | Purpose |
|---|---|
| `Button.tsx` | Primary, secondary, danger, ghost variants |
| `Input.tsx` | Form input with label and error state |
| `Select.tsx` | Dropdown select |
| `Modal.tsx` | Dialog modal |
| `Table.tsx` | Data table with sorting, pagination |
| `Card.tsx` | Content card |
| `Badge.tsx` | Status badges |
| `Alert.tsx` | Success, error, warning, info alerts |
| `Pagination.tsx` | Page navigation |
| `SearchBar.tsx` | Search input with debounce |
| `ConfirmDialog.tsx` | Confirm before delete/action |
| `LoadingSpinner.tsx` | Loading indicator |
| `EmptyState.tsx` | Empty list placeholder |
| `Breadcrumbs.tsx` | Navigation breadcrumbs |
| `StatsCard.tsx` | Dashboard statistics card |

### 6.3 Form Components

Create in `src/components/forms/`:

| Component | Maps to Symfony Form |
|---|---|
| `CollegeForm.tsx` | CollegeFormType |
| `DepartmentForm.tsx` | DepartmentFormType |
| `SubjectForm.tsx` | SubjectFormType |
| `RoomForm.tsx` | RoomFormType |
| `UserForm.tsx` | UserFormType / UserEditFormType |
| `AcademicYearForm.tsx` | AcademicYearFormType |
| `CurriculumForm.tsx` | CurriculumFormType |
| `ScheduleForm.tsx` | (inline in admin controller) |
| `ProfileForm.tsx` | ProfileType / FacultyProfileFormType |

---

## 7. Phase 3 — Admin Module

### Route Group: `src/app/(admin)/admin/`

| Page | Route | Twig Equivalent |
|---|---|---|
| Dashboard | `/admin/dashboard` | `admin/dashboard.html.twig` |
| Activity Logs | `/admin/activities` | `admin/activities.html.twig` |
| **Colleges** | | |
| List | `/admin/colleges` | `admin/colleges.html.twig` |
| Create | `/admin/colleges/create` | `admin/colleges/create.html.twig` |
| Edit | `/admin/colleges/[id]/edit` | `admin/colleges/edit.html.twig` |
| View | `/admin/colleges/[id]` | `admin/colleges/view.html.twig` |
| **Departments** | | |
| List | `/admin/departments` | `admin/departments.html.twig` |
| Create | `/admin/departments/create` | `admin/departments/create.html.twig` |
| Edit | `/admin/departments/[id]/edit` | `admin/departments/edit.html.twig` |
| View | `/admin/departments/[id]` | `admin/departments/view.html.twig` |
| **Subjects** | | |
| List | `/admin/subjects` | `admin/subjects.html.twig` |
| Create | `/admin/subjects/create` | `admin/subjects/create.html.twig` |
| Edit | `/admin/subjects/[id]/edit` | `admin/subjects/edit.html.twig` |
| View | `/admin/subjects/[id]` | `admin/subjects/view.html.twig` |
| **Rooms** | | |
| List | `/admin/rooms` | `admin/rooms.html.twig` |
| Create | `/admin/rooms/create` | `admin/rooms/create.html.twig` |
| Edit | `/admin/rooms/[id]/edit` | `admin/rooms/edit.html.twig` |
| View | `/admin/rooms/[id]` | `admin/rooms/view.html.twig` |
| **Users** | | |
| All Users | `/admin/users` | `admin/users/all.html.twig` |
| Faculty | `/admin/users/faculty` | `admin/users/faculty.html.twig` |
| Dept Heads | `/admin/users/department-heads` | `admin/users/department_heads.html.twig` |
| Admins | `/admin/users/administrators` | `admin/users/administrators.html.twig` |
| Create | `/admin/users/create` | `admin/users/create.html.twig` |
| Edit | `/admin/users/[id]/edit` | `admin/users/edit.html.twig` |
| View | `/admin/users/[id]` | `admin/users/view.html.twig` |
| Invalid Roles | `/admin/users/invalid-roles` | `admin/users/invalid_roles.html.twig` |
| Faculty History | `/admin/users/faculty-history` | `admin/users/faculty_history.html.twig` |
| **Academic Years** | | |
| List | `/admin/academic-years` | `admin/academic_years.html.twig` |
| Create/Edit | `/admin/academic-years/[id?]` | `admin/academic_years/form.html.twig` |
| **Curricula** | | |
| List | `/admin/curricula` | `admin/curricula.html.twig` |
| Create | `/admin/curricula/create` | `admin/curricula/create.html.twig` |
| Edit | `/admin/curricula/[id]/edit` | `admin/curricula/edit.html.twig` |
| View | `/admin/curricula/[id]` | `admin/curricula/view.html.twig` |
| By Dept | `/admin/curricula/department/[id]` | `admin/curricula/by_department.html.twig` |
| **Schedules** | | |
| List | `/admin/schedules` | `admin/schedule/index.html.twig` |
| Create | `/admin/schedules/create` | `admin/schedule/new_v2.html.twig` |
| Edit | `/admin/schedules/[id]/edit` | `admin/schedule/edit.html.twig` |
| Select Dept | `/admin/schedules/select-department` | `admin/schedule/select_department.html.twig` |
| Faculty Loading | `/admin/schedules/faculty-loading` | `admin/schedule/faculty_loading.html.twig` |
| **Dept Groups** | | |
| List | `/admin/department-groups` | `admin/department_group/index.html.twig` |
| **Reports** | | |
| Faculty Workload | `/admin/reports/faculty-workload` | `admin/reports/faculty_workload.html.twig` |
| Room Utilization | `/admin/reports/room-utilization` | `admin/reports/room_utilization.html.twig` |
| **Settings** | | |
| System Settings | `/admin/settings` | `admin/settings/system.html.twig` |
| **History** | | |
| Change History | `/admin/history` | `admin/history/index.html.twig` |

---

## 8. Phase 4 — Department Head Module

### Route Group: `src/app/(department-head)/department-head/`

| Page | Route | Twig Equivalent |
|---|---|---|
| Dashboard | `/department-head/dashboard` | `department_head/dashboard.html.twig` |
| Dept Info | `/department-head/info` | `department_head/department_info.html.twig` |
| **Faculty** | | |
| List | `/department-head/faculty` | `department_head/faculty/list.html.twig` |
| Create | `/department-head/faculty/create` | `department_head/faculty/create.html.twig` |
| Edit | `/department-head/faculty/[id]/edit` | `department_head/faculty/edit.html.twig` |
| View | `/department-head/faculty/[id]` | `department_head/faculty/view.html.twig` |
| Assignments | `/department-head/faculty-assignments` | `department_head/faculty_assignments/index.html.twig` |
| **Schedules** | | |
| List | `/department-head/schedules` | `department_head/schedules/list.html.twig` |
| Create | `/department-head/schedules/create` | `department_head/schedules/create.html.twig` |
| View | `/department-head/schedules/[id]` | `department_head/schedules/view.html.twig` |
| **Rooms** | | |
| List | `/department-head/rooms` | `department_head/rooms/list.html.twig` |
| Create | `/department-head/rooms/create` | `department_head/rooms/create.html.twig` |
| Edit | `/department-head/rooms/[id]/edit` | `department_head/rooms/edit.html.twig` |
| View | `/department-head/rooms/[id]` | `department_head/rooms/view.html.twig` |
| **Curricula** | | |
| List | `/department-head/curricula` | `department_head/curricula/list.html.twig` |
| View | `/department-head/curricula/[id]` | `department_head/curricula/view.html.twig` |
| **Reports** | | |
| Faculty Workload | `/department-head/reports/faculty-workload` | `department_head/reports/faculty_workload.html.twig` |
| Room Utilization | `/department-head/reports/room-utilization` | `department_head/reports/room_utilization.html.twig` |
| History | `/department-head/reports/history` | `department_head/reports/history.html.twig` |
| **Settings** | | |
| Settings | `/department-head/settings` | `department_head/settings/index.html.twig` |

---

## 9. Phase 5 — Faculty Module

### Route Group: `src/app/(faculty)/faculty/`

| Page | Route | Twig Equivalent | API Endpoint |
|---|---|---|---|
| Dashboard | `/faculty/dashboard` | `faculty/dashboard.html.twig` | `GET /api/faculty/dashboard` ✅ |
| Schedule | `/faculty/schedule` | `faculty/schedule.html.twig` | `GET /api/faculty/schedule` ✅ |
| Classes | `/faculty/classes` | `faculty/classes.html.twig` | `GET /api/faculty/classes` ✅ |
| Performance | `/faculty/performance` | `faculty/performance.html.twig` | *(needs endpoint)* |
| Office Hours | `/faculty/office-hours` | `faculty/office_hours.html.twig` | *(needs endpoint)* |
| Profile | `/faculty/profile` | `faculty/profile.html.twig` | `GET /api/faculty/profile` ✅ |

> Faculty module has the most API coverage already. Only performance and office hours need new endpoints.

---

## 10. Phase 6 — Testing & Polish

### 10.1 Testing Checklist

- [ ] JWT login/logout flow works
- [ ] Token refresh/expiry handled gracefully
- [ ] Role-based route protection (admin can't access faculty routes, etc.)
- [ ] All CRUD operations work (create, read, update, delete)
- [ ] Form validation shows errors from API
- [ ] Schedule conflict detection works
- [ ] PDF export downloads work
- [ ] Pagination on all list pages
- [ ] Search/filter functionality
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Loading states on all async operations
- [ ] Error states (network failure, 500 errors)
- [ ] Empty states (no data)
- [ ] Notification system works (faculty)
- [ ] Activity logging still works via API

### 10.2 CORS Verification

Current CORS config allows all origins — restrict in production:

```yaml
# config/packages/nelmio_cors.yaml
nelmio_cors:
    paths:
        '^/api/':
            allow_origin: ['https://your-nextjs-domain.com']
```

### 10.3 Security Checklist

- [ ] JWT tokens stored in httpOnly cookies (not localStorage)
- [ ] API validates all input server-side
- [ ] No sensitive data in JWT payload
- [ ] CORS restricted to known origins in production
- [ ] Rate limiting on login endpoint
- [ ] File upload validation (if any)

---

## 11. Entity Reference

### User

| Field | Type | Notes |
|---|---|---|
| id | int | Auto-increment PK |
| username | string(255) | Unique, min 3 chars |
| email | string(255) | Unique, valid email |
| password | string(255) | Hashed |
| firstName | string(255) | Nullable |
| middleName | string(255) | Nullable |
| lastName | string(255) | Nullable |
| role | int | 1=Admin, 2=Dept Head, 3=Faculty |
| employeeId | string(255) | Unique, nullable, 6-15 chars |
| position | string(255) | Nullable |
| address | text | Nullable |
| otherDesignation | text | Nullable |
| isActive | boolean | Default true |
| lastLogin | datetime | Nullable |
| college | → College | ManyToOne, nullable |
| department | → Department | ManyToOne, nullable |
| createdAt | datetime | |
| updatedAt | datetime | |
| deletedAt | datetime | Soft delete |

### College

| Field | Type | Notes |
|---|---|---|
| id | int | PK |
| code | string(10) | Unique |
| name | string(255) | |
| description | text | Nullable |
| dean | string(255) | Nullable |
| logo | string(255) | Nullable |
| isActive | boolean | Default true |
| departments | → Department[] | OneToMany |
| users | → User[] | OneToMany |

### Department

| Field | Type | Notes |
|---|---|---|
| id | int | PK |
| code | string(10) | Unique |
| name | string(255) | |
| description | text | Nullable |
| contactEmail | string(255) | Nullable |
| isActive | boolean | Default true |
| head | → User | ManyToOne, nullable |
| college | → College | ManyToOne, nullable |
| departmentGroup | → DepartmentGroup | ManyToOne, nullable |

### Subject

| Field | Type | Notes |
|---|---|---|
| id | bigint | PK |
| code | string(255) | |
| title | string(255) | |
| description | text | Nullable |
| units | int | 1-12 |
| lectureHours | int | Default 0 |
| labHours | int | Default 0 |
| type | string(50) | Default 'lecture' |
| yearLevel | int | Nullable |
| semester | string(20) | Nullable |
| isActive | boolean | Default true |
| department | → Department | ManyToOne |

### Room

| Field | Type | Notes |
|---|---|---|
| id | bigint | PK |
| code | string(255) | |
| name | string(255) | Nullable |
| type | string(50) | 'classroom', 'laboratory', 'auditorium', 'office' |
| capacity | int | Nullable |
| building | string(255) | Nullable |
| floor | string(255) | Nullable |
| equipment | text | Nullable |
| isActive | boolean | Default true |
| department | → Department | ManyToOne |
| departmentGroup | → DepartmentGroup | ManyToOne, nullable |

### Schedule

| Field | Type | Notes |
|---|---|---|
| id | bigint | PK (unsigned) |
| semester | string(10) | '1st', '2nd', etc. |
| dayPattern | string(255) | 'M-W-F', 'T-TH', 'M-T-TH-F', 'M-T', 'TH-F', 'SAT', 'SUN' |
| startTime | time | |
| endTime | time | |
| section | string(255) | Nullable |
| enrolledStudents | int | Default 0 |
| isConflicted | boolean | Default false |
| isOverload | boolean | Default false |
| status | string(20) | Default 'active' |
| notes | text | Nullable |
| academicYear | → AcademicYear | ManyToOne |
| subject | → Subject | ManyToOne |
| room | → Room | ManyToOne |
| faculty | → User | ManyToOne, nullable |

### AcademicYear

| Field | Type | Notes |
|---|---|---|
| id | bigint | PK |
| year | string(255) | Unique, format: 'YYYY-YYYY' |
| startDate | date | Nullable |
| endDate | date | Nullable |
| isCurrent | boolean | Default false |
| currentSemester | string(20) | '1st', '2nd', 'Summer' |
| isActive | boolean | Default true |
| firstSemStart/End | date | Nullable |
| secondSemStart/End | date | Nullable |
| summerStart/End | date | Nullable |

### Curriculum

| Field | Type | Notes |
|---|---|---|
| id | bigint | PK |
| name | string(255) | |
| version | int | Default 1 |
| isPublished | boolean | Default false |
| effectiveYearId | bigint | Nullable |
| notes | text | Nullable |
| department | → Department | ManyToOne |
| curriculumTerms | → CurriculumTerm[] | OneToMany |

### CurriculumTerm

| Field | Type | Notes |
|---|---|---|
| id | int | PK |
| year_level | int | |
| semester | string(10) | '1st', '2nd', 'summer' |
| term_name | string(100) | Nullable |
| curriculum | → Curriculum | ManyToOne |
| curriculumSubjects | → CurriculumSubject[] | OneToMany |

### CurriculumSubject

| Field | Type | Notes |
|---|---|---|
| id | int | PK |
| sections_mapping | JSON | Nullable |
| curriculumTerm | → CurriculumTerm | ManyToOne |
| subject | → Subject | ManyToOne |

### ActivityLog

| Field | Type | Notes |
|---|---|---|
| id | int | PK |
| action | string(100) | e.g. 'user.created' |
| description | string(255) | |
| entityType | string(100) | Nullable |
| entityId | int | Nullable |
| metadata | JSON | Nullable |
| ipAddress | string(45) | Nullable |
| userAgent | string(255) | Nullable |
| createdAt | DateTimeImmutable | |
| user | → User | ManyToOne, nullable |

### Notification

| Field | Type | Notes |
|---|---|---|
| id | int | PK |
| type | string(50) | schedule_assigned, schedule_updated, etc. |
| title | string(255) | |
| message | text | |
| isRead | boolean | Default false |
| readAt | DateTimeImmutable | Nullable |
| metadata | JSON | Nullable |
| createdAt | DateTimeImmutable | |
| user | → User | ManyToOne |

### DepartmentGroup

| Field | Type | Notes |
|---|---|---|
| id | int | PK |
| name | string(255) | |
| description | string(500) | Nullable |
| color | string(7) | Hex color, nullable |
| departments | → Department[] | OneToMany |

---

## 12. API Endpoint Reference

### Already Implemented ✅

```
POST   /api/login                              → JWT token
GET    /api/faculty/profile                     → Faculty profile
PUT    /api/faculty/profile                     → Update profile
GET    /api/faculty/dashboard                   → Dashboard data
GET    /api/faculty/schedule                    → All schedules
GET    /api/faculty/schedule/weekly             → Weekly schedule
GET    /api/faculty/schedule/export-pdf         → PDF download
GET    /api/faculty/schedule/teaching-load-pdf  → Teaching load PDF
GET    /api/faculty/classes                     → Classes list
GET    /api/faculty/notifications               → Notifications list
GET    /api/faculty/notifications/unread-count  → Unread count
POST   /api/faculty/notifications/{id}/read     → Mark read
POST   /api/faculty/notifications/read-all      → Mark all read
DELETE /api/faculty/notifications/{id}          → Delete notification
```

### Needs to Be Built ❌

See [Phase 0](#4-phase-0--symfony-api-build-out) for the full list of ~60 endpoints.

---

## 13. Authentication & Roles

### JWT Configuration

| Setting | Value |
|---|---|
| Algorithm | RS256 (RSA keys) |
| Token TTL | 86400 seconds (24 hours) |
| User ID Claim | `email` |
| Secret Key | `config/jwt/private.pem` |
| Public Key | `config/jwt/public.pem` |

### Role Hierarchy

| Role Integer | Symfony Role | Display Name | Access |
|---|---|---|---|
| 1 | ROLE_ADMIN | Administrator | `/admin/*`, full system |
| 2 | ROLE_DEPARTMENT_HEAD | Department Head | `/department-head/*`, own department |
| 3 | ROLE_FACULTY | Faculty | `/faculty/*`, own data |
| — | ROLE_USER | User | Base role (all users get this) |

### Login Flow (Next.js)

```
1. User submits email + password to POST /api/login
2. Symfony returns JWT token
3. Next.js stores token in httpOnly cookie
4. Next.js decodes token to get user role
5. Redirect to role-appropriate dashboard:
   - ROLE_ADMIN → /admin/dashboard
   - ROLE_DEPARTMENT_HEAD → /department-head/dashboard
   - ROLE_FACULTY → /faculty/dashboard
6. All subsequent API calls include Authorization: Bearer <token>
7. On 401 response → clear token, redirect to /login
```

---

## 14. Design System Reference

### Colors

| Token | Hex | Usage |
|---|---|---|
| `primary-50` to `primary-950` | Blue palette | Brand, buttons, links, accents |
| `schedule-available` | `#10b981` (green) | Available slots |
| `schedule-booked` | `#ef4444` (red) | Booked/occupied |
| `schedule-pending` | `#f59e0b` (amber) | Pending/draft |
| `schedule-blocked` | `#6b7280` (gray) | Blocked/unavailable |

### Typography

- Font: **Inter** (sans-serif)
- Fallbacks: ui-sans-serif, system-ui, sans-serif

### Layout Patterns

- **Sidebar**: Fixed left sidebar with navigation (per role)
- **Header**: Top bar with user info, notifications, logout
- **Content**: Main area with breadcrumbs, page title, content
- **Cards**: Stats displayed in card grids
- **Tables**: Data tables with search, sort, pagination
- **Forms**: Card-based forms with labels, inputs, button row
- **Modals**: Centered overlay dialogs for confirmations

### Grid

- Schedule grid: `auto repeat(7, 1fr)` — time column + 7 day columns
- Time slots: `auto repeat(auto-fit, minmax(100px, 1fr))`

### Animations

- `fade-in`: 0.5s ease-in-out opacity 0→1
- `slide-in`: 0.3s ease-out translateY(-10px→0) + opacity

---

## 15. File & Folder Structure

### Next.js Project Structure

```
scheduling-frontend/
├── public/
│   └── images/                     # Static images
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Home redirect
│   │   ├── (auth)/
│   │   │   ├── layout.tsx          # Auth layout (centered card)
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── register/
│   │   │       └── page.tsx
│   │   ├── (admin)/
│   │   │   ├── layout.tsx          # Admin sidebar layout
│   │   │   └── admin/
│   │   │       ├── dashboard/
│   │   │       │   └── page.tsx
│   │   │       ├── colleges/
│   │   │       │   ├── page.tsx            # List
│   │   │       │   ├── create/page.tsx     # Create
│   │   │       │   └── [id]/
│   │   │       │       ├── page.tsx        # View
│   │   │       │       └── edit/page.tsx   # Edit
│   │   │       ├── departments/
│   │   │       │   └── ... (same pattern)
│   │   │       ├── subjects/
│   │   │       │   └── ...
│   │   │       ├── rooms/
│   │   │       │   └── ...
│   │   │       ├── users/
│   │   │       │   ├── page.tsx            # All users
│   │   │       │   ├── faculty/page.tsx
│   │   │       │   ├── department-heads/page.tsx
│   │   │       │   ├── administrators/page.tsx
│   │   │       │   ├── create/page.tsx
│   │   │       │   ├── invalid-roles/page.tsx
│   │   │       │   ├── faculty-history/page.tsx
│   │   │       │   └── [id]/
│   │   │       │       ├── page.tsx
│   │   │       │       └── edit/page.tsx
│   │   │       ├── academic-years/
│   │   │       │   └── ...
│   │   │       ├── curricula/
│   │   │       │   └── ...
│   │   │       ├── schedules/
│   │   │       │   ├── page.tsx
│   │   │       │   ├── create/page.tsx
│   │   │       │   ├── select-department/page.tsx
│   │   │       │   ├── faculty-loading/page.tsx
│   │   │       │   └── [id]/edit/page.tsx
│   │   │       ├── department-groups/
│   │   │       │   └── page.tsx
│   │   │       ├── reports/
│   │   │       │   ├── faculty-workload/page.tsx
│   │   │       │   └── room-utilization/page.tsx
│   │   │       ├── settings/
│   │   │       │   └── page.tsx
│   │   │       └── history/
│   │   │           └── page.tsx
│   │   ├── (department-head)/
│   │   │   ├── layout.tsx
│   │   │   └── department-head/
│   │   │       ├── dashboard/page.tsx
│   │   │       ├── info/page.tsx
│   │   │       ├── faculty/
│   │   │       │   └── ... (list, create, [id], [id]/edit)
│   │   │       ├── faculty-assignments/page.tsx
│   │   │       ├── schedules/
│   │   │       │   └── ...
│   │   │       ├── rooms/
│   │   │       │   └── ...
│   │   │       ├── curricula/
│   │   │       │   └── ...
│   │   │       ├── reports/
│   │   │       │   └── ...
│   │   │       └── settings/page.tsx
│   │   └── (faculty)/
│   │       ├── layout.tsx
│   │       └── faculty/
│   │           ├── dashboard/page.tsx
│   │           ├── schedule/page.tsx
│   │           ├── classes/page.tsx
│   │           ├── performance/page.tsx
│   │           ├── office-hours/page.tsx
│   │           └── profile/page.tsx
│   ├── components/
│   │   ├── ui/                     # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Alert.tsx
│   │   │   ├── Pagination.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── Breadcrumbs.tsx
│   │   │   └── StatsCard.tsx
│   │   ├── forms/                  # Form components
│   │   │   ├── CollegeForm.tsx
│   │   │   ├── DepartmentForm.tsx
│   │   │   ├── SubjectForm.tsx
│   │   │   ├── RoomForm.tsx
│   │   │   ├── UserForm.tsx
│   │   │   ├── AcademicYearForm.tsx
│   │   │   ├── CurriculumForm.tsx
│   │   │   ├── ScheduleForm.tsx
│   │   │   └── ProfileForm.tsx
│   │   ├── layouts/                # Layout components
│   │   │   ├── AdminSidebar.tsx
│   │   │   ├── DeptHeadSidebar.tsx
│   │   │   ├── FacultySidebar.tsx
│   │   │   └── Header.tsx
│   │   └── schedule/               # Schedule-specific components
│   │       ├── WeeklyGrid.tsx
│   │       ├── ScheduleCard.tsx
│   │       └── ConflictBadge.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx         # Auth state management
│   ├── hooks/
│   │   ├── useAuth.ts             # Auth hook
│   │   ├── useApi.ts              # API query hooks
│   │   └── useDebounce.ts         # Search debounce
│   ├── lib/
│   │   ├── api.ts                 # Axios instance + interceptors
│   │   ├── utils.ts               # Helper functions
│   │   └── constants.ts           # App constants, role mappings
│   ├── types/
│   │   ├── index.ts               # All TypeScript interfaces
│   │   ├── user.ts
│   │   ├── college.ts
│   │   ├── department.ts
│   │   ├── subject.ts
│   │   ├── room.ts
│   │   ├── schedule.ts
│   │   ├── academic-year.ts
│   │   ├── curriculum.ts
│   │   ├── notification.ts
│   │   └── api.ts                 # API response types
│   └── middleware.ts              # Route protection middleware
├── .env.local                     # API URL config
├── tailwind.config.ts
├── tsconfig.json
├── next.config.ts
└── package.json
```

---

## Progress Tracker

Use this to track implementation progress:

### Phase 0 — API Build-Out
- [ ] Admin Dashboard API
- [ ] Admin Colleges API (CRUD)
- [ ] Admin Departments API (CRUD)
- [ ] Admin Subjects API (CRUD)
- [ ] Admin Rooms API (CRUD)
- [ ] Admin Users API (CRUD + role-based lists)
- [ ] Admin Academic Years API (CRUD)
- [ ] Admin Curricula API (CRUD + terms/subjects)
- [ ] Admin Schedules API (CRUD + conflict check)
- [ ] Admin Department Groups API (CRUD)
- [ ] Admin Reports API (data + PDF)
- [ ] Admin Settings API
- [ ] Admin Activities API
- [ ] Department Head Dashboard API
- [ ] Department Head Faculty API
- [ ] Department Head Schedules API
- [ ] Department Head Rooms API
- [ ] Department Head Curricula API
- [ ] Department Head Reports API
- [ ] Department Head Settings API
- [ ] Update security.yaml access control
- [ ] Faculty Performance API
- [ ] Faculty Office Hours API

### Phase 1 — Next.js Setup
- [ ] Initialize Next.js project
- [ ] Install dependencies
- [ ] Configure Tailwind
- [ ] Set up API client (axios)
- [ ] Create Auth context + provider
- [ ] Create middleware (route protection)
- [ ] Set up React Query provider

### Phase 2 — Components & Layouts
- [ ] UI components (Button, Input, Table, Modal, etc.)
- [ ] Admin sidebar layout
- [ ] Department Head sidebar layout
- [ ] Faculty sidebar layout
- [ ] Auth layout (login/register)
- [ ] Form components
- [ ] TypeScript types for all entities

### Phase 3 — Admin Module
- [ ] Dashboard
- [ ] Colleges (CRUD)
- [ ] Departments (CRUD)
- [ ] Subjects (CRUD)
- [ ] Rooms (CRUD)
- [ ] Users (CRUD + role views)
- [ ] Academic Years (CRUD)
- [ ] Curricula (CRUD + terms)
- [ ] Schedules (CRUD + conflict)
- [ ] Department Groups
- [ ] Reports (workload + utilization)
- [ ] Settings
- [ ] Activity Logs
- [ ] History

### Phase 4 — Department Head Module
- [ ] Dashboard
- [ ] Faculty Management
- [ ] Schedules
- [ ] Rooms
- [ ] Curricula
- [ ] Faculty Assignments
- [ ] Reports
- [ ] Settings

### Phase 5 — Faculty Module
- [ ] Dashboard
- [ ] Schedule
- [ ] Classes
- [ ] Performance
- [ ] Office Hours
- [ ] Profile

### Phase 6 — Testing & Polish
- [ ] Auth flow testing
- [ ] CRUD testing all modules
- [ ] PDF export testing
- [ ] Responsive design
- [ ] Error handling
- [ ] Security hardening (CORS, httpOnly cookies)

---

*This guide will be updated as the project progresses.*
