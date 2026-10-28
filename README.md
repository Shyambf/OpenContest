# OpenContest

English | [Русский](./README.ru.md)

OpenContest is a local-first platform for online competitive programming contests.

The project currently includes:

- React/Vite frontend served by nginx in Docker
- Django REST backend
- PostgreSQL
- RabbitMQ
- Go judge runner with `nsjail`
- Support for C++17, Python 3, Java 17 and Rust submissions
- Docker Compose for one-command local startup
- Kubernetes manifests for staging/production experiments

## Quick Start and Management

Requirements:

- Docker Desktop or Docker Engine with Docker Compose
- On Windows, use PowerShell

The recommended entrypoint on Windows is:

```powershell
.\scripts\opencontest.ps1 start
```

This builds images if needed, starts PostgreSQL, RabbitMQ, backend, frontend, runner and the automatic queue repair worker, then runs migrations and loads demo data.

After startup:

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api
- Backend health: http://localhost:8000/api/health/
- RabbitMQ management: http://localhost:15672

You can customize settings by creating `.env` (copy from `.env.example`):

- `RUNNERS_COUNT=3` — number of parallel runner instances for evaluating submissions concurrently;
- `FRONTEND_PORT`, `BACKEND_PORT`, or `RABBITMQ_UI_PORT` — port overrides if ports are already busy.

You can also specify the runner count directly via PowerShell CLI flag:

```powershell
.\scripts\opencontest.ps1 start -Runners 3
```

RabbitMQ default credentials:

- username: `guest`
- password: `guest`

Demo OpenContest users:

- admin: `admin` / `admin123`
- participant: `coder` / `coder123`

### Local Docker Compose Commands

Start everything:

```powershell
.\scripts\opencontest.ps1 start
```

Start without rebuilding images:

```powershell
.\scripts\opencontest.ps1 start -NoBuild
```

Run migrations and load demo data into the current database:

```powershell
.\scripts\opencontest.ps1 seed
```

Reset the local database volume, rebuild, migrate and recreate demo data:

```powershell
.\scripts\opencontest.ps1 reset
```

Restart containers without deleting the database:

```powershell
.\scripts\opencontest.ps1 restart
```

Show container status:

```powershell
.\scripts\opencontest.ps1 status
```

Requeue stuck submissions manually. This is normally automatic, but the command is useful after debugging RabbitMQ or runners:

```powershell
.\scripts\opencontest.ps1 requeue
```

Stop local containers:

```powershell
.\scripts\opencontest.ps1 stop
```

Hard stop and delete the local database volume without using the helper script:

```powershell
docker compose down -v
```

Legacy helper scripts still work:

```powershell
.\scripts\dev.ps1
```

Linux/macOS:

```bash
sh ./scripts/dev.sh
```

Or run Docker Compose directly:

```bash
docker compose up --build
```

## What Starts Locally

Docker Compose starts:

- `db`: PostgreSQL
- `rabbitmq`: message broker
- `backend`: runs migrations, seeds demo data once, starts Django
- `frontend`: builds React and serves static files through nginx
- `runner`: consumes judge jobs from RabbitMQ and runs code through `nsjail`
- `queue-repair`: periodically requeues submissions stuck in `Pending` or `Running`

The seed command is safe to run repeatedly. It will not overwrite existing local contest data unless you explicitly run:

```bash
docker compose exec backend python manage.py seed --reset
```

## Stop

Stop containers:

```powershell
.\scripts\opencontest.ps1 stop
```

Stop and delete the local database volume:

```bash
docker compose down -v
```

## Local Development Without Docker

Backend:

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python manage.py migrate
.\.venv\Scripts\python manage.py seed
.\.venv\Scripts\python manage.py runserver
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

For local judging without Docker you also need RabbitMQ, Go, `g++`, `python3`, Java, Rust and `nsjail`.

## Current Status & Security Hardening

Implemented:

- **Security & Access Control:**
  - Upcoming contest problem isolation (403 for participants until contest starts);
  - Submission window enforcement (submissions rejected outside active contest duration);
  - Custom checker code hidden from non-staff users;
  - DRF throttling configured (`AnonRateThrottle`, `UserRateThrottle`);
  - Safe partial problem updates preserving existing sample and secret tests.
- **Judge Runner & Scalability:**
  - Concurrent multi-replica runner scaling via `RUNNERS_COUNT` in `.env` and `-Runners` CLI flag;
  - Unique runner replica IDs (`runner-<hostname>`);
  - Real CPU execution time calculation and rusage memory measurement (`MemoryKB`);
  - Accurate MLE (Memory Limit Exceeded) detection and JVM memory capping for Java;
  - Panic recovery, backoff retries, and poison pill / dead-letter message protection in Go runner;
  - Submission execution timestamp tracking (`running_started_at`) preventing race conditions during queue repairs.
- **Performance & Infrastructure:**
  - Database composite indexes `(contest, user, status)` and indexes on `status` and `submitted_at`;
  - Async standings calculation via dedicated `result-processor` worker (removed synchronous DB recomputation on `GET /standings/`);
  - Nginx buffering disabled (`proxy_buffering off;`) for real-time SSE streams;
  - GitHub Pages documentation site with automated GitHub Actions deployment.
- **Core Platform Features:**
  - Authentication with participant/admin roles;
  - Contest/problem/submission API;
  - Dynamic language list from active runners;
  - Rejudge, verdict override, and contest-scoped disqualification;
  - Real-time SSE streaming for submissions and runner metrics;
  - Kubernetes manifests with KEDA runner autoscaling.

For full audit details and remediation history, see [SECURITY_AUDIT.md](./SECURITY_AUDIT.md).

## Roadmap & Next Steps

1. **Automated Unit & Integration Tests:**
   - Expand `backend/judge/tests.py` to cover access controls (upcoming contests, submission windows, checker privacy);
   - Add unit tests for partial problem update regressions.
2. **GitHub Actions CI Pipeline (`ci.yml`):**
   - Automated workflow executing Django tests (`python manage.py test`) and Go runner tests/vet (`go test ./...`) on every push/PR.
3. **Compiler Sandbox Isolation:**
   - Wrap compilation phase (`g++`, `rustc`, `javac`) in `nsjail` with memory limits (1GB) and timeouts (30s) to prevent compiler bomb attacks and host OOM kills.
4. **SSE & Real-Time Transport Optimization:**
   - Migrate long-running synchronous WSGI SSE streams to an asynchronous handler (ASGI) or WebSocket connection to eliminate Gunicorn worker starvation.
5. **Strict Production Environment Security:**
   - Enforce non-default `DJANGO_SECRET_KEY` and disable `DEBUG` mode when running in production mode (`DJANGO_ENV=production`).
6. **Contest Management & UI:**
   - Rich problem statement markdown editor and comprehensive polygon-style package import;
   - Frontend bundle code splitting for faster initial page load.

## Kubernetes

Kubernetes manifests live in [deploy/k8s](./deploy/k8s).

For local development, Docker Compose is the recommended path. Kubernetes is intended for staging/production experiments once images are built and loaded into a cluster.

Start Kubernetes deployment, build images, install/update KEDA, run migrations, seed data and start port-forwards:

```powershell
.\scripts\opencontest.ps1 k8s-start
```

The old shortcut is kept and calls the same flow:

```powershell
.\start-k8s.ps1
```

Start Kubernetes without rebuilding images:

```powershell
.\scripts\opencontest.ps1 k8s-start -NoBuild
```

Start Kubernetes without opening port-forwards:

```powershell
.\scripts\opencontest.ps1 k8s-start -NoPortForward
```

Run only the Kubernetes seed job:

```powershell
.\scripts\opencontest.ps1 k8s-seed
```

Reset the whole Kubernetes namespace, including the Postgres PVC/database:

```powershell
.\scripts\opencontest.ps1 k8s-reset
```

Requeue stuck Kubernetes submissions manually:

```powershell
.\scripts\opencontest.ps1 k8s-requeue
```

Stop Kubernetes deployment by deleting the namespace:

```powershell
.\scripts\opencontest.ps1 k8s-stop
```

Runner autoscaling is handled by KEDA from RabbitMQ queue length. The current runner limit is `50` pods in `deploy/k8s/40-keda-runner-scaledobject.yaml`.

Kubernetes also includes `backend-requeue-pending`, a CronJob that runs every minute and automatically republishes submissions stuck in `Pending` or `Running`.
