# Contratos do CMS Spring

- `endpoint-manifest.v1.json`: fonte consumível dos 97 endpoints explícitos, wildcard de uploads, autorização, request profile, stores e efeitos.
- `endpoint-matrix.md`: leitura humana do inventário e das regras de protocolo.
- `storage-contract-v1.md`: paths físicos, ownership e efeitos dos 24 destinos configuráveis, uploads e assets.
- `../../../docs/spring-mvc/runtime-topology.md`: portas, ingressos, gateway, ambiente, artefatos e rollback JAR.

Validação mínima do inventário:

```powershell
$manifest = Get-Content -Raw cms/backend/contracts/endpoint-manifest.v1.json | ConvertFrom-Json
$manifest.endpoints.Count # 95
$manifest.endpoints | Group-Object method,path | Where-Object Count -gt 1 # vazio
```

O manifesto preserva campos derivados da captura histórica Node/Express quando eles descrevem bytes, headers ou ordem de filtros. Eles são baseline documental, não dependência de uma árvore de runtime removida.
