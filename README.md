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

If one of these ports is already busy, copy `.env.example` to `.env` and change `FRONTEND_PORT`, `BACKEND_PORT` or `RABBITMQ_UI_PORT`.

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

## Current Status

Implemented:

- authentication with participant/admin roles
- contest/problem/submission API
- admin-only create/edit actions
- sample and hidden tests
- dynamic language list from active runners
- contest registration
- Python custom checker foundation
- RabbitMQ judge queue
- runner verdict callback
- standings recomputation after verdict
- SSE endpoints for live streams
- live runner load dashboard in admin panel
- Prometheus-style metrics endpoint
- polling for submission status updates
- real admin summary counters
- admin rejudge, verdict override and contest-scoped user disqualification
- local Docker Compose setup
- Kubernetes base manifests and KEDA runner autoscaling manifest

Still planned:

- better contest editor and archive import
- tests and CI
- stricter production security settings
- registry-based image publishing
- richer problem statements and checkers
- frontend bundle code splitting
- WebSocket updates instead of polling

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
