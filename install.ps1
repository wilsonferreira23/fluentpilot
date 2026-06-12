param(
  [string]$TargetDir = "$HOME\ingles-em-contexto-estudos"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AgentDir = "$HOME\.config\opencode\agents"

New-Item -ItemType Directory -Force $AgentDir | Out-Null
Copy-Item "$ScriptDir\global-agent\ingles-em-contexto.md" "$AgentDir\ingles-em-contexto.md" -Force

if (Test-Path $TargetDir) {
  throw "O diretório já existe: $TargetDir. Copie manualmente para não sobrescrever seu progresso."
}

Copy-Item "$ScriptDir\project-template" $TargetDir -Recurse
New-Item -ItemType Directory -Force "$TargetDir\legendas" | Out-Null

Write-Host "Inglês em Contexto V1 instalado."
Write-Host "Projeto: $TargetDir"
Write-Host "Abra com: Set-Location '$TargetDir'; opencode"
