$ErrorActionPreference = "Stop"

Write-Host "Starting OpenContest locally with Docker Compose..."

$dockerVersion = docker --version
Write-Host $dockerVersion

try {
  docker info *> $null
} catch {
  Write-Host "Docker is installed, but the Docker daemon is not running."
  Write-Host "Start Docker Desktop, then run this script again."
  exit 1
}

docker compose up --build
