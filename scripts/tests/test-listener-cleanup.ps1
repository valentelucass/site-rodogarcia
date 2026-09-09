[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('Development', 'Production')]
  [string]$Mode,

  [Parameter(Mandatory = $true)]
  [ValidateSet('empty', 'other-environment', 'both-environments', 'failure', 'query-failure', 'still-listening')]
  [string]$Scenario
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Os comandos de processos sao simulados: este teste nunca consulta ou encerra um PID real.
$targetPorts = if ($Mode -eq 'Development') {
  @(31012, 31013, 35180, 35013, 36110, 35112)
} else {
  @(6050, 6051, 6060, 6061, 41110, 41112)
}
$otherPorts = if ($Mode -eq 'Development') {
  @(6050, 6051, 6060, 6061, 41110, 41112)
} else {
  @(31012, 31013, 35180, 35013, 36110, 35112)
}
$global:listenerCleanupFixture = @{
  Listeners = @()
  StoppedProcessIds = @()
  ExpectedProcessIds = @()
  ProtectedProcessIds = @()
  QueryCount = 0
  Scenario = $Scenario
}

if ($Scenario -ne 'empty') {
  foreach ($port in @($otherPorts + @(5010, 5173, 19090, 18081, 18080))) {
    $global:listenerCleanupFixture.Listeners += [pscustomobject]@{ State = 'Listen'; LocalPort = $port; OwningProcess = $port + 100000 }
    $global:listenerCleanupFixture.ProtectedProcessIds += $port + 100000
  }
}
if ($Scenario -in @('both-environments', 'failure', 'still-listening')) {
  foreach ($port in $targetPorts) {
    # Simula listeners IPv4/IPv6 pertencentes ao mesmo processo.
    $global:listenerCleanupFixture.Listeners += [pscustomobject]@{ State = 'Listen'; LocalPort = $port; OwningProcess = $port }
    $global:listenerCleanupFixture.Listeners += [pscustomobject]@{ State = 'Listen'; LocalPort = $port; OwningProcess = $port }
    $global:listenerCleanupFixture.ExpectedProcessIds += $port
  }
}

function Get-NetTCPConnection {
  [CmdletBinding()]
  param()

  $global:listenerCleanupFixture.QueryCount++
  if ($global:listenerCleanupFixture.Scenario -eq 'query-failure') {
    Write-Error 'Consulta simulada falhou.'
    return
  }
  $global:listenerCleanupFixture.Listeners
  # Conexoes estabelecidas nas mesmas portas nunca sao alvo de encerramento.
  foreach ($port in $targetPorts) {
    [pscustomobject]@{ State = 'Established'; LocalPort = $port; OwningProcess = 999999 }
  }
}

function Start-Sleep {
  param([int]$Milliseconds)
  if ($Milliseconds -ne 250) { throw 'Intervalo inesperado na espera por portas livres.' }
}

function taskkill.exe {
  $processId = [int]$args[1]
  if ($args.Count -ne 4 -or $args[0] -ne '/PID' -or $args[2] -ne '/T' -or $args[3] -ne '/F') {
    throw 'Argumentos inesperados para taskkill.'
  }
  if ($processId -notin $global:listenerCleanupFixture.ExpectedProcessIds -or $processId -in $global:listenerCleanupFixture.StoppedProcessIds) {
    throw 'Tentativa de encerrar processo de outro ambiente, externo ou ja encerrado.'
  }
  if ($global:listenerCleanupFixture.Scenario -eq 'failure') {
    $global:LASTEXITCODE = 1
    return
  }
  $global:listenerCleanupFixture.StoppedProcessIds += $processId
  if ($global:listenerCleanupFixture.Scenario -ne 'still-listening') {
    $global:listenerCleanupFixture.Listeners = @($global:listenerCleanupFixture.Listeners | Where-Object { $_.OwningProcess -ne $processId })
  }
  $global:LASTEXITCODE = 0
}

& (Join-Path $PSScriptRoot '../stop-rodogarcia-listeners.ps1') -Mode $Mode
if (-not $?) { exit 1 }

if ($global:listenerCleanupFixture.QueryCount -eq 0) {
  throw 'A consulta simulada nao foi executada.'
}
if ($global:listenerCleanupFixture.StoppedProcessIds.Count -ne $global:listenerCleanupFixture.ExpectedProcessIds.Count) {
  throw 'A limpeza nao encerrou exatamente os processos esperados do ambiente selecionado.'
}
foreach ($protectedProcessId in $global:listenerCleanupFixture.ProtectedProcessIds) {
  if ($protectedProcessId -notin $global:listenerCleanupFixture.Listeners.OwningProcess) {
    throw 'A limpeza alterou um processo protegido.'
  }
}
