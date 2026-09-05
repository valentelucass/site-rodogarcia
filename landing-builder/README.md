# Landing Builder

Aplicação independente de campanhas, com storage e token próprios. Os scripts manuais `iniciar-dev.bat` e `iniciar-prod.bat` do site/CMS gerenciam seus dois processos junto com o restante da topologia, sem permitir que outro runtime escreva em seu volume.

## Processos e fronteiras

- `backend/`: API privada Java 21/Spring Boot MVC em `127.0.0.1:36110` no DEV e `41110` em produção. O CMS é o único consumidor dos endpoints internos e se autentica com `LANDING_BUILDER_SERVICE_TOKEN`.
- `frontend/`: renderizador público em `127.0.0.1:35112` no DEV e `41112` em produção. O gateway do site só o usa como fallback para slugs que não pertencem ao institucional.
- Campanhas publicadas usam os assets Next sob `/landing-assets/_next/*`; esse prefixo impede colisão com os assets do Next institucional. `LANDING_BUILDER_ASSET_PREFIX` deve ter o mesmo valor no frontend do Builder e no processo do site.
- Mídias das campanhas são próprias do Builder: ficam em `media.json` e `media/` no volume dele e são expostas somente em `/landing-media/:id`. O upload interno aceita assinatura real de PNG, JPG/JPEG, WebP, AVIF, MP4, WebM e Ogg; imagens são otimizadas para WebP. Uma mídia ainda referenciada por uma landing não pode ser excluída.
- `backend/storage/landings.json`, `media.json` e `media/` são o conteúdo canônico local de desenvolvimento e ficam ignorados pelo Git. Quando ainda não existem, o Builder começa vazio e os cria no primeiro salvamento. Em produção, `LANDING_BUILDER_STORAGE_ROOT` é obrigatório e deve apontar para um volume absoluto fora do repositório; `FFMPEG_PATH` suporta AVIF e `FFPROBE_PATH` registra com segurança a duração dos vídeos.
- Rascunhos só abrem por uma URL de prévia opaca gerada pelo CMS em `/preview/<token>`; ela não é indexável, não entra no sitemap e não carrega analytics.
- Campanhas publicadas e indexáveis entram nos sitemaps do Builder e do site. A campanha usa o mesmo consentimento de analytics do site (`rg_analytics_consent`) quando estiver no gateway público.

## Operação integrada

`iniciar-dev.bat` inicia o backend Spring e o frontend do Builder nas portas `36110` e `35112`. Em produção, `iniciar-prod.bat` valida, empacota, promove e supervisiona os dois processos em `41110` e `41112` pelo PM2; o pre-flight falha se `LANDING_BUILDER_SERVICE_TOKEN`, `LANDING_BUILDER_STORAGE_ROOT`, `FFMPEG_PATH` ou `FFPROBE_PATH` não estiverem configurados de forma segura.

Para diagnóstico isolado, em terminais separados e depois de configurar os respectivos `.env` locais:

```bat
cd landing-builder\backend
mvnw.cmd spring-boot:run
```

```bat
cd landing-builder\frontend
npm ci
npm run dev
```

O ciclo integrado fixa internamente `LANDING_BUILDER_API_URL=http://127.0.0.1:36110` e `LANDING_BUILDER_PUBLIC_URL=http://127.0.0.1:35112` em DEV. `LANDING_BUILDER_SERVICE_TOKEN` deve ser o mesmo nos dois backends e nunca é público. O gateway encaminha `/landing-media/*` ao frontend do Builder, além de `/landing-assets/_next/*`.

O Builder reserva as rotas institucionais, administrativas, de API e aliases atuais do site; uma campanha não pode publicar sobre elas.
