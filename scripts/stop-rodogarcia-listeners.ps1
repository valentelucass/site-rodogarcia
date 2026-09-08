[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('Development', 'Production', 'All')]
  [string]$Mode
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$developmentPorts = @(31012, 31013, 35180, 35013, 36110, 35112)
$productionPorts = @(6050, 6051, 6060, 6061, 41110, 41112)
$portNumbers = switch ($Mode) {
  'Development' { $developmentPorts }
  'Production' { $productionPorts }
  'All' { @($developmentPorts + $productionPorts) }
}

function Get-ManagedListeners {
  @(
    Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
      Where-Object { $portNumbers -contains $_.LocalPort }
  )
}

$listeners = Get-ManagedListeners
if ($listeners.Count -eq 0) {
  Write-Output "[Rodogarcia] Nenhuma porta $Mode estava em uso."
  exit 0
}

foreach ($group in ($listeners | Group-Object OwningProcess)) {
  $processId = [int]$group.Name
  $portsInUse = ($group.Group | ForEach-Object LocalPort | Sort-Object -Unique) -join ', '
  Write-Output "[Rodogarcia] Encerrando PID $processId nas portas $portsInUse."

  & taskkill.exe /PID $processId /T /F *> $null
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Nao foi possivel encerrar o PID $processId nas portas $portsInUse."
  }
}

for ($attempt = 0; $attempt -lt 20; $attempt++) {
  $remainingListeners = Get-ManagedListeners
  if ($remainingListeners.Count -eq 0) {
    exit 0
  }

  Start-Sleep -Milliseconds 250
}

$remainingPorts = (Get-ManagedListeners | ForEach-Object LocalPort | Sort-Object -Unique) -join ', '
Write-Error "As portas Rodogarcia ainda estao em uso: $remainingPorts."
exit 1
