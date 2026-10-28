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

В файле `.env` (скопируй из `.env.example`) можно переопределить настройки:

- `RUNNERS_COUNT=3` — количество параллельных инстансов runner для одновременного тестирования посылок;
- `FRONTEND_PORT`, `BACKEND_PORT` или `RABBITMQ_UI_PORT` — если какой-то порт на хосте занят.

Также количество раннеров можно передать напрямую при старте через флаг `-Runners`:

```powershell
.\scripts\opencontest.ps1 start -Runners 3
```

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

- **Безопасность и разграничение прав:**
  - Закрыт доступ к условиям задач предстоящих контестов (403 Forbidden для участников до официального старта);
  - Валидация временного окна контеста (запрет отправки решений до старта и после завершения);
  - Защита исходного кода кастомных чекеров от утечки обычным пользователям;
  - Подключено ограничение частоты запросов (DRF Throttling: `AnonRateThrottle`, `UserRateThrottle`);
  - Безопасное частичное обновление задач с сохранением существующих тестов.
- **Раннеры и масштабируемость:**
  - Параллельное масштабирование раннеров через `RUNNERS_COUNT` в `.env` и флаг `-Runners` в скриптах;
  - Уникальные идентификаторы реплик (`runner-<hostname>`);
  - Точный подсчет времени CPU и замер используемой памяти через `rusage` (`MemoryKB`);
  - Детекция вердикта MLE (Memory Limit Exceeded) и лимитирование кучи JVM для Java;
  - Защита от падений (`recover()`), обработка зависших сообщений (poison pill) и экспоненциальный backoff в Go-раннере;
  - Отслеживание времени выполнения посылки (`running_started_at`) для устранения race condition при переотправке.
- **Производительность и инфраструктура:**
  - Составные индексы БД `(contest, user, status)` и индексы на `status` и `submitted_at`;
  - Асинхронный пересчёт лидерборда через сервис `result-processor` (убран блокирующий пересчёт на каждый `GET /standings/`);
  - Отключение буферизации Nginx (`proxy_buffering off;`) для потоков SSE;
  - Сайт документации с автоматическим деплоем на GitHub Pages через GitHub Actions.
- **Базовый функционал платформы:**
  - Авторизация participant/admin;
  - API для контестов, задач, посылок и standings;
  - Создание и редактирование задач в админке;
  - Sample и hidden tests;
  - Custom checker на Python;
  - Очередь RabbitMQ для тестирования посылок;
  - Callback результата от runner-а в backend;
  - Динамический список языков из runner heartbeat;
  - Realtime/polling статистика runner-ов в Admin Dashboard;
  - Admin summary с реальными счетчиками;
  - Rejudge, ручной override verdict-а и disqualify пользователя в рамках контеста;
  - Prometheus-style `/api/metrics/`;
  - Docker Compose окружение;
  - Kubernetes manifests и KEDA autoscaling.

Подробный отчет по безопасности и статусы исправлений доступны в [SECURITY_AUDIT.md](./SECURITY_AUDIT.md).

## План Дальнейших Доработок (Roadmap)

1. **Автотесты (Unit & Integration Tests):**
   - Расширение `backend/judge/tests.py` для проверки разграничения доступа (предстоящие контесты, временные окна, приватность чекеров);
   - Регрессионные тесты на сохранение тестов при частичном обновлении задач.
2. **CI-пайплайн GitHub Actions (`ci.yml`):**
   - Автоматический запуск тестов Django (`python manage.py test`) и Go-раннера (`go test ./...`) на каждый push и Pull Request.
3. **Изоляция компиляции в раннере:**
   - Оборачивание вызовов компиляторов (`g++`, `rustc`, `javac`) в `nsjail` с лимитом памяти (1 ГБ) и времени (30 сек) для защиты от шаблонных бомб и OOM-падений.
4. **Оптимизация SSE и real-time соединений:**
   - Перевод синхронных SSE-эндпоинтов на ASGI или WebSockets для предотвращения исчерпания пула воркеров Gunicorn.
5. **Безопасная Production-конфигурация:**
   - Запрет запуска с дефолтным `DJANGO_SECRET_KEY` и включенным `DEBUG` при `DJANGO_ENV=production`.
6. **Управление контестами и фронтенд:**
   - Полноценный импорт архивов задач (Polygon-пакеты) вместо текущего заглушечного эндпоинта;
   - Code splitting бандла фронтенда для ускорения начальной загрузки.

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
