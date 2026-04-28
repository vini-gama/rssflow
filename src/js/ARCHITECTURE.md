# FeedFlow — Arquitetura

## Visão Geral

O FeedFlow é uma Single-Page Application (SPA) construída com JavaScript puro (Vanilla JS), sem frameworks ou dependências de build. Cada módulo é um IIFE (Immediately Invoked Function Expression) exposto como variável global.

## Módulos

### `Storage` (`storage.js`)
Camada de persistência. Abstrai o `localStorage` com métodos tipados para feeds, artigos, estado de leitura e configurações.

**Responsabilidades:**
- CRUD de feeds
- Armazenamento e deduplicação de artigos (limite: 500)
- Rastreamento de artigos lidos e salvos
- Configurações do usuário (tema, filtro ativo)

### `FeedDetector` (`feed-detector.js`)
Detecta feeds RSS/Atom a partir de qualquer URL de site.

**Estratégia de detecção:**
1. Testa a URL diretamente como feed
2. Busca `<link rel="alternate">` no HTML da página
3. Testa ~15 caminhos comuns (`/feed`, `/rss.xml`, etc.)

**CORS:** Usa proxies públicos (`allorigins.win`, `corsproxy.io`) em cascata.

### `FeedParser` (`feed-parser.js`)
Parser XML para RSS 2.0, RSS 1.0 e Atom 1.0.

**Normalização de artigos:**
```js
{
  id, feedId, title, link,
  summary,    // texto limpo, até 300 chars
  content,    // HTML original (sanitizado na UI)
  date,       // ISO 8601
  image,      // URL da imagem de capa (se disponível)
  categories, // até 3 categorias/tags
}
```

### `OPML` (`opml.js`)
Importação e exportação de listas de feeds no formato OPML 2.0.

### `UI` (`ui.js`)
Renderização DOM e componentes de UI. Stateless — recebe dados e callbacks.

**Componentes:**
- `renderFeedList()` — sidebar com lista de inscrições
- `renderArticles()` — grade de cards de artigos
- `openModal()` — painel de leitura lateral
- `toast()` — notificações temporárias

### `App` (`app.js`)
Controlador principal. Gerencia o estado da aplicação, coordena os módulos e liga os eventos.

**Estado:**
```js
{
  activeFeedId: string | null,  // null = mostrar todos
  filter: 'all' | 'unread' | 'starred',
  isAdding: boolean,
}
```

## Fluxo de Adição de Feed

```
URL do usuário
     │
     ▼
FeedDetector.detect()
     │
     ├── proxyFetch(url)
     │        ├── looksLikeFeed? → feedUrl encontrado
     │        └── é HTML? → extractFeedLinksFromHtml()
     │
     ├── looksLikeFeed? → feedUrl encontrado
     │
     └── loop COMMON_FEED_PATHS
              ├── hit? → feedUrl encontrado
              └── all miss → null (informar usuário)
     │
     ▼
FeedParser.parse(xmlString)
     │
     ▼
Storage.saveFeed() + Storage.saveArticles()
     │
     ▼
UI.renderAll()
```

## Decisões de Design

| Decisão | Motivo |
|---------|--------|
| Vanilla JS sem frameworks | Zero build step, hospedagem estática simples |
| IIFEs como módulos | Encapsulamento sem ES Modules (funciona com `file://`) |
| `localStorage` | Sem necessidade de backend, privacidade do usuário |
| Proxies CORS públicos | Browsers bloqueiam cross-origin; sem servidor próprio |
| Limite de 500 artigos | Evita estouro do localStorage (~5MB limite) |
| DOMParser para XML | Nativo no browser, sem dependência externa |
