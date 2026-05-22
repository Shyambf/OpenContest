#!/usr/bin/env bash
set -Eeuo pipefail

ACTION="${1:-start}"
NAMESPACE="${OPENCONTEST_NAMESPACE:-opencontest}"
PROFILE="${OPENCONTEST_MINIKUBE_PROFILE:-opencontest}"
KEDA_VERSION="${OPENCONTEST_KEDA_VERSION:-2.13.0}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$ROOT/.k8s-port-forwards"

NO_BUILD="${OPENCONTEST_NO_BUILD:-0}"
NO_PORT_FORWARD="${OPENCONTEST_NO_PORT_FORWARD:-0}"
NO_KEDA="${OPENCONTEST_NO_KEDA:-0}"
FRONTEND_PORT="${OPENCONTEST_FRONTEND_PORT:-5173}"
BACKEND_PORT="${OPENCONTEST_BACKEND_PORT:-8000}"
RABBITMQ_UI_PORT="${OPENCONTEST_RABBITMQ_UI_PORT:-15672}"

usage() {
  cat <<EOF
OpenContest Kubernetes for WSL Debian

Usage:
  ./scripts/opencontest-k8s-wsl.sh start      Build images, start minikube, deploy, seed, port-forward
  ./scripts/opencontest-k8s-wsl.sh reset      Delete namespace, rebuild, deploy, seed --reset
  ./scripts/opencontest-k8s-wsl.sh seed       Run migrations and seed current database
  ./scripts/opencontest-k8s-wsl.sh requeue    Requeue stuck submissions
  ./scripts/opencontest-k8s-wsl.sh status     Show minikube, pods and services
  ./scripts/opencontest-k8s-wsl.sh logs       Tail backend, frontend, runner logs
  ./scripts/opencontest-k8s-wsl.sh forward    Restart localhost port-forwards only
  ./scripts/opencontest-k8s-wsl.sh stop       Stop port-forwards and delete namespace
  ./scripts/opencontest-k8s-wsl.sh minikube-stop

Environment flags:
  OPENCONTEST_NO_BUILD=1          Skip docker image builds
  OPENCONTEST_NO_PORT_FORWARD=1   Do not open localhost forwards
  OPENCONTEST_NO_KEDA=1           Deploy runner without KEDA autoscaling
  OPENCONTEST_MINIKUBE_PROFILE=...  Default: opencontest
  OPENCONTEST_FRONTEND_PORT=5174  Override local frontend port
  OPENCONTEST_BACKEND_PORT=8001   Override local backend API port
  OPENCONTEST_RABBITMQ_UI_PORT=15673
                                  Override local RabbitMQ UI port

Local URLs after start:
  Frontend:    http://localhost:${FRONTEND_PORT}
  Backend API: http://localhost:${BACKEND_PORT}/api
  RabbitMQ UI: http://localhost:${RABBITMQ_UI_PORT} (guest/guest)
EOF
}

log() {
  printf '\033[1;36m==>\033[0m %s\n' "$*"
}

warn() {
  printf '\033[1;33mWARN:\033[0m %s\n' "$*" >&2
}

die() {
  printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command '$1' is missing."
}

require_tools() {
  need_cmd docker
  need_cmd kubectl
  need_cmd minikube
  docker info >/dev/null 2>&1 || die "Docker daemon is not available from WSL. Start Docker Desktop with WSL integration, or start Docker Engine inside Debian."
}

start_minikube() {
  require_tools
  if minikube -p "$PROFILE" status --format '{{.Host}}' 2>/dev/null | grep -qx 'Running'; then
    log "Minikube profile '$PROFILE' is already running."
    return
  fi

  log "Starting minikube profile '$PROFILE' with docker driver."
  minikube start -p "$PROFILE" --driver=docker --container-runtime=docker --cpus="${OPENCONTEST_CPUS:-4}" --memory="${OPENCONTEST_MEMORY:-6144}" --addons=ingress
}

use_minikube_context() {
  kubectl config use-context "$PROFILE" >/dev/null
}

install_keda() {
  if [[ "$NO_KEDA" == "1" ]]; then
    warn "OPENCONTEST_NO_KEDA=1, skipping KEDA installation."
    return
  fi

  log "Installing/updating KEDA $KEDA_VERSION."
  kubectl apply --server-side --force-conflicts -f "https://github.com/kedacore/keda/releases/download/v${KEDA_VERSION}/keda-${KEDA_VERSION}.yaml"
  kubectl wait --for=condition=available deployment/keda-operator -n keda --timeout=180s
}

build_images() {
  if [[ "$NO_BUILD" == "1" ]]; then
    warn "OPENCONTEST_NO_BUILD=1, skipping image builds."
    return
  fi

  log "Building images directly inside minikube Docker."
  eval "$(minikube -p "$PROFILE" docker-env)"
  docker build -t opencontest-backend:latest "$ROOT/backend"
  docker build -t opencontest-frontend:latest "$ROOT/frontend"
  docker build -t opencontest-runner:latest "$ROOT/runners/go-runner"
  eval "$(minikube -p "$PROFILE" docker-env -u)"
}

apply_manifests() {
  log "Applying Kubernetes manifests."
  kubectl delete job backend-migrate -n "$NAMESPACE" --ignore-not-found >/dev/null 2>&1 || true

  if [[ "$NO_KEDA" == "1" ]]; then
    kubectl apply -f "$ROOT/deploy/k8s/00-namespace.yaml"
    kubectl apply -f "$ROOT/deploy/k8s/01-config.yaml"
    kubectl apply -f "$ROOT/deploy/k8s/10-postgres.yaml"
    kubectl apply -f "$ROOT/deploy/k8s/11-rabbitmq.yaml"
    kubectl apply -f "$ROOT/deploy/k8s/20-backend.yaml"
    kubectl apply -f "$ROOT/deploy/k8s/21-frontend.yaml"
    kubectl apply -f "$ROOT/deploy/k8s/22-runner.yaml"
    kubectl apply -f "$ROOT/deploy/k8s/30-ingress.yaml"
  else
    kubectl apply -k "$ROOT/deploy/k8s"
  fi
}

wait_core() {
  log "Waiting for core pods."
  kubectl wait --for=condition=ready pod -l app=postgres -n "$NAMESPACE" --timeout=240s
  kubectl wait --for=condition=ready pod -l app=rabbitmq -n "$NAMESPACE" --timeout=240s
  kubectl wait --for=condition=available deployment/backend -n "$NAMESPACE" --timeout=240s
  kubectl wait --for=condition=available deployment/frontend -n "$NAMESPACE" --timeout=240s
  kubectl wait --for=condition=available deployment/runner -n "$NAMESPACE" --timeout=240s || true
}

seed_k8s() {
  local reset="${1:-0}"
  local job_name="backend-seed"
  local seed_args="seed"

  if [[ "$reset" == "1" ]]; then
    seed_args="seed --reset"
  fi

  log "Running migrations and '$seed_args'."
  kubectl delete job "$job_name" -n "$NAMESPACE" --ignore-not-found >/dev/null
  cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: ${job_name}
  namespace: ${NAMESPACE}
spec:
  backoffLimit: 2
  template:
    spec:
      restartPolicy: OnFailure
      containers:
        - name: seed
          image: opencontest-backend:latest
          imagePullPolicy: IfNotPresent
          command: ["sh", "-c", "python manage.py migrate && python manage.py ${seed_args}"]
          envFrom:
            - configMapRef:
                name: opencontest-config
            - secretRef:
                name: opencontest-secrets
EOF
  kubectl wait --for=condition=complete job/"$job_name" -n "$NAMESPACE" --timeout=240s
}

stop_forwards() {
  if [[ ! -d "$PID_DIR" ]]; then
    return
  fi
  for pid_file in "$PID_DIR"/*.pid; do
    [[ -f "$pid_file" ]] || continue
    local pid
    pid="$(cat "$pid_file")"
    if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
    rm -f "$pid_file"
  done
}

port_forward() {
  if [[ "$NO_PORT_FORWARD" == "1" ]]; then
    warn "OPENCONTEST_NO_PORT_FORWARD=1, skipping localhost port-forwards."
    return
  fi

  log "Starting port-forwards in background."
  stop_forwards
  mkdir -p "$PID_DIR"

  kubectl -n "$NAMESPACE" port-forward svc/frontend "${FRONTEND_PORT}:80" >"$PID_DIR/frontend.log" 2>&1 &
  echo "$!" >"$PID_DIR/frontend.pid"

  kubectl -n "$NAMESPACE" port-forward svc/backend "${BACKEND_PORT}:8000" >"$PID_DIR/backend.log" 2>&1 &
  echo "$!" >"$PID_DIR/backend.pid"

  kubectl -n "$NAMESPACE" port-forward svc/rabbitmq "${RABBITMQ_UI_PORT}:15672" >"$PID_DIR/rabbitmq.log" 2>&1 &
  echo "$!" >"$PID_DIR/rabbitmq.pid"

  sleep 2
}

show_urls() {
  cat <<EOF

OpenContest Kubernetes is ready.
Frontend:    http://localhost:${FRONTEND_PORT}
Backend API: http://localhost:${BACKEND_PORT}/api
RabbitMQ UI: http://localhost:${RABBITMQ_UI_PORT} (guest/guest)

Useful commands:
  ./scripts/opencontest-k8s-wsl.sh status
  ./scripts/opencontest-k8s-wsl.sh logs
  ./scripts/opencontest-k8s-wsl.sh reset
  ./scripts/opencontest-k8s-wsl.sh stop
EOF
}

status() {
  require_tools
  use_minikube_context
  minikube -p "$PROFILE" status || true
  kubectl get pods,svc -n "$NAMESPACE" -o wide || true
  if [[ -d "$PID_DIR" ]]; then
    log "Port-forward logs are in $PID_DIR"
  fi
}

logs() {
  require_tools
  use_minikube_context
  kubectl logs -n "$NAMESPACE" deploy/backend --tail=80 || true
  kubectl logs -n "$NAMESPACE" deploy/frontend --tail=40 || true
  kubectl logs -n "$NAMESPACE" deploy/runner --tail=80 || true
}

requeue() {
  require_tools
  use_minikube_context
  kubectl exec -n "$NAMESPACE" deploy/backend -- python manage.py requeue_pending
}

start() {
  start_minikube
  use_minikube_context
  install_keda
  build_images
  apply_manifests
  wait_core
  seed_k8s 0
  port_forward
  show_urls
}

reset() {
  start_minikube
  use_minikube_context
  stop_forwards
  log "Deleting namespace '$NAMESPACE'."
  kubectl delete namespace "$NAMESPACE" --ignore-not-found
  build_images
  install_keda
  apply_manifests
  wait_core
  seed_k8s 1
  port_forward
  show_urls
}

stop() {
  require_tools
  use_minikube_context
  stop_forwards
  log "Deleting namespace '$NAMESPACE'."
  kubectl delete namespace "$NAMESPACE" --ignore-not-found
}

case "$ACTION" in
  start) start ;;
  reset) reset ;;
  seed) require_tools; use_minikube_context; seed_k8s 0 ;;
  requeue) requeue ;;
  status) status ;;
  logs) logs ;;
  forward) require_tools; use_minikube_context; port_forward; show_urls ;;
  stop) stop ;;
  minikube-stop) require_tools; stop_forwards; minikube -p "$PROFILE" stop ;;
  help|-h|--help) usage ;;
  *) usage; die "Unknown action: $ACTION" ;;
esac
