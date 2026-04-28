# FeedFlow — Agregador RSS

> Agregador RSS/Atom moderno e minimalista. Adicione qualquer site pela URL original e o FeedFlow detecta o feed automaticamente.

![FeedFlow Screenshot](docs/screenshot.png)

## ✨ Funcionalidades

- **Detecção automática de feed** — cole qualquer URL de site; o FeedFlow procura por feeds RSS/Atom via `<link rel="alternate">` e caminhos comuns
- **Notificação de ausência** — informa claramente quando nenhum feed é encontrado no site
- **Lista de inscrições** — gerencie todos os seus feeds em um só lugar
- **Leitura integrada** — leia o resumo diretamente no app via painel lateral
- **Artigos salvos** — marque artigos com ⭐ para ler depois
- **Marcar como lido** — controle de leitura por artigo ou em massa
- **Importar/Exportar OPML** — compatível com outros agregadores (Feedly, NewsBlur, etc.)
- **Tema claro/escuro** — alternável pelo botão na barra superior
- **Atualização automática** — feeds são atualizados a cada 15 minutos
- **100% local** — nenhum dado é enviado para servidores; tudo fica no `localStorage`
- **Zero dependências** — HTML, CSS e JavaScript puro, sem frameworks ou build steps

## 🚀 Como usar

### Opção 1 — GitHub Pages (recomendado)

1. Faça fork deste repositório
2. Vá em **Settings → Pages → Source: main branch / root**
3. Acesse `https://<seu-usuario>.github.io/rss-aggregator`

### Opção 2 — Local

```bash
git clone https://github.com/seu-usuario/rss-aggregator.git
cd rss-aggregator
# Abra index.html com qualquer servidor HTTP local:
npx serve .
# ou
python3 -m http.server 8080
```

> **Nota:** abrir `index.html` direto pelo sistema de arquivos (`file://`) pode falhar devido às políticas de CORS dos proxies. Use um servidor local.

## 📁 Estrutura do Projeto

```
rss-aggregator/
├── index.html              # Ponto de entrada
├── src/
│   ├── css/
│   │   └── main.css        # Estilos (variáveis CSS, layout, componentes)
│   └── js/
│       ├── storage.js      # Persistência localStorage
│       ├── feed-detector.js # Detecção automática de feeds
│       ├── feed-parser.js  # Parser RSS 2.0 / Atom 1.0
│       ├── opml.js         # Importação/exportação OPML
│       ├── ui.js           # Renderização e interações DOM
│       └── app.js          # Controlador principal
├── public/
│   └── favicon.svg
└── docs/
    └── ARCHITECTURE.md
```

## 🔍 Como funciona a detecção de feeds

Quando você adiciona uma URL, o FeedDetector segue esta sequência:

1. **URL direta** — verifica se a URL em si já é um feed RSS/Atom (pelo `Content-Type` ou conteúdo XML)
2. **`<link rel="alternate">`** — faz o download da página e procura por tags de feed no `<head>` HTML
3. **Caminhos comuns** — testa automaticamente `/feed`, `/rss`, `/atom.xml`, `/feed.xml` e outros 10+ caminhos típicos
4. **Falha informada** — se nenhum feed for encontrado, o usuário é notificado claramente

Para contornar o CORS do navegador, as requisições passam por proxies públicos (`allorigins.win` e `corsproxy.io`).

## 🗂️ Formatos suportados

| Formato | Versão |
|---------|--------|
| RSS     | 0.91, 1.0, 2.0 |
| Atom    | 1.0 |
| OPML    | 2.0 (importação e exportação) |

## 💾 Armazenamento

Todos os dados ficam no `localStorage` do navegador:

| Chave | Conteúdo |
|-------|----------|
| `feedflow_feeds` | Lista de inscrições |
| `feedflow_articles` | Últimos 500 artigos |
| `feedflow_read` | IDs de artigos lidos |
| `feedflow_starred` | IDs de artigos salvos |
| `feedflow_settings` | Preferências (tema, filtro) |

## ⌨️ Atalhos

| Ação | Atalho |
|------|--------|
| Fechar modal | `Esc` |
| Adicionar feed | `Enter` no campo de URL |

## 🛠️ Personalização

Edite as variáveis CSS em `src/css/main.css` para personalizar cores, fontes e layout:

```css
:root {
  --accent: #f0a500;   /* cor de destaque */
  --bg:     #0e0f11;   /* fundo principal */
  --font-display: 'Syne', sans-serif;
}
```

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/minha-feature`
3. Commit: `git commit -m 'feat: adiciona minha feature'`
4. Push: `git push origin feature/minha-feature`
5. Abra um Pull Request

## 📄 Licença

MIT — veja [LICENSE](LICENSE) para detalhes.

---

Feito com ☕ e XML puro.
