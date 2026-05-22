# OpenContest

[English](./README.md) | Русский

OpenContest - локально запускаемая платформа для онлайн-олимпиад по спортивному программированию.

В проекте есть:

- frontend на React/Vite, в Docker отдается через nginx;
- backend на Django REST Framework;
- PostgreSQL;
- RabbitMQ;
- runner на Go с запуском решений через `nsjail`;
- поддержка C++17, Python 3, Java 17 и Rust;
- динамический список языков из активных runner-ов;
- Docker Compose для локального старта одной командой;
- Kubernetes-манифесты и KEDA autoscaling runner-ов по очереди RabbitMQ.

## Быстрый Старт

Требования:

- Docker Desktop или Docker Engine с Docker Compose;
- Windows PowerShell, если запускаешь на Windows.

Запуск локально:

```powershell
.\scripts\opencontest.ps1 start
```

Скрипт собирает образы, запускает PostgreSQL, RabbitMQ, backend, frontend, runner и `queue-repair`, применяет миграции и загружает демо-данные.

После запуска:

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api
- Health check: http://localhost:8000/api/health/
- RabbitMQ UI: http://localhost:15672

Если какой-то порт занят, скопируй `.env.example` в `.env` и поменяй `FRONTEND_PORT`, `BACKEND_PORT` или `RABBITMQ_UI_PORT`.

RabbitMQ:

- username: `guest`
- password: `guest`

Демо-пользователи:

- админ: `admin` / `admin123`
- участник: `coder` / `coder123`

## Команды Docker Compose

Запустить все сервисы:

```powershell
.\scripts\opencontest.ps1 start
```

Запустить без пересборки образов:

```powershell
.\scripts\opencontest.ps1 start -NoBuild
```

Применить миграции и загрузить демо-данные:

```powershell
.\scripts\opencontest.ps1 seed
```

Полностью сбросить локальную базу, пересобрать и заново загрузить демо-данные:

```powershell
.\scripts\opencontest.ps1 reset
```

Перезапустить контейнеры без удаления базы:

```powershell
.\scripts\opencontest.ps1 restart
```

Показать статус:

```powershell
.\scripts\opencontest.ps1 status
```

Вернуть зависшие `Pending`/`Running` посылки в очередь:

```powershell
.\scripts\opencontest.ps1 requeue
```

Остановить контейнеры:

```powershell
.\scripts\opencontest.ps1 stop
```

Удалить локальную базу вместе с volume:

```powershell
docker compose down -v
```

## Что Поднимается Локально

Docker Compose запускает:

- `db` - PostgreSQL;
- `rabbitmq` - брокер сообщений;
- `backend` - Django API, миграции и seed;
- `frontend` - production-сборка React через nginx;
- `runner` - Go runner, который берет задания из RabbitMQ и запускает решения через `nsjail`;
- `queue-repair` - фоновый процесс, который переотправляет зависшие посылки.

## Kubernetes

Kubernetes-манифесты лежат в [deploy/k8s](./deploy/k8s).

Запуск локального Kubernetes-окружения:

```powershell
.\scripts\opencontest.ps1 k8s-start
```

Shortcut:

```powershell
.\start-k8s.ps1
```

Полный сброс namespace и базы:

```powershell
.\scripts\opencontest.ps1 k8s-reset
```

Остановить Kubernetes-окружение:

```powershell
.\scripts\opencontest.ps1 k8s-stop
```

KEDA масштабирует runner-ы по длине очереди `judge.submissions`. Текущий лимит указан в [deploy/k8s/40-keda-runner-scaledobject.yaml](./deploy/k8s/40-keda-runner-scaledobject.yaml).

## Нагрузочный Тест

Скрипт отправляет много решений, которые специально спят дольше лимита времени. Это удобно, чтобы увидеть рост очереди, занятость runner-ов и autoscaling.

```powershell
$env:OPENCONTEST_LOAD_COUNT='80'
$env:OPENCONTEST_LOAD_SLEEP='15'
$env:OPENCONTEST_LOAD_WORKERS='10'
.\backend\.venv\Scripts\python.exe scripts\load_test.py
```

В Admin Dashboard можно смотреть:

- online/busy/offline runner-ы;
- очередь `Pending`/`Running`;
- текущие submissions на runner-ах;
- последний verdict;
- список языков, который приходит от активных runner-ов.

## Реализовано

- авторизация participant/admin;
- API для контестов, задач, посылок и standings;
- создание и редактирование задач в админке;
- sample и hidden tests;
- custom checker на Python как базовая возможность;
- RabbitMQ очередь проверок;
- callback результата от runner-а в backend;
- пересчет standings после verdict-а;
- динамический список языков из runner heartbeat;
- realtime/polling статистика runner-ов в Admin Dashboard;
- admin summary с реальными счетчиками;
- rejudge, ручной override verdict-а и disqualify пользователя в рамках контеста;
- Prometheus-style `/api/metrics/`;
- Docker Compose окружение;
- Kubernetes manifests и KEDA autoscaling.

## Еще Нужно Доработать

- полноценный импорт архивов задач вместо текущего stub endpoint;
- автотесты и CI;
- production security settings;
- публикацию Docker images в registry;
- более богатые custom checkers;
- code splitting frontend bundle;
- WebSocket-обновления вместо polling/SSE.

## Разработка Без Docker

Backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python manage.py migrate
.\.venv\Scripts\python manage.py seed
.\.venv\Scripts\python manage.py runserver
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Для локальной проверки решений без Docker дополнительно нужны RabbitMQ, Go, `g++`, `python3`, Java, Rust и `nsjail`.
