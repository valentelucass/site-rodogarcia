# Scripts globais do monorepo

## Testes

- `node scripts/tests/test-security-hardening.js` executa somente com artefatos isolados e storage temporário; no site, também comprova que `/_next/image` usa o Sharp empacotado, valida cache/range de mídia e faz um smoke real de hidratação, CSP e rede em Chrome, Edge ou Chromium headless.
- `node scripts/tests/test-production-operations.js` valida promoção, rollback e preparação isolada de artefatos em diretórios temporários, incluindo o runtime nativo autocontido do Sharp.

O hardening usa `site/backend/dist.test/server.jar`, `cms/backend/dist.test/server.jar`, `site/frontend/dist-prod.test` e `cms/frontend/dist-prod.test`. Ele recusa `.next`, artefatos ativos, portas e storage de produção. O navegador é localizado automaticamente; em hosts sem Chrome, Edge ou Chromium no caminho padrão, informe `SECURITY_TEST_BROWSER_PATH` com o executável absoluto. A ausência do navegador interrompe o aceite, sem degradar para uma simulação de DOM. Use Node 22+ ou, no Node 20 do CI, execute com `node --experimental-websocket` como fazem os fluxos oficiais.

## Backup e restore

- `node scripts/backup-storage.js --source "<STORAGE_ROOT absoluto>"`
- `node scripts/restore-storage.js --backup backups/storage-... --target "<STORAGE_ROOT absoluto>" --confirm-restore`

Em produção, writers devem estar parados e o backup precisa receber `--source` explícito. O comando sem source aponta ao storage local. Veja `docs/backup-restore-json.md`.

## Uploads de produção

`node scripts/sync-production-uploads.js --env-file .env.production.local` valida referências de uploads no volume alvo. Use `--apply` somente na janela autorizada para copiar arquivos ausentes sem sobrescrever os existentes.

## Observação

O teste de segurança sobe as APIs Spring e os frontends Next em processos isolados, verifica o gateway `/admin` e lê `routes-manifest.json`. ESL/CEP/CNPJ devem apontar para `127.0.0.1:42010`; rotas CMS e `/uploads/*` para `127.0.0.1:42514`; `/admin/*` para `127.0.0.1:42513`.

O Landing Builder também usa Spring MVC e é validado pelo Maven Wrapper próprio. Seu runtime completo ainda não participa do hardening dos quatro artefatos centrais; o gateway de campanha é exercitado por uma fixture HTTP isolada em `127.0.0.1:42515`, incorporada ao próprio teste. O artefato isolado do site deve ser compilado com `LANDING_BUILDER_PUBLIC_URL=http://127.0.0.1:42515`. Quando houver `next dev` manual, use `NEXT_BUILD_DIST_DIR=.next.test` para não tocar no cache ativo.
