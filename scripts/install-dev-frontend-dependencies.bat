@echo off
setlocal EnableExtensions DisableDelayedExpansion
set "ERRORLEVEL="

if "%~1"=="" exit /b 1
if "%~2"=="" exit /b 1
if not exist "%~1\package-lock.json" (
  echo [Rodogarcia DEV] Lockfile nao encontrado para %~2.
  exit /b 1
)
if exist "%~1\node_modules" exit /b 0

echo [Rodogarcia DEV] Instalando dependencias de %~2 a partir do lockfile...
pushd "%~1"
if not "%ERRORLEVEL%"=="0" exit /b 1
call npm ci --include=dev
set "COMMAND_EXIT_CODE=%ERRORLEVEL%"
if not "%COMMAND_EXIT_CODE%"=="0" (
  popd
  exit /b 1
)
popd
exit /b 0
