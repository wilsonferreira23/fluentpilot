param(
  [string]$TargetDir = "$HOME\fluentpilot-estudos"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigDirs = @("$HOME\.config\opencode")
$AccomplishConfigDir = "$HOME\Library\Application Support\Accomplish\opencode"

if (Test-Path $AccomplishConfigDir) {
  $ConfigDirs += $AccomplishConfigDir
}

foreach ($ConfigDir in $ConfigDirs) {
  $AgentDir = Join-Path $ConfigDir "agents"
  $ToolDir = Join-Path $ConfigDir "tools"
  New-Item -ItemType Directory -Force $AgentDir | Out-Null
  New-Item -ItemType Directory -Force $ToolDir | Out-Null
  Copy-Item "$ScriptDir\global-agent\fluentpilot.md" "$AgentDir\fluentpilot.md" -Force
  Copy-Item "$ScriptDir\project-template\.opencode\tools\*.ts" $ToolDir -Force
  $OldAgent = Join-Path $AgentDir "ingles-em-contexto.md"
  if (Test-Path $OldAgent) {
    Remove-Item $OldAgent -Force
  }
}

if (Test-Path $TargetDir) {
  Write-Host "Atualizando projeto existente sem apagar progresso: $TargetDir"
  New-Item -ItemType Directory -Force "$TargetDir\.opencode\tools" | Out-Null
  Copy-Item "$ScriptDir\project-template\.opencode\tools\*.ts" "$TargetDir\.opencode\tools" -Force
  Copy-Item "$ScriptDir\project-template\AGENTS.md" "$TargetDir\AGENTS.md" -Force
  Copy-Item "$ScriptDir\project-template\MEMORY_RULES.md" "$TargetDir\MEMORY_RULES.md" -Force
  Copy-Item "$ScriptDir\project-template\opencode.json" "$TargetDir\opencode.json" -Force
  if (Test-Path "$ScriptDir\project-template\.opencode\package.json") {
    Copy-Item "$ScriptDir\project-template\.opencode\package.json" "$TargetDir\.opencode\package.json" -Force
  }
} else {
  Copy-Item "$ScriptDir\project-template" $TargetDir -Recurse
  New-Item -ItemType Directory -Force "$TargetDir\legendas" | Out-Null
}

Write-Host "FluentPilot instalado."
Write-Host "Projeto: $TargetDir"
foreach ($ConfigDir in $ConfigDirs) {
  Write-Host "Agente global: $ConfigDir\agents\fluentpilot.md"
  Write-Host "Tools globais: $ConfigDir\tools"
}
Write-Host "Abra com: Set-Location '$TargetDir'; opencode"
Write-Host "No OpenCode, selecione o agente fluentpilot e diga: diagnostico"
