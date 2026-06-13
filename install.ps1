param(
  [string]$TargetDir = "$HOME\fluentpilot-estudos"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AgentDir = "$HOME\.config\opencode\agents"
$ToolDir = "$HOME\.config\opencode\tools"

New-Item -ItemType Directory -Force $AgentDir | Out-Null
New-Item -ItemType Directory -Force $ToolDir | Out-Null
Copy-Item "$ScriptDir\global-agent\fluentpilot.md" "$AgentDir\fluentpilot.md" -Force
Copy-Item "$ScriptDir\project-template\.opencode\tools\*.ts" $ToolDir -Force
$OldAgent = "$AgentDir\ingles-em-contexto.md"
if (Test-Path $OldAgent) {
  Remove-Item $OldAgent -Force
}

if (Test-Path $TargetDir) {
  throw "O diretório já existe: $TargetDir. Copie manualmente para não sobrescrever seu progresso."
}

Copy-Item "$ScriptDir\project-template" $TargetDir -Recurse
New-Item -ItemType Directory -Force "$TargetDir\legendas" | Out-Null

Write-Host "FluentPilot instalado."
Write-Host "Projeto: $TargetDir"
Write-Host "Agente global: $AgentDir\fluentpilot.md"
Write-Host "Tools globais: $ToolDir"
Write-Host "Agente antigo removido, se existia: $OldAgent"
Write-Host "Abra com: Set-Location '$TargetDir'; opencode"
Write-Host "No OpenCode, selecione o agente fluentpilot e diga: diagnostico"
