[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$JavaExecutable
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($JavaExecutable) -or -not (Test-Path -LiteralPath $JavaExecutable -PathType Leaf)) {
  Write-Error '[Rodogarcia PROD] Executavel Java nao encontrado para o pre-flight.'
  exit 1
}

$processInfo = [Diagnostics.ProcessStartInfo]::new()
$processInfo.FileName = $JavaExecutable
$processInfo.Arguments = '-version'
$processInfo.UseShellExecute = $false
$processInfo.CreateNoWindow = $true
$processInfo.RedirectStandardOutput = $true
$processInfo.RedirectStandardError = $true
$process = [Diagnostics.Process]::new()
$process.StartInfo = $processInfo
[void]$process.Start()
$standardOutput = $process.StandardOutput.ReadToEnd()
$standardError = $process.StandardError.ReadToEnd()
$process.WaitForExit()

if ($process.ExitCode -ne 0) {
  Write-Error "[Rodogarcia PROD] Nao foi possivel executar o Java configurado: $JavaExecutable"
  exit 1
}

$versionMatch = [regex]::Match("$standardOutput`n$standardError", 'version "(?<major>\d+)')
if (-not $versionMatch.Success) {
  Write-Error "[Rodogarcia PROD] Nao foi possivel identificar a versao do Java configurado: $JavaExecutable"
  exit 1
}

$major = [int]$versionMatch.Groups['major'].Value
if ($major -lt 21 -or $major -ge 27) {
  Write-Error "[Rodogarcia PROD] Java $major nao e compativel. Configure Java 21 a 26 em JAVA_HOME."
  exit 1
}

Write-Output "[Rodogarcia PROD] Java $major confirmado: $JavaExecutable"
