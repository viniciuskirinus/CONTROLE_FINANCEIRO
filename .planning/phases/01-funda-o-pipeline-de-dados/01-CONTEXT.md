# Phase 1: Fundação & Pipeline de Dados - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Infraestrutura base do app: repositório estruturado com pastas para JS modules, views, data e workflows; arquivos JSON seed com schema para config, categorias, métodos e transações particionadas por mês; design system Indigo aplicado; GitHub Pages servindo a aplicação; pipeline de leitura (fetch direto nos JSON) e escrita (repository_dispatch → Action → commit atômico) operacional com concurrency group.

Requirements: FUND-01, FUND-02, FUND-03, FUND-04, WRIT-01, WRIT-02, WRIT-03, UX-02, UX-03

</domain>

<decisions>
## Implementation Decisions

### App Shell & Navegação
- **D-01:** 5 abas na navegação do v1: Dashboard, Transação, Extrato, Comprovante, Config. Poupança e Relatório ficam para v2.
- **D-02:** Navegação em sidebar lateral no desktop — menu fixo na esquerda com ícones + labels.
- **D-03:** No mobile, comportamento responsivo da sidebar fica a critério do Claude (hamburger menu ou barra inferior — o que funcionar melhor para UX mobile).
- **D-04:** Responsividade mobile é requisito obrigatório desde a Phase 1.

### Estado Vazio / Primeiro Acesso
- **D-05:** Wizard de boas-vindas no primeiro acesso — passo a passo guiando: nome/pessoa, PAT do GitHub, categorias, e orientação para primeira transação. Wizard aparece quando config.json não existe ou está vazio.

### Write Path (decisões prévias confirmadas)
- **D-06:** Usar `repository_dispatch` como trigger de escrita (não Issues — confirmado pela pesquisa).
- **D-07:** Fine-Grained PAT com escopo mínimo (`Contents:write` + `Actions:write`), scoped ao repo específico.
- **D-08:** Workflow YAML com `concurrency: { group: data-writes, cancel-in-progress: false }` para serializar escritas.
- **D-09:** Action processa payload, valida dados, atualiza JSON correspondente, e faz commit atômico.

### JSON Schema (decisões prévias confirmadas)
- **D-10:** Transações particionadas por mês: `data/transactions/YYYY-MM.json` com `lastId` para geração incremental de IDs.
- **D-11:** Config extensível para N pessoas: array `people` ao invés de campos fixos pessoa1/pessoa2.
- **D-12:** Categorias separadas por tipo (expense/income) com subcategorias e cores.
- **D-13:** Schema versionado com campo `_schema_version` em cada arquivo JSON.

### Design System (decisões prévias confirmadas)
- **D-14:** Paleta Indigo preservada: `--p: #1a237e`, `--s: #3949ab`, `--ok: #2e7d32` (receita), `--err: #c62828` (despesa), `--warn: #e65100`.
- **D-15:** Fonte: Google Sans, Arial fallback.
- **D-16:** Formato brasileiro: R$ #.###,00, DD/MM/YYYY, timezone America/Sao_Paulo.

### Estrutura do Repositório (decisões prévias confirmadas)
- **D-17:** ES Modules nativos com `type="module"` nos scripts.
- **D-18:** Estrutura: `js/modules/` (serviços), `js/views/` (lógica de cada aba), `css/` (estilos), `data/` (JSON), `.github/workflows/` (Actions).

### Claude's Discretion
- Comportamento exato da navegação no mobile (hamburger vs bottom bar)
- Implementação detalhada do wizard de boas-vindas (número de passos, animações, skip option)
- Organização interna dos módulos ES (data-service, github-api, format, state)
- Design exato dos JSON schemas (campos específicos além dos já definidos)
- Dados seed padrão para categorias e métodos de pagamento (baseados no app GAS atual)
- CSS architecture (custom properties, file organization)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Arquitetura e Stack
- `.planning/research/ARCHITECTURE.md` — Componentes, data flow, JSON schema proposto, pipeline repository_dispatch
- `.planning/research/STACK.md` — Tecnologias com versões, rationale para cada escolha
- `.planning/research/SUMMARY.md` — Síntese com implicações para roadmap e flags de risco

### Pitfalls e Segurança
- `.planning/research/PITFALLS.md` — Race conditions, token exposure, command injection, stale data, repo bloat

### Codebase Atual (referência para migração de design/schema)
- `.planning/codebase/CONVENTIONS.md` — Padrões de código, CSS variables, error handling patterns
- `.planning/codebase/STACK.md` — Design system atual, paleta de cores, componentes CSS
- `.planning/codebase/INTEGRATIONS.md` — Schema das tabs do Google Sheets (referência para JSON schema)
- `.planning/codebase/STRUCTURE.md` — Estrutura de arquivos e schema de dados do app GAS

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **CSS Variables do app atual** (`:root` block em `WebApp.html`): Toda a paleta de cores, border-radius, font — pode ser extraída diretamente para o novo `css/variables.css`
- **Schema de dados do Google Sheets** (documentado em `STRUCTURE.md` e `INTEGRATIONS.md`): Referência para converter os 13 campos da tab Transações + Config key-value + Categorias para JSON format
- **Categorias padrão do `Setup.gs`**: Lista completa de categorias e subcategorias com ícones emoji e cores — pode ser convertida diretamente para `data/categories.json`
- **Métodos de pagamento padrão** (`METODOS_PADRAO` em `Configuracoes.gs`): Lista de métodos — direto para `data/payment-methods.json`

### Established Patterns
- **Result object pattern**: `{ sucesso: boolean, mensagem: string, ...data }` — a ser adaptado para o novo contexto (JSON responses do Action)
- **Config key-value**: Padrão simples que funciona bem — no novo app, evolui para JSON estruturado com array de people
- **Formatação brasileira**: `formatarMoeda()` e `formatarData()` de `Utils.gs` — lógica reutilizável para `js/modules/format.js`

### Integration Points
- **GitHub Pages**: `index.html` na raiz (ou pasta configurada) serve o app
- **GitHub API**: Frontend precisa chamar `POST /repos/{owner}/{repo}/dispatches` com PAT
- **JSON fetch**: Frontend lê `data/*.json` via fetch relativo (servido pelo Pages)

</code_context>

<specifics>
## Specific Ideas

- Sidebar lateral no desktop com visual limpo e moderno — não cluttered
- Wizard de boas-vindas para primeiro acesso, guiando o usuário de forma amigável
- Mobile responsivo é prioridade — não pode ser um afterthought

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-funda-o-pipeline-de-dados*
*Context gathered: 2026-04-08*
