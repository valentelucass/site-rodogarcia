# CMS endpoint matrix v1

O artefato consumível é [`endpoint-manifest.v1.json`](./endpoint-manifest.v1.json). Ele inventaria **96 registros sob `/api` + `/health` + `/ready` = 98 endpoints explícitos**, além da superfície wildcard `/uploads/*`.

O conjunto é servido por `cms/backend` em Spring MVC. Nomes de middleware e observações de Express existentes no manifesto descrevem a captura histórica que o contrato compatível preserva; não apontam para uma implementação Node disponível.

## Pipeline, headers e erros

Ordem observável: confiança de proxy, remoção de `X-Powered-By`, headers de segurança, CORS, JSON estrito de 2 MiB, cookies/sessão, `/uploads`, `/api`, health/readiness, 404 e tratamento de erro.

- `GET` preserva `HEAD` implícito; ele executa efeitos da rota e suprime o corpo.
- CORS roda antes do parser e das rotas; origem permitida recebe credenciais e `Vary: Origin`.
- Mutações administrativas verificam sessão, ACL, Origin, tipo de conteúdo e CSRF na ordem registrada no manifesto.
- Respostas autenticadas usam `Cache-Control: private, no-store`.
- `/uploads/*` é a única superfície estática do CMS; aplica `nosniff`, MIME allowlisted, cache, ETag, `HEAD`, condicionais e ranges compatíveis.
- Erros públicos usam `{ "error": "mensagem" }` e nunca revelam paths, segredos ou dados privados.

## Ownership e efeitos

`cms/backend` é o único escritor das coleções CMS em `site/backend/storage`. Até mesmo leitura autenticada pode renovar TTL da sessão, logo não é segura para tráfego espelho no volume canônico. A integração com o Landing Builder usa token privado, timeout total de 8 s, IDs codificados e recusa redirects para outra origem antes de reenviar o token.

Para a lista completa de rotas, método, ACL, request profile, sucesso, stores e efeitos, consulte o manifesto versionado.
