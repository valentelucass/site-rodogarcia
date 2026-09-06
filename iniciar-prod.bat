@echo off
setlocal EnableExtensions DisableDelayedExpansion
rem ERRORLEVEL e uma pseudo-variavel do cmd; remova um eventual valor herdado.
set "ERRORLEVEL="
cd /d "%~dp0"

title Rodogarcia - Producao

set "ENV_FILE=%RODOGARCIA_ENV_FILE%"
if not defined ENV_FILE (
  if exist ".env.production.local" (
    set "ENV_FILE=.env.production.local"
  ) else (
    set "ENV_FILE=.env"
  )
)
if not exist "%ENV_FILE%" (
  echo [Rodogarcia PROD] Arquivo de ambiente nao encontrado: %ENV_FILE%
  echo Copie .env.production.example para .env.production.local ou configure RODOGARCIA_ENV_FILE.
  exit /b 1
)
call "%~dp0scripts\load-root-env.bat" "%ENV_FILE%"
if not "%ERRORLEVEL%"=="0" exit /b 1
set "RODOGARCIA_ENV_FILE=%ENV_FILE%"

rem A topologia produtiva e fixa: os tres backends usam Spring MVC.
set "NODE_ENV=production"
set "HOST=127.0.0.1"
set "PORT=6050"
set "BACKEND_INTERNAL_URL=http://127.0.0.1:6050"
set "CMS_BACKEND_INTERNAL_URL=http://127.0.0.1:6051"
set "CMS_INTERNAL_URL=http://127.0.0.1:6061"
set "CMS_BACKEND_PROXY_URL=http://127.0.0.1:6051"
if not defined NEXT_PUBLIC_SITE_URL set "NEXT_PUBLIC_SITE_URL=https://site.rodogarcia.com.br"
set "LANDING_BUILDER_API_URL=http://127.0.0.1:41110"
set "LANDING_BUILDER_PUBLIC_URL=http://127.0.0.1:41112"
set "LANDING_BUILDER_BACKEND_URL=http://127.0.0.1:41110"
set "LANDING_BUILDER_HOST=127.0.0.1"
set "LANDING_BUILDER_PORT=41110"
set "LANDING_BUILDER_SITE_URL=%NEXT_PUBLIC_SITE_URL%"
if not defined LANDING_BUILDER_ASSET_PREFIX set "LANDING_BUILDER_ASSET_PREFIX=/landing-assets"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\validate-production-inputs.ps1" -RepositoryRoot "%CD%"
if errorlevel 1 goto :preflight_failed
where java >nul 2>nul
if not "%ERRORLEVEL%"=="0" (
  echo [Rodogarcia PROD] Java compativel com os Maven Wrappers nao foi encontrado no PATH.
  goto :preflight_failed
)
where npm >nul 2>nul
if not "%ERRORLEVEL%"=="0" (
  echo [Rodogarcia PROD] npm nao foi encontrado no PATH.
  goto :preflight_failed
)
where pm2 >nul 2>nul
if not "%ERRORLEVEL%"=="0" (
  echo [Rodogarcia PROD] PM2 nao encontrado. Instale com: npm install -g pm2
  goto :preflight_failed
)
call "%~dp0scripts\assert-production-preflight-isolated.bat"
set "DEV_PREFLIGHT_EXIT_CODE=%ERRORLEVEL%"
if not "%DEV_PREFLIGHT_EXIT_CODE%"=="0" goto :preflight_failed

set "PRODUCTION_SITE_URL=%NEXT_PUBLIC_SITE_URL%"
set "PRODUCTION_PUBLIC_BACKEND_URL=%NEXT_PUBLIC_BACKEND_URL%"
set "PRODUCTION_LANDING_BUILDER_API_URL=%LANDING_BUILDER_API_URL%"
set "PRODUCTION_LANDING_BUILDER_SERVICE_TOKEN=%LANDING_BUILDER_SERVICE_TOKEN%"
set "PRODUCTION_LANDING_BUILDER_PUBLIC_URL=%LANDING_BUILDER_PUBLIC_URL%"
set "PROD_PROMOTION_FLAG="
set "PROD_INITIAL_ROLLOUT="
if defined RODOGARCIA_INITIAL_PROD_ROLLOUT (
  if not "%RODOGARCIA_INITIAL_PROD_ROLLOUT%"=="1" (
    echo [Rodogarcia PROD] RODOGARCIA_INITIAL_PROD_ROLLOUT deve ser 1 quando definido.
    goto :preflight_failed
  )
  set "PROD_INITIAL_ROLLOUT=1"
  set "PROD_PROMOTION_FLAG=--initial-rollout"
  echo [Rodogarcia PROD] Rollout inicial explicitamente autorizado.
)
call "%~dp0scripts\validate-production-rollout-mode.bat" "%PROD_INITIAL_ROLLOUT%"
if not "%ERRORLEVEL%"=="0" goto :preflight_failed

set "SECURITY_TEST_BACKEND_PORT="
set "SECURITY_TEST_FRONTEND_PORT="
set "SECURITY_TEST_CMS_BACKEND_PORT="
set "SECURITY_TEST_CMS_PORT="
set "SECURITY_TEST_BACKEND_ARTIFACT_DIR=site\backend\dist.test"
set "SECURITY_TEST_CMS_BACKEND_ARTIFACT_DIR=cms\backend\dist.test"
set "SECURITY_TEST_FRONTEND_ARTIFACT_DIR=site\frontend\dist-prod.test"
set "SECURITY_TEST_CMS_ARTIFACT_DIR=cms\frontend\dist-prod.test"

echo [Rodogarcia PROD] Ambiente: %ENV_FILE%
echo [Rodogarcia PROD] Pre-flight iniciado; os processos PM2 ativos permanecem atendendo.

call "%~dp0scripts\install-production-frontend-dependencies.bat" "site\frontend" "frontend do site"
if not "%ERRORLEVEL%"=="0" goto :preflight_failed
call "%~dp0scripts\install-production-frontend-dependencies.bat" "cms\frontend" "frontend do CMS"
if not "%ERRORLEVEL%"=="0" goto :preflight_failed
call "%~dp0scripts\install-production-frontend-dependencies.bat" "landing-builder\frontend" "frontend do Landing Builder"
if not "%ERRORLEVEL%"=="0" goto :preflight_failed

call "%~dp0scripts\verify-production-spring-backend.bat" "site\backend" "backend Spring publico"
if not "%ERRORLEVEL%"=="0" goto :preflight_failed
call "%~dp0scripts\verify-production-spring-backend.bat" "cms\backend" "backend Spring do CMS"
if not "%ERRORLEVEL%"=="0" goto :preflight_failed
call "%~dp0scripts\verify-production-spring-backend.bat" "landing-builder\backend" "backend Spring do Landing Builder"
if not "%ERRORLEVEL%"=="0" goto :preflight_failed

call "%~dp0scripts\typecheck-production-frontend.bat" "site\frontend" "frontend do site"
if not "%ERRORLEVEL%"=="0" goto :preflight_failed
call "%~dp0scripts\typecheck-production-frontend.bat" "cms\frontend" "frontend do CMS"
if not "%ERRORLEVEL%"=="0" goto :preflight_failed
call "%~dp0scripts\typecheck-production-frontend.bat" "landing-builder\frontend" "frontend do Landing Builder"
if not "%ERRORLEVEL%"=="0" goto :preflight_failed

set "BACKEND_PROXY_URL="
set "NEXT_PUBLIC_BACKEND_PROXY_URL="
set "BACKEND_INTERNAL_URL=http://127.0.0.1:42010"
set "CMS_BACKEND_INTERNAL_URL=http://127.0.0.1:42514"
set "CMS_INTERNAL_URL=http://127.0.0.1:42513"
set "CMS_BACKEND_PROXY_URL=http://127.0.0.1:42514"
set "NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:42010"
set "NEXT_PUBLIC_SITE_URL=http://127.0.0.1:42511"
set "NEXT_BUILD_DIST_DIR=.next.test"
set "RODOGARCIA_ISOLATED_PREFLIGHT=1"
set "LANDING_BUILDER_API_URL="
set "LANDING_BUILDER_SERVICE_TOKEN="
set "LANDING_BUILDER_PUBLIC_URL=http://127.0.0.1:42515"
set "PROD_ARTIFACT_DIR=dist-prod.test"
call "%~dp0scripts\stage-production-jar.bat" "site\backend" "site\backend\dist.test"
if not "%ERRORLEVEL%"=="0" goto :preflight_failed
call "%~dp0scripts\stage-production-jar.bat" "cms\backend" "cms\backend\dist.test"
if not "%ERRORLEVEL%"=="0" goto :preflight_failed

echo [Rodogarcia PROD] Gerando artefato isolado de teste do site...
call "%~dp0scripts\build-production-frontend-artifact.bat" "site\frontend" "site" ".next.test" "dist-prod.test" "1"
if not "%ERRORLEVEL%"=="0" goto :preflight_failed

echo [Rodogarcia PROD] Gerando artefato isolado de teste do CMS...
call "%~dp0scripts\build-production-frontend-artifact.bat" "cms\frontend" "CMS" ".next.test" "dist-prod.test" "1"
if not "%ERRORLEVEL%"=="0" goto :preflight_failed

echo [Rodogarcia PROD] Executando hardening ponta a ponta em portas isoladas...
node --experimental-websocket scripts\tests\test-security-hardening.js
if not "%ERRORLEVEL%"=="0" goto :preflight_failed

set "BACKEND_PROXY_URL="
set "NEXT_PUBLIC_BACKEND_PROXY_URL="
set "BACKEND_INTERNAL_URL=http://127.0.0.1:6050"
set "CMS_BACKEND_INTERNAL_URL=http://127.0.0.1:6051"
set "CMS_INTERNAL_URL=http://127.0.0.1:6061"
set "CMS_BACKEND_PROXY_URL=http://127.0.0.1:6051"
set "NEXT_PUBLIC_BACKEND_URL=%PRODUCTION_PUBLIC_BACKEND_URL%"
set "NEXT_PUBLIC_SITE_URL=%PRODUCTION_SITE_URL%"
set "NEXT_BUILD_DIST_DIR=.next"
set "RODOGARCIA_ISOLATED_PREFLIGHT="
set "LANDING_BUILDER_API_URL=%PRODUCTION_LANDING_BUILDER_API_URL%"
set "LANDING_BUILDER_BACKEND_URL=%PRODUCTION_LANDING_BUILDER_API_URL%"
set "LANDING_BUILDER_SERVICE_TOKEN=%PRODUCTION_LANDING_BUILDER_SERVICE_TOKEN%"
set "LANDING_BUILDER_PUBLIC_URL=%PRODUCTION_LANDING_BUILDER_PUBLIC_URL%"
set "PROD_ARTIFACT_DIR=dist-prod.next"
call "%~dp0scripts\stage-production-jar.bat" "site\backend" "site\backend\dist.next"
if not "%ERRORLEVEL%"=="0" goto :preflight_failed
call "%~dp0scripts\stage-production-jar.bat" "cms\backend" "cms\backend\dist.next"
if not "%ERRORLEVEL%"=="0" goto :preflight_failed
call "%~dp0scripts\stage-production-jar.bat" "landing-builder\backend" "landing-builder\backend\dist.next"
if not "%ERRORLEVEL%"=="0" goto :preflight_failed

echo [Rodogarcia PROD] Gerando artefato candidato do site...
call "%~dp0scripts\build-production-frontend-artifact.bat" "site\frontend" "site" ".next" "dist-prod.next"
if not "%ERRORLEVEL%"=="0" goto :preflight_failed

echo [Rodogarcia PROD] Gerando artefato candidato do CMS...
call "%~dp0scripts\build-production-frontend-artifact.bat" "cms\frontend" "CMS" ".next" "dist-prod.next"
if not "%ERRORLEVEL%"=="0" goto :preflight_failed

echo [Rodogarcia PROD] Gerando artefato candidato do frontend do Landing Builder...
call "%~dp0scripts\build-production-frontend-artifact.bat" "landing-builder\frontend" "Landing Builder" ".next" "dist-prod.next"
if not "%ERRORLEVEL%"=="0" goto :preflight_failed

echo [Rodogarcia PROD] Validando todos os artefatos candidatos...
node scripts\promote-production-artifacts.js --verify %PROD_PROMOTION_FLAG%
if not "%ERRORLEVEL%"=="0" goto :preflight_failed

set "PROD_ARTIFACT_DIR="
set "RODOGARCIA_ISOLATED_PREFLIGHT="
set "SECURITY_TEST_BACKEND_ARTIFACT_DIR="
set "SECURITY_TEST_CMS_BACKEND_ARTIFACT_DIR="
set "SECURITY_TEST_FRONTEND_ARTIFACT_DIR="
set "SECURITY_TEST_CMS_ARTIFACT_DIR="

echo [Rodogarcia PROD] Pre-flight aprovado. Iniciando a troca dos processos PM2...
call pm2 delete site-api-prod site-prod cms-api-prod cms-prod landing-api-prod landing-prod >nul 2>&1
call pm2 delete rodogarcia-backend-prod rodogarcia-frontend-prod rodogarcia-cms-backend-prod rodogarcia-cms-prod rodogarcia-landing-builder-backend-prod rodogarcia-landing-builder-prod >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\wait-production-state.ps1" -Mode ports-free
if not "%ERRORLEVEL%"=="0" (
  if defined PROD_INITIAL_ROLLOUT goto :initial_rollout_failed
  goto :restore_active_processes
)

node scripts\promote-production-artifacts.js --promote %PROD_PROMOTION_FLAG%
if not "%ERRORLEVEL%"=="0" (
  if defined PROD_INITIAL_ROLLOUT goto :initial_rollout_failed
  goto :restore_active_processes
)

if not exist "logs" mkdir "logs"
call pm2 startOrReload ecosystem.config.js --env production --update-env
if not "%ERRORLEVEL%"=="0" goto :rollback
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\wait-production-state.ps1" -Mode release
if not "%ERRORLEVEL%"=="0" goto :rollback
call pm2 save
if not "%ERRORLEVEL%"=="0" (
  echo [Rodogarcia PROD] Os processos estao saudaveis, mas pm2 save falhou. Corrija antes de reiniciar a VM.
  endlocal
  exit /b 1
)

echo.
echo [Rodogarcia PROD] Backend Cloudflare:  https://sitebackend.rodogarcia.com.br ^> http://127.0.0.1:6050
echo [Rodogarcia PROD] CMS API privada:    http://127.0.0.1:6051
echo [Rodogarcia PROD] Frontend Cloudflare: https://site.rodogarcia.com.br ^> http://127.0.0.1:6060
echo [Rodogarcia PROD] CMS privado:        http://127.0.0.1:6061 ^> https://site.rodogarcia.com.br/admin
echo [Rodogarcia PROD] Landing API privada: http://127.0.0.1:41110
echo [Rodogarcia PROD] Landing privado:     http://127.0.0.1:41112
echo [Rodogarcia PROD] Status: pm2 status site-api-prod site-prod cms-api-prod cms-prod landing-api-prod landing-prod
endlocal
exit /b 0

:restore_active_processes
echo [Rodogarcia PROD] Nenhum artefato candidato foi ativado; tentando restaurar os processos ativos...
call pm2 startOrReload ecosystem.config.js --env production --update-env
if not "%ERRORLEVEL%"=="0" goto :restore_failed
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\wait-production-state.ps1" -Mode release
if not "%ERRORLEVEL%"=="0" goto :restore_failed
call pm2 save >nul 2>&1
echo [Rodogarcia PROD] Processos ativos restaurados; nenhum artefato candidato foi publicado.
endlocal
exit /b 1

:restore_failed
echo [Rodogarcia PROD] Nao foi possivel restaurar os processos ativos automaticamente.
endlocal
exit /b 1

:rollback
echo [Rodogarcia PROD] A nova versao nao passou no health; revertendo artefatos e processos...
call pm2 delete site-api-prod site-prod cms-api-prod cms-prod landing-api-prod landing-prod >nul 2>&1
call pm2 delete rodogarcia-backend-prod rodogarcia-frontend-prod rodogarcia-cms-backend-prod rodogarcia-cms-prod rodogarcia-landing-builder-backend-prod rodogarcia-landing-builder-prod >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\wait-production-state.ps1" -Mode ports-free
if not "%ERRORLEVEL%"=="0" goto :rollback_failed
node scripts\promote-production-artifacts.js --rollback %PROD_PROMOTION_FLAG%
if not "%ERRORLEVEL%"=="0" goto :rollback_failed
if defined PROD_INITIAL_ROLLOUT goto :initial_rollout_failed
call pm2 startOrReload ecosystem.config.js --env production --update-env
if not "%ERRORLEVEL%"=="0" goto :rollback_failed
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\wait-production-state.ps1" -Mode release
if not "%ERRORLEVEL%"=="0" goto :rollback_failed
call pm2 save >nul 2>&1
echo [Rodogarcia PROD] Rollback concluido; a versao candidata foi preservada para diagnostico.
endlocal
exit /b 1

:rollback_failed
echo [Rodogarcia PROD] Rollback automatico interrompido; revise logs e artefatos antes de religar processos manualmente.
endlocal
exit /b 1

:initial_rollout_failed
echo [Rodogarcia PROD] Rollout inicial interrompido; nao havia conjunto anterior completo para iniciar.
endlocal
exit /b 1

:preflight_failed
set "PROD_ARTIFACT_DIR="
set "RODOGARCIA_ISOLATED_PREFLIGHT="
set "SECURITY_TEST_BACKEND_ARTIFACT_DIR="
set "SECURITY_TEST_CMS_BACKEND_ARTIFACT_DIR="
set "SECURITY_TEST_FRONTEND_ARTIFACT_DIR="
set "SECURITY_TEST_CMS_ARTIFACT_DIR="
echo [Rodogarcia PROD] Pre-flight interrompido; os processos PM2 ativos nao foram alterados.
endlocal
exit /b 1
