# Runtime topology for Spring MVC

Este contrato fixa endereços, ingressos, gateway e ownership dos backends Spring. Ele não autoriza iniciar, reiniciar ou promover processos; DEV e produção continuam manuais.

## Portas e visibilidade

| Ambiente | API pública | API CMS | Site Next | CMS Next | API Builder | Builder Next |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| DEV | `127.0.0.1:31012` | `127.0.0.1:31013` | `127.0.0.1:35180` | `127.0.0.1:35013` | `127.0.0.1:36110` | `127.0.0.1:35112` |
| Hardening central | `127.0.0.1:42010` | `127.0.0.1:42514` | `127.0.0.1:42511` | `127.0.0.1:42513` | não alocado | não alocado |
| PROD | `127.0.0.1:6050` | `127.0.0.1:6051` | `127.0.0.1:6060` | `127.0.0.1:6061` | `127.0.0.1:41110` | `127.0.0.1:41112` |

Os ingressos Cloudflare públicos são `https://site.rodogarcia.com.br` para o site em `6060` e, quando necessário, `https://sitebackend.rodogarcia.com.br` para a API pública em `6050`. API CMS, CMS Next e Builder permanecem internos. O navegador usa sempre o hostname do site e caminhos same-origin `/admin`, `/api`, `/uploads`, `/landing-assets` e `/landing-media`.

`site/backend`, `cms/backend` e `landing-builder/backend` são backends Spring MVC permanentes. Nenhum deles expõe context path, management port, `/actuator`, Swagger, `/login` ou URL interna ao navegador.

## Fluxo público e administrativo

```text
navegador
  │
  └─ site Next :6060 / :35180
       ├─ /admin/** ───────────────────────────────> CMS Next :6061 / :35013
       ├─ rotas CMS /api/** e /uploads/** ────────> API CMS Spring :6051 / :31013
       ├─ CEP, CNPJ e ESL /api/** ────────────────> API pública Spring :6050 / :31012
       ├─ /landing-assets/**, /landing-media/** ──> Builder Next :41112 / :35112
       └─ slug público desconhecido ──────────────> fallback Builder Next

API CMS Spring
  └─ /api/admin/landings* ─ token privado ───────> Builder API :41110 / :36110
```

O CMS Next usa `basePath=/admin`; a API CMS preserva `/api/...` e `/uploads/...` sem base path adicional.

## Ordem contratual dos rewrites do site

`site/frontend/next.config.js` usa `beforeFiles` nesta ordem:

1. `${LANDING_BUILDER_ASSET_PREFIX}/_next/:path*`, se o Builder estiver configurado;
2. `/landing-media/:path*`, se o Builder estiver configurado;
3. `/admin` e `/admin/:path*` para `CMS_INTERNAL_URL`;
4. auth/admin, conteúdo público, mídia, formulários, consentimento, analytics, popup, tracking, leads e melhorias para a API CMS;
5. CEP, CNPJ e ESL para a API pública;
6. `/uploads/:path*` para a API CMS;
7. somente no fallback, slug não institucional para o frontend Builder.

## Ambiente e storage

Os três backends Spring usam `NODE_ENV`, `HOST`, `PORT`, origem, CORS, storage e os mesmos nomes privados documentados nos exemplos de ambiente. O CMS também usa `JWT_SECRET` ou `SESSION_SECRET`, `ADMIN_SETUP_CODE`, `FFMPEG_PATH`, `FFPROBE_PATH`, `LANDING_BUILDER_API_URL` e `LANDING_BUILDER_SERVICE_TOKEN`; em produção, FFmpeg e FFprobe ficam fora do repositório e o CMS testa ambos no readiness. O Builder também exige `FFMPEG_PATH` e `FFPROBE_PATH` em produção, para registrar metadados de vídeo sem confiar no navegador. Nenhum requer `SPRING_PROFILES_ACTIVE`, `SERVER_PORT` ou YAML.

O volume canônico é `site/backend/storage` ou um root externo configurado. A API pública é escritora exclusiva de `private/rate-limits.json`; a API CMS é escritora exclusiva das coleções administrativas e de `private/cms-rate-limits.json`. O Builder nunca escreve nesse volume.

## Processo, health e artefatos

`site-api-prod`, `cms-api-prod` e `landing-api-prod` executam seus respectivos `dist/server.jar` com `java -jar`. O health total tem prazo de 30 s, polling de 500 ms e timeout individual de 5 s. `GET /health` responde `200 {"ok":true}` quando o processo está vivo; `GET /ready` responde somente `200 {"ok":true}` ou `503 {"ok":false}` após verificar storage, uploads, assets e, em produção CMS, os executáveis FFmpeg e FFprobe. O Builder preserva somente `/health`.

`dist.test` nunca é promovido. `dist.next`, `dist.previous` e `dist.failed` isolam candidata, rollback JAR e falha. O hardening usa exclusivamente `site/backend/dist.test/server.jar` e `cms/backend/dist.test/server.jar` em storage temporário.

## Rollback

1. Drenar requisições e criar backup oficial do volume.
2. Parar o writer Spring atual.
3. Validar o JAR anterior e somente então restaurá-lo à mesma porta e volume.
4. Executar health, readiness, gateway e smoke tests.

Portas, ingressos e rewrites não mudam no rollback; muda apenas o JAR da mesma API Spring. O Builder é um runtime separado e não participa desse rollback.
