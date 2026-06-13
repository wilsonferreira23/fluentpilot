param(
  [string]$TargetDir = "$HOME\fluentpilot-estudos"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AgentDir = "$HOME\.config\opencode\agents"

New-Item -ItemType Directory -Force $AgentDir | Out-Null
Copy-Item "$ScriptDir\global-agent\fluentpilot.md" "$AgentDir\fluentpilot.md" -Force

if (Test-Path $TargetDir) {
  throw "O diretório já existe: $TargetDir. Copie manualmente para não sobrescrever seu progresso."
}

Copy-Item "$ScriptDir\project-template" $TargetDir -Recurse
New-Item -ItemType Directory -Force "$TargetDir\legendas" | Out-Null

Write-Host "FluentPilot instalado."
Write-Host "Projeto: $TargetDir"
Write-Host "Abra com: Set-Location '$TargetDir'; opencode"
