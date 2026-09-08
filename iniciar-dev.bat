@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"

title Rodogarcia - Desenvolvimento

set "ENV_FILE=%RODOGARCIA_ENV_FILE%"
if not defined ENV_FILE (
  if exist ".env.development.local" (
    set "ENV_FILE=.env.development.local"
  ) else (
    set "ENV_FILE=.env"
  )
)
if not exist "%ENV_FILE%" (
  echo [Rodogarcia DEV] Arquivo de ambiente nao encontrado: %ENV_FILE%
  echo Copie .env.development.example para .env.development.local ou configure RODOGARCIA_ENV_FILE.
  exit /b 1
)
call "%~dp0scripts\load-root-env.bat" "%ENV_FILE%"
if errorlevel 1 exit /b 1

rem DEV sempre usa os tres backends Spring e volumes locais do repositorio.
set "NODE_ENV=development"
set "HOST=127.0.0.1"
set "PORT=31012"
set "FRONTEND_ORIGIN=http://127.0.0.1:35180"
set "BACKEND_INTERNAL_URL=http://127.0.0.1:31012"
set "BACKEND_PROXY_URL="
set "NEXT_PUBLIC_BACKEND_PROXY_URL="
set "NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:31012"
set "CMS_INTERNAL_URL=http://127.0.0.1:35013"
set "CMS_BACKEND_INTERNAL_URL=http://127.0.0.1:31013"
set "CMS_BACKEND_PROXY_URL=http://127.0.0.1:31013"
set "NEXT_PUBLIC_SITE_URL=http://127.0.0.1:35180"
set "CORS_ORIGINS=http://127.0.0.1:35180,http://localhost:35180,http://127.0.0.1:35013,http://localhost:35013"

set "STORAGE_ROOT=%~dp0site\backend\storage"
set "CMS_STORAGE_ROOT=%~dp0site\backend\storage"
set "UPLOADS_DIR=%~dp0site\backend\storage\uploads"
set "CMS_UPLOADS_DIR=%~dp0site\backend\storage\uploads"
set "CONTENT_STORE_PATH=%~dp0site\backend\storage\content.json"
set "SITE_TEXTS_STORE_PATH=%~dp0site\backend\storage\site-texts.json"
set "CONTACTS_STORE_PATH=%~dp0site\backend\storage\contacts.json"
set "QUOTES_STORE_PATH=%~dp0site\backend\storage\quotes.json"
set "POPUP_CONFIG_STORE_PATH=%~dp0site\backend\storage\popup-config.json"
set "POPUP_LEADS_STORE_PATH=%~dp0site\backend\storage\popup-leads.json"
set "POPUP_EVENTS_STORE_PATH=%~dp0site\backend\storage\popup-events.json"
set "USERS_STORE_PATH=%~dp0site\backend\storage\private\users.json"
set "CMS_ACCESS_PROFILES_STORE_PATH=%~dp0site\backend\storage\private\cms-access-profiles.json"
set "SESSIONS_STORE_PATH=%~dp0site\backend\storage\private\sessions.json"
set "ANALYTICS_STORE_PATH=%~dp0site\backend\storage\private\analytics.json"
set "ANALYTICS_CONFIG_PATH=%~dp0site\backend\storage\private\analytics-config.json"
set "SEO_SETTINGS_STORE_PATH=%~dp0site\backend\storage\seo-settings.json"
set "CONSENT_SETTINGS_STORE_PATH=%~dp0site\backend\storage\consent-settings.json"
set "COOKIE_CONSENTS_STORE_PATH=%~dp0site\backend\storage\private\cookie-consents.json"
set "LEADS_STORE_PATH=%~dp0site\backend\storage\leads.json"
set "IMPROVEMENTS_STORE_PATH=%~dp0site\backend\storage\private\improvements.json"
set "IMPROVEMENT_ATTACHMENTS_PATH=%~dp0site\backend\storage\private\improvement-attachments"
set "TRACKING_EVENTS_STORE_PATH=%~dp0site\backend\storage\private\tracking-events.json"
set "AUDIT_LOG_STORE_PATH=%~dp0site\backend\storage\private\audit-log.json"
set "MEDIA_LIBRARY_STORE_PATH=%~dp0site\backend\storage\media-library.json"
set "MEDIA_SLOTS_STORE_PATH=%~dp0site\backend\storage\media-slots.json"
set "MEDIA_REPLACE_TRANSACTION_PATH=%~dp0site\backend\storage\private\media-replace-transaction.json"
set "RATE_LIMITS_STORE_PATH=%~dp0site\backend\storage\private\rate-limits.json"
set "CMS_RATE_LIMITS_STORE_PATH=%~dp0site\backend\storage\private\cms-rate-limits.json"

set "LANDING_BUILDER_API_URL=http://127.0.0.1:36110"
set "LANDING_BUILDER_PUBLIC_URL=http://127.0.0.1:35112"
set "LANDING_BUILDER_BACKEND_URL=http://127.0.0.1:36110"
set "LANDING_BUILDER_HOST=127.0.0.1"
set "LANDING_BUILDER_PORT=36110"
set "LANDING_BUILDER_SITE_URL=%NEXT_PUBLIC_SITE_URL%"
set "LANDING_BUILDER_ASSET_PREFIX=/landing-assets"
set "LANDING_BUILDER_STORAGE_ROOT=%~dp0landing-builder\backend\storage"
if not defined LANDING_BUILDER_SERVICE_TOKEN (
  for /f "delims=" %%T in ('node -e "process.stdout.write(require('node:crypto').randomBytes(48).toString('base64url'))"') do set "LANDING_BUILDER_SERVICE_TOKEN=%%T"
)
if not defined LANDING_BUILDER_SERVICE_TOKEN (
  echo [Rodogarcia DEV] Nao foi possivel preparar o token privado do Landing Builder.
  exit /b 1
)

where java >nul 2>nul
if errorlevel 1 (
  echo [Rodogarcia DEV] Java compativel com os Maven Wrappers nao foi encontrado no PATH.
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [Rodogarcia DEV] npm nao foi encontrado no PATH.
  exit /b 1
)

echo [Rodogarcia DEV] Encerrando os modos DEV e PROD anteriores deste projeto...
where pm2 >nul 2>nul
if not errorlevel 1 (
  call pm2 delete site-api-prod site-prod cms-api-prod cms-prod landing-api-prod landing-prod >nul 2>&1
  call pm2 delete rodogarcia-backend-prod rodogarcia-frontend-prod rodogarcia-cms-backend-prod rodogarcia-cms-prod rodogarcia-landing-builder-backend-prod rodogarcia-landing-builder-prod >nul 2>&1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-rodogarcia-listeners.ps1" -Mode All
if errorlevel 1 (
  echo [Rodogarcia DEV] Nao foi possivel liberar todas as portas canonicas do projeto.
  exit /b 1
)

echo [Rodogarcia DEV] Ambiente: %ENV_FILE%
call "%~dp0scripts\compile-spring-dev-backend.bat" "site\backend" "backend publico"
if errorlevel 1 (
  echo [Rodogarcia DEV] Preparacao interrompida antes de encerrar processos ou iniciar novos servicos.
  endlocal
  exit /b 1
)
call "%~dp0scripts\compile-spring-dev-backend.bat" "cms\backend" "backend do CMS"
if errorlevel 1 (
  echo [Rodogarcia DEV] Preparacao interrompida antes de encerrar processos ou iniciar novos servicos.
  endlocal
  exit /b 1
)
call "%~dp0scripts\compile-spring-dev-backend.bat" "landing-builder\backend" "backend do Landing Builder"
if errorlevel 1 (
  echo [Rodogarcia DEV] Preparacao interrompida antes de encerrar processos ou iniciar novos servicos.
  endlocal
  exit /b 1
)

if not exist "site\frontend\node_modules" (
  echo [Rodogarcia DEV] Instalando dependencias do frontend do site a partir do lockfile...
  pushd "site\frontend"
  call npm ci
  if errorlevel 1 (
    popd
    echo [Rodogarcia DEV] Preparacao interrompida antes de encerrar processos ou iniciar novos servicos.
    endlocal
    exit /b 1
  )
  popd
)
if not exist "cms\frontend\node_modules" (
  echo [Rodogarcia DEV] Instalando dependencias do frontend do CMS a partir do lockfile...
  pushd "cms\frontend"
  call npm ci
  if errorlevel 1 (
    popd
    echo [Rodogarcia DEV] Preparacao interrompida antes de encerrar processos ou iniciar novos servicos.
    endlocal
    exit /b 1
  )
  popd
)
if not exist "landing-builder\frontend\node_modules" (
  echo [Rodogarcia DEV] Instalando dependencias do frontend do Landing Builder a partir do lockfile...
  pushd "landing-builder\frontend"
  call npm ci
  if errorlevel 1 (
    popd
    echo [Rodogarcia DEV] Preparacao interrompida antes de encerrar processos ou iniciar novos servicos.
    endlocal
    exit /b 1
  )
  popd
)

for %%D in ("site\frontend\.next" "cms\frontend\.next" "landing-builder\frontend\.next") do (
  if exist "%%~D" rmdir /s /q "%%~D"
)

echo [Rodogarcia DEV] Iniciando os tres backends Spring, site, CMS e Landing Builder...
start "Rodogarcia Backend Spring DEV" /b cmd /d /c call "%~dp0scripts\run-spring-dev-backend.bat" "%~dp0site\backend" "31012" "site"
start "Rodogarcia CMS Backend Spring DEV" /b cmd /d /c call "%~dp0scripts\run-spring-dev-backend.bat" "%~dp0cms\backend" "31013" "cms"
start "Rodogarcia Landing Builder Backend Spring DEV" /b cmd /d /c call "%~dp0scripts\run-spring-dev-backend.bat" "%~dp0landing-builder\backend" "36110" "landing-builder"
start "Rodogarcia Frontend DEV" /b cmd /d /c "cd /d ""%~dp0site\frontend"" && npm run dev"
start "Rodogarcia CMS DEV" /b cmd /d /c "cd /d ""%~dp0cms\frontend"" && npm run dev"
start "Rodogarcia Landing Builder DEV" /b cmd /d /c "cd /d ""%~dp0landing-builder\frontend"" && npm run dev"

echo.
echo [Rodogarcia DEV] Backend:     http://127.0.0.1:31012
echo [Rodogarcia DEV] CMS API:     http://127.0.0.1:31013
echo [Rodogarcia DEV] Site:        http://127.0.0.1:35180
echo [Rodogarcia DEV] CMS:         http://127.0.0.1:35013/admin/auth/entrar
echo [Rodogarcia DEV] Landing API: http://127.0.0.1:36110
echo [Rodogarcia DEV] Landing:     http://127.0.0.1:35112
endlocal
exit /b 0
