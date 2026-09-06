[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$RepositoryRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryPath = [IO.Path]::GetFullPath($RepositoryRoot).TrimEnd([char]92) + [IO.Path]::DirectorySeparatorChar
$serviceToken = [string]$env:LANDING_BUILDER_SERVICE_TOKEN
$storageRoot = [string]$env:LANDING_BUILDER_STORAGE_ROOT
$ffmpegPath = [string]$env:FFMPEG_PATH
$ffprobePath = [string]$env:FFPROBE_PATH
$errors = [System.Collections.Generic.List[string]]::new()

if ([string]::IsNullOrWhiteSpace($serviceToken) -or $serviceToken.Length -lt 32 -or $serviceToken -match '(?i)altere-para|change-me|example|placeholder') {
  $errors.Add('LANDING_BUILDER_SERVICE_TOKEN forte e obrigatorio.')
}

if ([string]::IsNullOrWhiteSpace($storageRoot) -or -not [IO.Path]::IsPathRooted($storageRoot)) {
  $errors.Add('LANDING_BUILDER_STORAGE_ROOT absoluto e obrigatorio.')
} elseif ([IO.Path]::GetFullPath($storageRoot).StartsWith($repositoryPath, [StringComparison]::OrdinalIgnoreCase)) {
  $errors.Add('LANDING_BUILDER_STORAGE_ROOT deve ficar fora do repositorio.')
}

if ([string]::IsNullOrWhiteSpace($ffmpegPath) -or -not [IO.Path]::IsPathRooted($ffmpegPath)) {
  $errors.Add('FFMPEG_PATH absoluto e obrigatorio.')
} else {
  $resolvedFfmpegPath = [IO.Path]::GetFullPath($ffmpegPath)
  if ($resolvedFfmpegPath.StartsWith($repositoryPath, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $resolvedFfmpegPath -PathType Leaf)) {
    $errors.Add('FFMPEG_PATH deve apontar para executavel existente fora do repositorio.')
  }
}

if ([string]::IsNullOrWhiteSpace($ffprobePath) -or -not [IO.Path]::IsPathRooted($ffprobePath)) {
  $errors.Add('FFPROBE_PATH absoluto e obrigatorio.')
} else {
  $resolvedFfprobePath = [IO.Path]::GetFullPath($ffprobePath)
  if ($resolvedFfprobePath.StartsWith($repositoryPath, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $resolvedFfprobePath -PathType Leaf)) {
    $errors.Add('FFPROBE_PATH deve apontar para executavel existente fora do repositorio.')
  }
}

if ($errors.Count -gt 0) {
  $errors | ForEach-Object { Write-Error "[Rodogarcia PROD] $_" }
  exit 1
}
