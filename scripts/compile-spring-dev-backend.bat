@echo off
setlocal EnableExtensions DisableDelayedExpansion
set "ERRORLEVEL="

if "%~1"=="" (
  echo [Rodogarcia DEV] Diretorio do backend ausente no preflight Maven.
  exit /b 1
)
if "%~2"=="" (
  echo [Rodogarcia DEV] Nome do backend ausente no preflight Maven.
  exit /b 1
)
if not exist "%~1\mvnw.cmd" (
  echo [Rodogarcia DEV] Maven Wrapper nao encontrado para %~2.
  exit /b 1
)

echo [Rodogarcia DEV] Compilando %~2 antes de parar o DEV atual...
pushd "%~1"
if not "%ERRORLEVEL%"=="0" exit /b 1
call mvnw.cmd -B -ntp -DskipTests compile
set "COMMAND_EXIT_CODE=%ERRORLEVEL%"
if not "%COMMAND_EXIT_CODE%"=="0" (
  popd
  echo [Rodogarcia DEV] Falha ao compilar %~2. Os processos DEV atuais foram preservados.
  exit /b 1
)
popd
exit /b 0
