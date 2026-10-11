# CineHUB WEB

A versão WEB oficial do CineHUB está neste diretório.

- Fonte: PT1 + PT2
- Plataforma: WEB
- Android TV: mantido separado em `CineHUB_TV_Android/`
- Deploy: Cloudflare Pages — `cinehub-web`

Deployment pipeline: Cloudflare Pages `cinehub-web`.

Source connection refreshed.

Cloudflare Pages: repository root `/`, output directory `CineHUB_WEB`, production branch `main`.

Deployment trigger validation: 2026-10-05.

Production trigger mode: repository-wide push, with Cloudflare publishing only `CineHUB_WEB` as the Pages output. Android TV remains in its own directory/project.

Large IPTV snapshots over Cloudflare Pages 25 MiB are removed during the Pages build and consumed remotely from IPTV-Brasil; the app's source registry was updated accordingly.
