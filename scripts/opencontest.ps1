param(
  [ValidateSet("start", "seed", "reset", "restart", "stop", "status", "requeue", "k8s-start", "k8s-seed", "k8s-reset", "k8s-stop", "k8s-requeue")]
  [string]$Action = "start",

  [switch]$ResetData,
  [switch]$NoBuild,
  [switch]$NoPortForward
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Namespace = "opencontest"

function Require-Command {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is not installed or is not available in PATH."
  }
}

function Require-Docker {
  Require-Command "docker"
  docker info *> $null
}

function Require-Kubectl {
  Require-Command "kubectl"
  kubectl version --client *> $null
}

function Compose {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
  Push-Location $Root
  try {
    & docker compose @Args
  } finally {
    Pop-Location
  }
}

function Wait-ComposeBackend {
  Write-Host "Waiting for backend health..." -ForegroundColor Yellow
  for ($i = 1; $i -le 60; $i++) {
    try {
      $status = Compose ps --format json backend | ConvertFrom-Json
      if ($status.Health -eq "healthy") {
        return
      }
    } catch {
      try {
        Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:8000/api/health/" -TimeoutSec 2 *> $null
        return
      } catch {
        Start-Sleep -Seconds 2
        continue
      }
    }
    Start-Sleep -Seconds 2
  }
  throw "Backend did not become ready in time. Run: docker compose logs backend"
}

function Seed-Compose {
  param([switch]$Reset)

  Wait-ComposeBackend
  Write-Host "Applying migrations..." -ForegroundColor Cyan
  Compose exec -T backend python manage.py migrate

  if ($Reset) {
    Write-Host "Resetting and loading demo data..." -ForegroundColor Cyan
    Compose exec -T backend python manage.py seed --reset
  } else {
    Write-Host "Loading demo data..." -ForegroundColor Cyan
    Compose exec -T backend python manage.py seed
  }
}

function Show-LocalUrls {
  Write-Host ""
  Write-Host "OpenContest is ready." -ForegroundColor Green
  Write-Host "Frontend:    http://localhost:5173"
  Write-Host "Backend API: http://localhost:8000/api"
  Write-Host "RabbitMQ UI: http://localhost:15672 (guest/guest)"
  Write-Host ""
  Write-Host "Useful commands:"
  Write-Host "  .\scripts\opencontest.ps1 reset      # clean DB volume, rebuild, migrate, seed --reset"
  Write-Host "  .\scripts\opencontest.ps1 seed       # migrate and seed current DB"
  Write-Host "  .\scripts\opencontest.ps1 stop       # stop local containers"
}

function Stop-PortForwards {
  Get-CimInstance Win32_Process -Filter "name = 'kubectl.exe'" |
    Where-Object { $_.CommandLine -like "*port-forward*opencontest*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
}

function Install-Keda {
  Write-Host "Installing/updating KEDA..." -ForegroundColor Cyan
  kubectl apply --server-side --force-conflicts -f "https://github.com/kedacore/keda/releases/download/v2.13.0/keda-2.13.0.yaml"
  kubectl wait --for=condition=available deployment/keda-operator -n keda --timeout=180s
}

function Build-Images {
  if ($NoBuild) {
    Write-Host "Skipping image build because -NoBuild was passed." -ForegroundColor Gray
    return
  }

  Push-Location $Root
  try {
    Write-Host "Building backend image..." -ForegroundColor Cyan
    docker build -t opencontest-backend:latest .\backend
    Write-Host "Building frontend image..." -ForegroundColor Cyan
    docker build -t opencontest-frontend:latest .\frontend
    Write-Host "Building runner image..." -ForegroundColor Cyan
    docker build -t opencontest-runner:latest .\runners\go-runner
  } finally {
    Pop-Location
  }
}

function Load-MinikubeImages {
  if (-not (Get-Command minikube -ErrorAction SilentlyContinue)) {
    return
  }

  $status = minikube status --format "{{.Host}}" 2>$null
  if ($status -eq "Running") {
    Write-Host "Loading images into Minikube..." -ForegroundColor Cyan
    minikube image load opencontest-backend:latest
    minikube image load opencontest-frontend:latest
    minikube image load opencontest-runner:latest
  }
}

function Wait-K8sCore {
  Write-Host "Waiting for core pods..." -ForegroundColor Yellow
  kubectl wait --for=condition=ready pod -l app=postgres -n $Namespace --timeout=180s
  kubectl wait --for=condition=ready pod -l app=rabbitmq -n $Namespace --timeout=180s
  kubectl wait --for=condition=available deployment/backend -n $Namespace --timeout=180s
  kubectl wait --for=condition=available deployment/frontend -n $Namespace --timeout=180s
}

function Restart-K8sWorkloads {
  if ($NoBuild) {
    return
  }

  Write-Host "Restarting Kubernetes workloads to pick up rebuilt :latest images..." -ForegroundColor Cyan
  kubectl rollout restart deployment/backend -n $Namespace
  kubectl rollout restart deployment/frontend -n $Namespace
  kubectl rollout restart deployment/runner -n $Namespace
}

function Seed-K8s {
  param([switch]$Reset)

  $jobName = "backend-seed"
  kubectl delete job $jobName -n $Namespace --ignore-not-found

  $seedArgs = if ($Reset) { "seed --reset" } else { "seed" }
  $manifest = @"
apiVersion: batch/v1
kind: Job
metadata:
  name: $jobName
  namespace: $Namespace
spec:
  backoffLimit: 2
  template:
    spec:
      restartPolicy: OnFailure
      containers:
        - name: seed
          image: opencontest-backend:latest
          imagePullPolicy: IfNotPresent
          command: ["sh", "-c", "python manage.py migrate && python manage.py $seedArgs"]
          envFrom:
            - configMapRef:
                name: opencontest-config
            - secretRef:
                name: opencontest-secrets
"@

  Write-Host "Running Kubernetes DB seed job..." -ForegroundColor Cyan
  $manifest | kubectl apply -f -
  kubectl wait --for=condition=complete job/$jobName -n $Namespace --timeout=180s
}

function Start-PortForwards {
  if ($NoPortForward) {
    return
  }

  Write-Host "Starting port-forwards..." -ForegroundColor Green
  Stop-PortForwards

  Start-Process kubectl -WindowStyle Hidden -ArgumentList "port-forward svc/frontend 5173:80 -n $Namespace"
  Start-Process kubectl -WindowStyle Hidden -ArgumentList "port-forward svc/backend 8000:8000 -n $Namespace"
  Start-Process kubectl -WindowStyle Hidden -ArgumentList "port-forward svc/rabbitmq 15672:15672 -n $Namespace"
}

function Show-K8sUrls {
  Write-Host ""
  Write-Host "OpenContest Kubernetes is ready." -ForegroundColor Green
  Write-Host "Frontend:    http://localhost:5173"
  Write-Host "Backend API: http://localhost:8000/api"
  Write-Host "RabbitMQ UI: http://localhost:15672 (guest/guest)"
  Write-Host "Runner limit: 50 pods via KEDA"
}

switch ($Action) {
  "start" {
    Require-Docker
    Stop-PortForwards
    $upArgs = @("up", "-d")
    if (-not $NoBuild) { $upArgs += "--build" }
    Compose @upArgs
    Seed-Compose -Reset:$ResetData
    Show-LocalUrls
  }
  "seed" {
    Require-Docker
    Seed-Compose -Reset:$ResetData
  }
  "reset" {
    Require-Docker
    Stop-PortForwards
    Compose down -v --remove-orphans
    $upArgs = @("up", "-d")
    if (-not $NoBuild) { $upArgs += "--build" }
    Compose @upArgs
    Seed-Compose -Reset
    Show-LocalUrls
  }
  "restart" {
    Require-Docker
    Stop-PortForwards
    Compose down --remove-orphans
    $upArgs = @("up", "-d")
    if (-not $NoBuild) { $upArgs += "--build" }
    Compose @upArgs
    Seed-Compose -Reset:$ResetData
    Show-LocalUrls
  }
  "stop" {
    Require-Docker
    Compose down --remove-orphans
  }
  "status" {
    Require-Docker
    Compose ps
  }
  "requeue" {
    Require-Docker
    Wait-ComposeBackend
    Compose exec -T backend python manage.py requeue_pending
  }
  "k8s-start" {
    Require-Docker
    Require-Kubectl
    Build-Images
    Load-MinikubeImages
    Install-Keda
    kubectl delete job backend-migrate -n $Namespace --ignore-not-found
    Push-Location $Root
    try {
      kubectl apply -k deploy/k8s
    } finally {
      Pop-Location
    }
    Restart-K8sWorkloads
    Wait-K8sCore
    Seed-K8s -Reset:$ResetData
    Start-PortForwards
    Show-K8sUrls
  }
  "k8s-seed" {
    Require-Kubectl
    Seed-K8s -Reset:$ResetData
  }
  "k8s-requeue" {
    Require-Kubectl
    kubectl exec -n $Namespace deploy/backend -- python manage.py requeue_pending
  }
  "k8s-reset" {
    Require-Docker
    Require-Kubectl
    kubectl delete namespace $Namespace --ignore-not-found
    Build-Images
    Load-MinikubeImages
    Install-Keda
    kubectl delete job backend-migrate -n $Namespace --ignore-not-found
    Push-Location $Root
    try {
      kubectl apply -k deploy/k8s
    } finally {
      Pop-Location
    }
    Wait-K8sCore
    Seed-K8s -Reset
    Start-PortForwards
    Show-K8sUrls
  }
  "k8s-stop" {
    Require-Kubectl
    kubectl delete namespace $Namespace --ignore-not-found
  }
}
