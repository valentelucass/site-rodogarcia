# Operação de produção

Este documento descreve o rollout manual. A alteração de código não inicia, reinicia nem publica produção.

## Fronteiras e processos

O Rodogarcia não é uma SPA estática: o site Next renderiza Server Components, aplica headers, encaminha `/admin/*` ao painel e roteia APIs pelo mesmo hostname público. Em janela autorizada, a equipe responsável opera seis processos privados:

| Componente | Bind local | Função |
| --- | --- | --- |
| API pública Spring (`site/backend/dist/server.jar`) | `127.0.0.1:6050` | ESL e consultas públicas de CEP/CNPJ. |
| API CMS Spring (`cms/backend/dist/server.jar`) | `127.0.0.1:6051` | Auth, admin, conteúdo, SEO, mídia, uploads, formulários, consentimento, analytics, popup, leads, sessões e scheduler. |
| Next do site (`site/frontend/dist-prod/server.js`) | `127.0.0.1:6060` | Site público, headers e gateway interno. |
| Next do CMS (`cms/frontend/dist-prod/server.js`) | `127.0.0.1:6061` | Painel com `basePath: /admin`. |
| API Landing Builder Spring (`landing-builder/backend/dist/server.jar`) | `127.0.0.1:41110` | API privada de campanhas, mídias e prévias. |
| Next Landing Builder (`landing-builder/frontend/dist-prod/server.js`) | `127.0.0.1:41112` | Renderizador de campanhas encaminhado pelo gateway. |

O site em `6060` encaminha `/admin/*` ao painel em `6061`, as rotas CMS e `/uploads/*` à API em `6051`, CEP/CNPJ/ESL à API pública em `6050`, e assets, mídia e slugs de campanha ao Builder. Não existe hostname público para API ou painel CMS.

## Persistência e escritor único

O volume canônico é `site/backend/storage`; não copie JSON, uploads, sessões ou logs privados para diretórios de runtime. `cms/backend` é o único escritor das coleções administrativas e usa `private/cms-rate-limits.json`; `site/backend` mantém apenas seu rate limit operacional. O Builder é escritor único de seu volume externo.

Antes de backup, restore ou alteração manual do storage, pare os writers na janela de manutenção. Nunca exponha `site/backend/storage/private/**` nem uploads por canais privados indevidos.

## Ambiente

Na VM, crie `.env.production.local` a partir de `.env.production.example`. Preencha ao menos:

- `FRONTEND_ORIGIN` e `CORS_ORIGINS` com origens HTTPS canônicas.
- `ADMIN_SETUP_CODE`, `SESSION_SECRET` ou `JWT_SECRET`, e `ESL_OPERATION_SECRET` com valores fortes e distintos.
- `STORAGE_ROOT` e `UPLOADS_DIR` com caminhos absolutos no volume persistente.
- `FFMPEG_PATH` e `FFPROBE_PATH` absolutos para executáveis estáveis fora do repositório e de `node_modules`, usados pelos backends Spring do CMS e Landing Builder para converter imagens e ler com limite de tempo resolução/duração de vídeos.
- `TRUST_PROXY=1` quando o Next/tunnel for o salto confiável.
- `BACKEND_INTERNAL_URL=http://127.0.0.1:6050`.
- `CMS_BACKEND_INTERNAL_URL=http://127.0.0.1:6051`, `CMS_BACKEND_PROXY_URL=http://127.0.0.1:6051` e `CMS_INTERNAL_URL=http://127.0.0.1:6061`.
- `LANDING_BUILDER_SERVICE_TOKEN` forte e `LANDING_BUILDER_STORAGE_ROOT` absoluto, externo ao repositório.
- `NEXT_PUBLIC_SITE_URL=https://site.rodogarcia.com.br` somente para links, prévias e assets públicos.

As variáveis internas, segredos e caminhos de storage são privados; nenhuma pode receber o prefixo `NEXT_PUBLIC_`.

## DEV manual

O desenvolvimento integrado usa Spring em `31012` e `31013`, site em `35180`, CMS Next em `35013`, API Builder em `36110` e renderizador em `35112`. O responsável inicia esse fluxo manualmente; a URL normal do painel é `http://127.0.0.1:35180/admin/auth/entrar`.

## PM2 e rollout manual

`ecosystem.config.js` define `site-api-prod`, `site-prod`, `cms-api-prod`, `cms-prod`, `landing-api-prod` e `landing-prod`, todos em loopback. As três APIs executam `java -jar dist/server.jar`.

Somente a equipe responsável pode executar o rollout. Com os writers parados, crie e confira backup com o volume explícito, por exemplo:

```powershell
node scripts/backup-storage.js --source "C:\Rodogarcia\storage-prod"
```

Depois, valide os artefatos isolados, promova candidatos, e confira `/health` e `/ready` nas APIs `6050` e `6051`, `/health` no Builder, e o gateway em `6060/admin/auth/entrar`. A promoção preserva `*.previous`, mantém candidata falha em `*.failed` e restaura a versão JAR anterior se health ou readiness falhar.

## Cloudflare Tunnel

O arquivo do `cloudflared` pertence à infraestrutura. O contrato mínimo é:

```yaml
ingress:
  - hostname: site.rodogarcia.com.br
    service: http://127.0.0.1:6060
  - hostname: sitebackend.rodogarcia.com.br
    service: http://127.0.0.1:6050
```

Não crie ingressos para `6051`, `6061`, `41110` ou `41112`. Não faça cache de HTML, `/api/*`, autenticação, CMS ou uploads mutáveis.

## Artefatos e hardening isolado

O pré-flight gera artefatos isolados, sem tocar os ativos:

| Artefato | Porta de hardening |
| --- | --- |
| `site/backend/dist.test/server.jar` | `42010` |
| `cms/backend/dist.test/server.jar` | `42514` |
| `site/frontend/dist-prod.test` | `42511` |
| `cms/frontend/dist-prod.test` | `42513` |

O hardening recusa `.next`, artefatos ativos, portas e storage de produção. Depois da aprovação, os candidatos são gerados como `dist.next` ou `dist-prod.next` nas portas privadas operacionais.
