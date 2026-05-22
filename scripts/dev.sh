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

docker compose up --build
