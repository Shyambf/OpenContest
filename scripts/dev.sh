#!/usr/bin/env sh
set -eu

echo "Starting OpenContest locally with Docker Compose..."

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed. Install Docker Desktop or Docker Engine first."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is installed, but the Docker daemon is not running."
  echo "Start Docker Desktop or the Docker service, then run this script again."
  exit 1
fi

# Load .env if present
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

# Support RUNNER_REPLICAS or RUNNER_COUNT as aliases for RUNNERS_COUNT
if [ -z "${RUNNERS_COUNT:-}" ]; then
  if [ -n "${RUNNER_REPLICAS:-}" ]; then
    export RUNNERS_COUNT="$RUNNER_REPLICAS"
  elif [ -n "${RUNNER_COUNT:-}" ]; then
    export RUNNERS_COUNT="$RUNNER_COUNT"
  fi
fi

docker compose up --build "$@"
