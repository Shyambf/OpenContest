param(
  [switch]$ResetData,
  [switch]$NoBuild,
  [switch]$NoPortForward
)

$script = Join-Path $PSScriptRoot "scripts\opencontest.ps1"
& $script k8s-start -ResetData:$ResetData -NoBuild:$NoBuild -NoPortForward:$NoPortForward
