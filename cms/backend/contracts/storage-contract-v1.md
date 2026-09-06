# CMS storage contract v1

Este contrato descreve os 24 destinos configuráveis do CMS Spring: 23 arquivos JSON e um diretório. A organização e os defaults foram preservados da captura de compatibilidade anterior; o escritor atual é exclusivamente `cms/backend`.

## Regras físicas comuns

- O volume padrão é `site/backend/storage`; privados ficam em `private/`.
- `CMS_STORAGE_ROOT` tem precedência sobre `STORAGE_ROOT`; caminhos relativos resolvem contra `site/backend`.
- `CMS_UPLOADS_DIR` tem precedência sobre `UPLOADS_DIR`; `FRONTEND_PUBLIC_DIR` resolve contra a raiz do repositório.
- Leitura remove no máximo um BOM UTF-8 inicial. JSON inválido, permissão e I/O falham fechados.
- Escrita cria diretórios, usa UTF-8 sem BOM, JSON formatado, temporário no mesmo diretório e rename atômico.
- IDs locais usam `<prefix>_<32 hex minúsculos>` e datas textuais usam ISO-8601.

## Destinos configuráveis

| Chave | Variável | Fallback sob o volume | Uso principal |
| --- | --- | --- | --- |
| `content` | `CONTENT_STORE_PATH` | `content.json` | conteúdo público e migrações de leitura |
| `siteTexts` | `SITE_TEXTS_STORE_PATH` | `site-texts.json` | textos e referências de mídia |
| `contacts` | `CONTACTS_STORE_PATH` | `contacts.json` | contatos e leads unificados |
| `quotes` | `QUOTES_STORE_PATH` | `quotes.json` | cotações e leads |
| `popupConfig` | `POPUP_CONFIG_STORE_PATH` | `popup-config.json` | popup público/admin |
| `popupLeads` | `POPUP_LEADS_STORE_PATH` | `popup-leads.json` | leads do popup |
| `popupEvents` | `POPUP_EVENTS_STORE_PATH` | `popup-events.json` | analytics do popup |
| `users` | `USERS_STORE_PATH` | `private/users.json` | autenticação e usuários |
| `cmsAccessProfiles` | `CMS_ACCESS_PROFILES_STORE_PATH` | `private/cms-access-profiles.json` | perfis e ACL |
| `sessions` | `SESSIONS_STORE_PATH` | `private/sessions.json` | sessão e TTL |
| `analytics` | `ANALYTICS_STORE_PATH` | `private/analytics.json` | legado de analytics |
| `analyticsConfig` | `ANALYTICS_CONFIG_PATH` | `private/analytics-config.json` | configuração analytics |
| `seoSettings` | `SEO_SETTINGS_STORE_PATH` | `seo-settings.json` | SEO público/admin |
| `consentSettings` | `CONSENT_SETTINGS_STORE_PATH` | `consent-settings.json` | consentimento |
| `cookieConsents` | `COOKIE_CONSENTS_STORE_PATH` | `private/cookie-consents.json` | monitoramento LGPD |
| `leads` | `LEADS_STORE_PATH` | `leads.json` | leads unificados |
| `improvements` | `IMPROVEMENTS_STORE_PATH` | `private/improvements.json` | triagem e retenção |
| `improvementAttachments` | `IMPROVEMENT_ATTACHMENTS_PATH` | `private/improvement-attachments/` | anexos privados |
| `trackingEvents` | `TRACKING_EVENTS_STORE_PATH` | `private/tracking-events.json` | eventos agregados |
| `auditLog` | `AUDIT_LOG_STORE_PATH` | `private/audit-log.json` | auditoria administrativa |
| `mediaLibrary` | `MEDIA_LIBRARY_STORE_PATH` | `media-library.json` | biblioteca de mídia |
| `mediaSlots` | `MEDIA_SLOTS_STORE_PATH` | `media-slots.json` | slots de mídia |
| `mediaReplaceTransaction` | `MEDIA_REPLACE_TRANSACTION_PATH` | `private/media-replace-transaction.json` | journal de troca de mídia |
| `rateLimits` | `CMS_RATE_LIMITS_STORE_PATH` | `private/cms-rate-limits.json` | limites CMS |

## Superfícies adicionais e ownership

- `uploadsDir` é o único diretório público de mídia; imagens geram variantes WebP e vídeos preservam o formato permitido pelo contrato de mídia.
- Novos registros de imagem em `media-library.json` guardam `width`/`height` após a orientação EXIF e os pares físicos `optimizedWidth`/`optimizedHeight`, `thumbnailWidth`/`thumbnailHeight`, `mediumWidth`/`mediumHeight` e `largeWidth`/`largeHeight`. Registros legados podem não possuir esses campos; nenhuma dimensão é inferida a partir da configuração atual.
- `frontendPublicDir` é somente leitura para a biblioteca administrativa.
- O Landing Builder é acessado por HTTP interno autenticado; `cms/backend` não lê nem escreve `landings.json`, `media.json` ou a mídia do Builder.
- `cms/backend` é o escritor único de todos os destinos listados. `site/backend` não grava essas coleções e o Builder usa volume próprio.

Mutações compostas podem escrever stores em sequência e não são transações globais. A troca de referência de mídia mantém journal e rollback entre os JSONs envolvidos.
