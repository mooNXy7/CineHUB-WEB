# CineHUB WEB

Repositório oficial e independente da versão WEB do CineHUB.

- Repositório: https://github.com/mooNXy7/CineHUB-WEB
- Plataforma: Cloudflare Pages
- Projeto Cloudflare: `cinehub-web`
- Branch de produção: `main`
- Diretório raiz do projeto: `/`
- Diretório de saída: `.`
- Aplicativo mobile: separado em https://github.com/mooNXy7/CineHUB
- Aplicativo TV: separado em https://github.com/mooNXy7/CineHUB-TV

O Cloudflare Pages deve publicar os arquivos deste repositório diretamente a partir da raiz. Não sincronizar mais a pasta `CineHUB_WEB` do repositório mobile.

As listas grandes de IPTV que ultrapassam o limite de arquivos do Pages devem continuar sendo consumidas por fontes remotas, conforme o registro de fontes do projeto.


Cloudflare deployment trigger: every push to `main` is included by the Pages source path filter (`**`).
