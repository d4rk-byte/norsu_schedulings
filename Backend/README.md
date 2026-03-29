# Smart Scheduling System

A comprehensive web-based class scheduling and management system built with Symfony 7.3 for educational institutions. The system streamlines the process of creating, managing, and tracking academic schedules while preventing conflicts and optimizing resource allocation.

## 🎯 Features

### For Administrators
- **Dashboard Overview**: Real-time statistics and system monitoring
- **User Management**: Create and manage faculty, department heads, and admin accounts
- **Department Management**: Organize departments and assign department heads
- **Curriculum Management**: 
  - Import curriculum templates via CSV
  - Manage subjects and prerequisites
  - Configure course requirements by year level
- **Schedule Management**:
  - Automated conflict detection
  - Room and faculty availability checking
  - Batch schedule creation
  - Visual weekly schedule view
  - Export schedules to PDF
- **Room Management**: Configure classrooms, labs, and other facilities
- **Academic Year & Semester Control**: Set current academic periods

### For Department Heads
- **Department Dashboard**: Overview of department schedules and faculty
- **Schedule Creation**: Create and approve schedules for their department
- **Faculty Assignment**: Assign courses to department faculty members
- **Curriculum Oversight**: Manage department-specific curricula
- **Schedule Validation**: Review and validate schedule conflicts

### For Faculty Members
- **Personal Dashboard**: 
  - Today's schedule with real-time status (In Progress, Upcoming, Completed)
  - Weekly teaching load statistics
  - Active classes overview
- **Schedule View**: 
  - Complete weekly schedule
  - PDF export functionality
  - Semester filtering
- **Class Management**: 
  - View assigned classes
  - Student enrollment numbers
  - Room assignments
- **Profile Management**: Update personal and academic information
- **Performance Analytics**: View teaching load and class statistics

## 🛠️ Technology Stack

- **Backend**: Symfony 7.3 (PHP 8.2+)
- **Database**: MySQL/MariaDB with Doctrine ORM
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **PDF Generation**: TCPDF
- **File Processing**: PhpSpreadsheet for CSV imports
- **HTTP Client**: Axios (frontend)
- **Security**: Symfony Security component with role-based access control

## 📋 Requirements

- PHP 8.2+ and Composer 2.x (backend)
- Node.js 18+ and npm (frontend)
- MySQL 5.7+ or MariaDB 10.3+
- Docker Desktop (optional, for Docker setup)

## 🚀 Local Setup

This repository is a monorepo with two apps:

- **Backend (Symfony API)**: `Backend/`
- **Frontend (Next.js UI)**: `Frontend/`

### Option 1: Docker backend + local frontend (recommended)

#### 1. Clone the repository

```bash
git clone https://github.com/d4rk-byte/norsu_schedulings.git
cd Full-Scheduling_system
```

#### 2. Backend (Docker)

```bash
cd Backend
cp .env.example .env
```

Update `.env` with your settings:

```env
APP_ENV=dev
APP_PORT=8000
FRONTEND_BASE_URL=http://localhost:3000

MYSQL_ROOT_PASSWORD=SecureRoot2026!
MYSQL_DATABASE=smart_scheduling
MYSQL_USER=symfony
MYSQL_PASSWORD=SymfonySecure2026!
```

Start services:

```bash
docker compose up -d
# Optional: phpMyAdmin
docker compose --profile tools up -d
```

Apply migrations and create an admin user:

```bash
docker compose exec app php bin/console doctrine:migrations:migrate
docker compose exec app php bin/console app:create-admin
```

#### 3. Frontend (local)

```bash
cd ../Frontend
cp .env.example .env.local
```

Update `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Install and run the UI:

```bash
npm install
npm run dev
```

#### 4. Access

- **Frontend UI**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **phpMyAdmin**: http://localhost:8080 (if started with `--profile tools`)

### Option 2: Full local (no Docker)

#### Backend

```bash
cd Backend
composer install
```

Create `.env.local`:

```env
APP_ENV=dev
DATABASE_URL="mysql://username:password@127.0.0.1:3306/smart_scheduling?serverVersion=8.0"
FRONTEND_BASE_URL=http://localhost:3000
```

Create schema and seed an admin user:

```bash
php bin/console doctrine:database:create
php bin/console doctrine:migrations:migrate
php bin/console app:create-admin
```

Start the backend:

```bash
symfony server:start
# OR
php -S localhost:8000 -t public
```

#### Frontend

```bash
cd ../Frontend
cp .env.example .env.local
npm install
npm run dev
```

If you prefer schema sync over migrations (dev only):

```bash
php bin/console doctrine:schema:update --force
```

## 👤 User Roles

The system has three main user roles:

1. **ROLE_ADMIN** (Role ID: 1)
   - Full system access
   - User and department management
   - Global schedule oversight

2. **ROLE_DEPT_HEAD** (Role ID: 2)
   - Department-specific management
   - Schedule creation for department
   - Faculty assignment within department

3. **ROLE_FACULTY** (Role ID: 3)
   - Personal schedule viewing
   - Class management
   - Profile updates

## 📖 Usage Guide

### Creating a New Academic Year

1. Login as Admin
2. Navigate to **Settings** → **Academic Years**
3. Click **Add Academic Year**
4. Enter year (e.g., "2024-2025")
5. Set as current if needed

### Importing Curriculum

1. Prepare a CSV file with curriculum data:
   - Columns: `year_level`, `semester`, `subject_code`, `subject_title`, `units`, `lec_hours`, `lab_hours`, `prerequisites`
2. Navigate to **Curriculum** → **Import**
3. Select department and program
4. Upload CSV file
5. Review and confirm import

### Creating Schedules

1. Navigate to **Schedules** → **Create Schedule**
2. Select:
   - Academic Year & Semester
   - Department
   - Subject
   - Faculty
   - Room
   - Day Pattern (M-W-F, T-TH, M-T-TH-F, etc.) - Note: Wednesday is reserved for events
   - Time slots
3. System automatically checks for conflicts
4. Save schedule

### Faculty Dashboard Features

Faculty members can:
- View today's schedule organized by time:
  - **In Progress**: Currently ongoing classes (with pulsing indicator)
  - **Upcoming**: Future classes today
  - **Completed**: Finished classes
- Export weekly schedule to PDF
- View teaching load statistics
- Access class details and student counts

## 🔧 Maintenance Commands

### Docker Commands

#### Create Admin User
```bash
docker compose exec app php bin/console app:create-admin
```

#### Clean Orphaned Curricula
```bash
docker compose exec app php bin/console app:clean-orphaned-curricula
```

#### Clear Cache
```bash
docker compose exec app php bin/console cache:clear
```

#### Database Backup
```bash
docker compose exec db mysqldump -usymfony -pSymfonySecure2026! smart_scheduling > backup_$(date +%Y%m%d).sql
```

#### View Logs
```bash
# View application logs
docker compose logs app

# Follow logs in real-time
docker compose logs -f app

# View database logs
docker compose logs db
```

#### Restart Services
```bash
# Restart all services
docker compose restart

# Restart specific service
docker compose restart app
```

### Traditional Installation Commands

#### Create Admin User
```bash
php bin/console app:create-admin
```

#### Clean Orphaned Curricula
```bash
php bin/console app:clean-orphaned-curricula
```

#### Clear Cache
```bash
php bin/console cache:clear
```

#### Database Backup
```bash
mysqldump -u username -p smart_scheduling > backup_$(date +%Y%m%d).sql
```

## 🎨 Customization

### Frontend UI
The Next.js UI lives in `Frontend/src`. Tailwind configuration is in:
- `Frontend/tailwind.config.js`
- `Frontend/postcss.config.js`

### Backend configuration
Adjust server settings in:
- `Backend/config/packages/` - Symfony configuration
- `Backend/.env` or `Backend/.env.local` - Environment variables

The backend redirects non-API routes to `FRONTEND_BASE_URL`.

## 🐛 Troubleshooting

### Docker Setup

#### Database Connection Issues
- Check if containers are running: `docker compose ps`
- Check logs: `docker compose logs app`
- Restart containers: `docker compose restart`
- Verify `.env` database credentials match docker-compose.yml

#### Permission Errors in Container
```bash
# Fix permissions inside container
docker compose exec app chmod -R 777 var/
```

#### Cannot Access Application
- Verify port 8000 is not in use: `netstat -ano | findstr :8000`
- Check if containers are healthy: `docker compose ps`
- Restart: `docker compose down && docker compose up -d`

#### Frontend Cannot Reach API
- Verify `Frontend/.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:8000`
- Confirm the backend is running and reachable on port 8000
- If you changed ports, update both `NEXT_PUBLIC_API_URL` and `FRONTEND_BASE_URL`

#### phpMyAdmin Cannot Connect
- Verify phpMyAdmin is running: `docker compose --profile tools ps`
- Use credentials from `.env`: root/SecureRoot2026! or symfony/SymfonySecure2026!
- Restart: `docker compose restart phpmyadmin`

### Traditional Installation

#### Database Connection Issues
- Verify database credentials in `.env.local`
- Ensure MySQL/MariaDB service is running
- Check database exists: `php bin/console doctrine:database:create`

#### Permission Errors
```bash
# Fix file permissions
chmod -R 777 var/
```

#### Clear Cache Issues
```bash
php bin/console cache:clear --no-warmup
php bin/console cache:warmup
```

## 📝 License

This project is proprietary software. All rights reserved.

## 👥 Credits

Developed for Negros Oriental State University (NORSU) scheduling management.

## 📧 Support

For issues and questions, please contact the IT department or system administrator.

---

**Version**: 1.0  
**Last Updated**: March 2026  
**Symfony Version**: 7.3.*
