# Contrato observável v1 — backend público

Este documento fixa o contrato atualmente servido por `site/backend` em Spring MVC. Alguns detalhes foram capturados da implementação histórica Node/Express antes da remoção dela; essa proveniência existe apenas para explicar regras de compatibilidade e não indica um runtime de fallback disponível.

## Topologia e portas

| Ambiente | Bind direto | Entrada pública |
| --- | --- | --- |
| DEV | `127.0.0.1:31012` | gateway Next local |
| Hardening isolado | `127.0.0.1:42010` | somente suíte isolada |
| PROD | `127.0.0.1:6050` | `https://sitebackend.rodogarcia.com.br` |

O frontend continua encaminhando as rotas ao mesmo destino. Não há URL interna nova no navegador. Testes que escrevem dados usam `STORAGE_ROOT` e `RATE_LIMITS_STORE_PATH` absolutos e isolados.

## Pipeline HTTP

Ordem global: headers de segurança, CORS, parser JSON estrito de 2 MiB e roteamento. Nas mutações ESL: Origin, Content-Type, rate limit, capability quando existir, normalização/validação, controller e service.

- O roteamento é case-insensitive e tolera uma barra final.
- Método incompatível e path desconhecido retornam `404`, não `405`.
- Todo `GET` aceita `HEAD`; CEP/CNPJ ainda consomem limite e consultam o provedor.
- JSON malformado, primitivo ou maior que 2 MiB preserva o status/envelope contratado.
- JSON usa UTF-8 minificado, `Content-Length` e ETag fraco quando aplicável.
- Não existem cookies, sessão, upload, conteúdo estático, redirect HTTPS, Actuator ou login nesse runtime.

## CORS e headers

- Origem permitida é refletida em `Access-Control-Allow-Origin` com credenciais; origem proibida não recebe headers CORS.
- Preflight permitido responde `204` antes das rotas e anuncia `GET,HEAD,PUT,PATCH,POST,DELETE`.
- Respostas mantêm CSP, COOP, CORP, Referrer-Policy, HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` e remoção de `X-Powered-By`.
- Em HTTP/1.1, respostas reutilizáveis preservam `Connection: keep-alive` e `Keep-Alive: timeout=5`. Os status que encerram a conexão no Tomcat (`400`, `408`, `411`, `413`, `414`, `500`, `501`, `503`) anunciam somente `Connection: close`, sem `Keep-Alive`; nunca se deve anunciar reutilização de um socket encerrado. Isso inclui o erro de parsing JSON, cujo status `500`, corpo e headers de segurança/CORS permanecem iguais.
- O backend não adiciona cookie, headers de rate limit, `Retry-After`, challenge de autenticação ou dados internos.

## Rotas, status e efeitos

| Método | Path | Sucesso | Limite |
| --- | --- | ---: | --- |
| GET/HEAD | `/api/public/postal-code/:postalCode` | `200`, DTO direto | 60/h |
| GET/HEAD | `/api/public/company/:cnpj` | `200`, DTO direto | 30/h |
| POST | `/api/quote/fractional` | `201 {"quote":...}` | 30/h |
| POST | `/api/quote/closed/whatsapp` | `200 {"whatsappMessage":...}` | 30/h |
| POST | `/api/collections/invoice-validation` | `200` | 30/h |
| POST | `/api/collections` | `201` ou `200` WhatsApp | 20/h |
| PATCH | `/api/collections/:id` | `200 {"collection":...}` | 10/h |
| POST | `/api/collections/:id/cancel` | `200 {"collection":...}` | 10/h |
| GET/HEAD | `/health` | `200 {"ok":true}` | nenhum |
| GET/HEAD | `/ready` | `200 {"ok":true}` ou `503 {"ok":false}` | nenhum |

`/ready` verifica se o storage permite leitura e escrita sem modificar o JSON canônico. O rate limit usa janela fixa de uma hora e não devolve metadados em headers.

## Integrações e variáveis

- ViaCEP e BrasilAPI usam timeout de 5 s; a resposta pública de CNPJ é mínima.
- ESL usa GraphQL HTTPS com Bearer, timeout de 20 s, intervalo mínimo de 2 s e sem retry.
- Capabilities de coleta e NF usam `ESL_OPERATION_SECRET`; nenhum dado operacional ou segredo retorna ao navegador.
- Produção é identificada por `NODE_ENV=production`, preservando o nome de ambiente por compatibilidade operacional.
