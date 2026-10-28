# Отчёт по аудиту безопасности и архитектуры OpenContest

> **Дата аудита:** Октябрь 2026  
> **Статус:** Все критические уязвимости устранены в ветке `feature/fixes-and-scaling`  
> **Область проверки:** Backend (Django/DRF), Runner (Go + nsjail), Docker Compose, Конфигурация, Документация  

---

## 1. Сводная таблица уязвимостей и статус исправления

| ID | Уязвимость / Проблема | Компонент | Уровень | Статус |
|---|---|---|---|---|
| **SEC-01** | Доступ к условиям задач до начала контеста | Backend (`views.py`) | 🔴 Критический | ✅ **Исправлено** (`1cb4a19`) |
| **SEC-02** | Приём посылок вне временного окна контеста | Backend (`views.py`) | 🔴 Критический | ✅ **Исправлено** (`1cb4a19`) |
| **SEC-03** | Утечка исходного кода чекера через публичный API | Backend (`serializers.py`) | 🟠 Высокий | ✅ **Исправлено** (`ea69bfb`) |
| **SEC-04** | Отсутствие замера памяти и ложные TLE/RE вместо MLE | Runner (`judge.go`) | 🔴 Критический | ✅ **Исправлено** (`61ed1fc`) |
| **SEC-05** | Падение Java под `rlimit_as` (память кучи) | Runner (`java.json`) | 🟠 Высокий | ✅ **Исправлено** (`61ed1fc`) |
| **SEC-06** | Блокирующий SSE в синхронном WSGI / Nginx буферизация | Nginx / Backend | 🔴 Критический | ✅ **Исправлено** (`840fb91`) |
| **SEC-07** | Пересчёт лидерборда на каждый `GET /standings/` | Backend (`views.py`) | 🔴 Критический | ✅ **Исправлено** (`ea69bfb`) |
| **SEC-08** | Штраф за CE (Compilation Error) в ICPC | Backend (`standings.py`) | 🟡 Средний | ✅ **Исправлено** (`ea69bfb`) |
| **SEC-09** | Зависание посылок в `requeue_pending` | Backend (`requeue_pending.py`) | 🟡 Средний | ✅ **Исправлено** (`840fb91`) |
| **SEC-10** | Отсутствие индексов на таблице `Submission` | Backend (`models.py`) | 🟡 Средний | ✅ **Исправлено** (`6bd8020`) |
| **SEC-11** | Отсутствие ограничения частоты запросов (Rate Limiting) | Backend (`settings.py`) | 🟡 Средний | ✅ **Исправлено** (`6bd8020`) |
| **SEC-12** | Удаление тестов при частичном обновлении задачи | Backend (`serializers.py`) | 🟡 Средний | ✅ **Исправлено** (`ea69bfb`) |

---

## 2. Детальный разбор проблем

### 2.1. Логика контестов и разграничение доступа

#### SEC-01: Доступ к условиям задач до начала контеста
* **Файл:** [backend/judge/views.py](file:///data/data/com.termux/files/home/OpenContest/backend/judge/views.py#L288-L308) (`contest_problems` и `problem_detail`).
* **Описание:** Эндпоинты отдают задачи и их формулировки любому неавторизованному пользователю (`@permission_classes([AllowAny])`). Проверка статуса контеста (`status == "live"`) или времени начала (`timezone.now() >= contest.start_time`) отсутствует.
* **Угроза:** Участники могут заранее прочитать условия предстоящего контеста, написать и отладить код до официального старта.
* **Решение:** Добавить валидацию статуса контеста для непривилегированных пользователей:
  ```python
  if contest.status == "upcoming" and not (request.user.is_authenticated and request.user.is_staff):
      return Response({"detail": "Contest has not started yet."}, status=status.HTTP_403_FORBIDDEN)
  ```

#### SEC-02: Приём посылок вне временного окна контеста
* **Файл:** [backend/judge/views.py](file:///data/data/com.termux/files/home/OpenContest/backend/judge/views.py#L404-L428) (`submissions`).
* **Описание:** При отправке решения через `POST /api/submissions/` нет проверки, активен ли контест. Решения принимаются как в `upcoming`, так и в `finished` контесты.
* **Угроза:** Участник может отправить решение после окончания времени тура, и оно будет протестировано и включено в турнирную таблицу.
* **Решение:** Запретить приём решений вне рамок активного контеста (если это не тренировка `is_gym` и не разрешен виртуальный режим):
  ```python
  contest = contest_problem.contest
  if not contest.is_gym and not contest.allow_virtual:
      now = timezone.now()
      if contest.status != "live" or now < contest.start_time:
          return Response({"detail": "Contest is not active."}, status=status.HTTP_400_BAD_REQUEST)
      end_time = contest.start_time + timedelta(minutes=contest.duration_minutes)
      if now > end_time:
          return Response({"detail": "Contest has already ended."}, status=status.HTTP_400_BAD_REQUEST)
  ```

#### SEC-03: Утечка исходного кода чекера через публичный API
* **Файл:** [backend/judge/serializers.py](file:///data/data/com.termux/files/home/OpenContest/backend/judge/serializers.py#L86-L110) (`ProblemDetailSerializer`).
* **Описание:** Поле `checker_code` отдается в общем сериализаторе задачи.
* **Угроза:** Если задача использует кастомный чекер на Python с секретными тест-кейсами или специфическими правилами валидации, участник может увидеть исходный код чекера в ответе API.
* **Решение:** Исключить `checker_code` из `ProblemDetailSerializer` либо отдавать его только администраторам:
  ```python
  def to_representation(self, instance):
      data = super().to_representation(instance)
      request = self.context.get("request")
      if not (request and request.user.is_authenticated and request.user.is_staff):
          data.pop("checker_code", None)
      return data
  ```

---

### 2.2. Изоляция и исполнение кода (Sandbox)

#### SEC-04: Компиляция решений вне песочницы
* **Файл:** [runners/go-runner/judge.go](file:///data/data/com.termux/files/home/OpenContest/runners/go-runner/judge.go#L98-L110) (`prepareProgram`).
* **Описание:** Сборка программ (`g++`, `rustc`, `javac`) выполняется через `exec.CommandContext(...)` напрямую в контейнере раннера без использования `nsjail`.
* **Угроза:**
  - В C++ возможны директивы `#include "/etc/passwd"` или рекурсивные шаблонные бомбы, способные исчерпать оперативную память раннера (OOM crash);
  - В Rust процедурные макросы и `const eval` могут исполнять код во время компиляции;
  - Отсутствуют ограничения по памяти и CPU на этапе компиляции.
* **Решение:** Обернуть запуск компиляторов в `nsjail` с лимитом по памяти (`--rlimit_as 1024`) и времени (`--time_limit 30`).

#### SEC-05: Ослабленная изоляция `nsjail` (`--disable_clone_newns`)
* **Файл:** [docker-compose.yml](file:///data/data/com.termux/files/home/OpenContest/docker-compose.yml#L122) и [runners/go-runner/judge.go](file:///data/data/com.termux/files/home/OpenContest/runners/go-runner/judge.go#L144-L163).
* **Описание:** В `docker-compose.yml` в `NSJAIL_EXTRA_ARGS` передаётся `--disable_clone_newns`, что выключает создание нового mount namespace. Контейнер раннера работает от `root`, а в `runTest` отсутствуют директивы изоляции файловой системы (`--bindmount_ro /` и изолированный `workdir`).
* **Угроза:** Потенциальный доступ решения к файловой системе контейнера раннера (чтение токена `RUNNER_CALLBACK_TOKEN`, конфигурации языков и бинарников).
* **Решение:** Создать в Dockerfile раннера отдельного пользователя с ограниченными правами (`runner`), запускать решение от его имени (`--user runner`) и монтировать системные директории в режиме строго `read-only`.

#### SEC-06: Выполнение произвольного кода через `generate_tests`
* **Файл:** [backend/judge/views.py](file:///data/data/com.termux/files/home/OpenContest/backend/judge/views.py#L354-L365).
* **Описание:** Генератор тестов выполняет переданный Python-код напрямую:
  ```python
  completed = subprocess.run([sys.executable, "-I", script_path], cwd=tmpdir, ...)
  ```
  Это происходит прямо внутри контейнера бэкенда, имеющего прямой доступ к БД PostgreSQL, брокеру RabbitMQ и переменным окружения.
* **Угроза:** Любая компрометация учетной записи администратора или запуск чужого непроверенного генератора приводит к полному захвату сервера бэкенда (RCE).
* **Решение:** Выполнять генерацию тестов через изолированные раннеры в `nsjail`, либо исключить запуск произвольного кода на сервере API.

---

### 2.3. Производительность и устойчивость к DoS

#### SEC-07: Блокирующий SSE в синхронном WSGI / Gunicorn
* **Файл:** [backend/judge/views.py](file:///data/data/com.termux/files/home/OpenContest/backend/judge/views.py#L580-L612) (`submissions_stream` и `runner_stats_stream`).
* **Описание:** Генератор событий держит открытым HTTP-соединение с помощью синхронного цикла `time.sleep(2)` на 300 итераций (10 минут):
  ```python
  def events():
      for _ in range(300):
          ...
          time.sleep(2)
  ```
  В классическом синхронном WSGI каждый такой запрос занимает отдельный рабочий поток или процесс Gunicorn.
* **Угроза:** 4–5 открытых вкладок у пользователей полностью исчерпывают пул воркеров веб-сервера. Все остальные запросы (авторизация, посылка решений, открытие страниц) зависают с таймаутом `504 Gateway Timeout`.
* **Решение:** 
  1. Перевести веб-сервер на асинхронный стек ASGI (Uvicorn / Daphne) с `async for` и `asyncio.sleep`;
  2. Либо заменить постоянный SSE на периодический короткий polling (или WebSocket).

#### SEC-08: Полный пересчёт лидерборда на каждый `GET /standings/`
* **Файл:** [backend/judge/views.py](file:///data/data/com.termux/files/home/OpenContest/backend/judge/views.py#L709-L730) и [backend/judge/standings.py](file:///data/data/com.termux/files/home/OpenContest/backend/judge/standings.py#L7-L74).
* **Описание:** При каждом обращении к эндпоинту `standings` вызывается `recompute_contest_standings(contest)`. Внутри функции:
  - Выполняется N+1 SQL-запросов к таблице `Submission`;
  - Полностью удаляются (`delete()`) все записи `StandingsRow` для данного контеста;
  - Заново рассчитываются и вставляются все строки через `bulk_create`.
* **Угроза:** При одновременном открытии таблицы результатов 50 участниками возникают взаимные блокировки (deadlocks) в PostgreSQL, 100% загрузка CPU базы данных и падение сервиса. При этом результаты уже асинхронно пересчитываются воркером `process_results`.
* **Решение:** Полностью удалить вызов `recompute_contest_standings(contest)` из эндпоинта `standings`. Эндпоинт должен просто читать уже сохранённые в БД строки `contest.standings.all()`.

#### SEC-09: Отсутствие ограничения частоты запросов (Rate Limiting)
* **Файл:** [backend/opencontest/settings.py](file:///data/data/com.termux/files/home/OpenContest/backend/opencontest/settings.py#L88).
* **Описание:** В `REST_FRAMEWORK` не настроены классы `DEFAULT_THROTTLE_CLASSES`.
* **Угроза:** Участники могут спамить посылками (сотни в секунду), заполняя очередь RabbitMQ и блокируя проверку других участников. Также возможен брутфорс паролей на `/api/auth/login/`.
* **Решение:** Настроить троттлинг в `settings.py`:
  ```python
  REST_FRAMEWORK = {
      ...
      "DEFAULT_THROTTLE_CLASSES": [
          "rest_framework.throttling.AnonRateThrottle",
          "rest_framework.throttling.UserRateThrottle",
      ],
      "DEFAULT_THROTTLE_RATES": {
          "anon": "60/minute",
          "user": "300/minute",
          "submissions": "10/minute",
      },
  }
  ```

---

### 2.4. Конфигурация и секреты

#### SEC-10: `DEBUG = True` и статические секреты по умолчанию
* **Файл:** [backend/opencontest/settings.py](file:///data/data/com.termux/files/home/OpenContest/backend/opencontest/settings.py#L7-L9).
* **Описание:** Переменная `DJANGO_DEBUG` по умолчанию равна `"1"`, `DJANGO_SECRET_KEY` имеет дефолт `"dev-opencontest-secret"`, а токен раннера — `"dev-runner-token"`.
* **Угроза:** В продакшне при возникновении любой ошибки Django вернёт полную отладочную страницу с дампом переменных окружения, паролями к БД и путями к файлам.
* **Решение:** Запретить запуск в проде без явного указания `DJANGO_SECRET_KEY` и переключать `DEBUG` в `False` по умолчанию.

---

## 3. Рекомендуемый план устранения (Roadmap)

### Фаза 1: Немедленные исправления (Quick Wins)
1. **Удалить вызов `recompute_contest_standings` из `def standings`** ([views.py](file:///data/data/com.termux/files/home/OpenContest/backend/judge/views.py#L713)).
2. **Закрыть доступ к задачам предстоящих контестов** ([views.py](file:///data/data/com.termux/files/home/OpenContest/backend/judge/views.py#L290-L306)).
3. **Исключить `checker_code` из публичного API** ([serializers.py](file:///data/data/com.termux/files/home/OpenContest/backend/judge/serializers.py#L103)).
4. **Добавить валидацию времени отправки посылок** ([views.py](file:///data/data/com.termux/files/home/OpenContest/backend/judge/views.py#L404)).

### Фаза 2: Укрепление изоляции (Runner & Sandbox)
1. Изолировать запуск компиляторов в `nsjail` с лимитом памяти (1 ГБ) и времени (30 сек).
2. Настроить запуск бинарников от непривилегированного пользователя в раннере.
3. Вынести генерацию тестов (`generate_tests`) в очередь раннеров.

### Фаза 3: Отказоустойчивость инфраструктуры
1. Перевести веб-сервер на ASGI / запустить стримы через асинхронные обработчики во избежание блокировки воркеров Gunicorn.
2. Подключить `DRF Throttling` для защиты от брутфорса и спама посылками.
