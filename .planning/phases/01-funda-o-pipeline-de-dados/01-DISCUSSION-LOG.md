# Phase 1: Fundação & Pipeline de Dados - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-08
**Phase:** 1-Fundação & Pipeline de Dados
**Areas discussed:** App Shell

---

## Gray Area Selection

| Area | Description | Selected |
|------|-------------|----------|
| Schema dos JSON | Estrutura dos dados: campos de transação, formato de config para N pessoas, categorias | |
| Entrega do PAT ao frontend | Como o token chega ao browser? Injetado no build, usuário digita, localStorage? | |
| Dados seed iniciais | Quais categorias, métodos de pagamento e config padrão virão pré-configurados? | |
| App shell inicial | O que o index.html mostra: navegação por abas, skeleton, estado vazio? | ✓ |

**User's choice:** Only App Shell selected — other areas left to Claude's discretion.

---

## App Shell

### Navegação — Abas do v1

| Option | Description | Selected |
|--------|-------------|----------|
| Só as do v1 | Dashboard, Transação, Extrato, Comprovante, Config (5 abas) | ✓ |
| Mínimo | Começar só com Dashboard e Config, adicionar as outras conforme implementadas | |
| Todas planejadas | 7 abas desde o início, as não implementadas mostram 'Em breve' | |

**User's choice:** Só as do v1 (5 abas)

### Posição da Navegação

| Option | Description | Selected |
|--------|-------------|----------|
| Abas no topo | Como o app atual (horizontal, scrollable no mobile) | |
| Barra inferior | Estilo app mobile (5 ícones fixos embaixo) | |
| Sidebar lateral | Menu colapsável na esquerda | ✓ |

**User's choice:** Sidebar lateral

### Estado Vazio (primeiro acesso)

| Option | Description | Selected |
|--------|-------------|----------|
| Wizard de boas-vindas | Passo a passo: nome, PAT, categorias, primeira transação | ✓ |
| Dashboard vazio | Cards zerados + mensagem 'Adicione sua primeira transação' | |
| Config primeiro | Abre direto nas configurações para o usuário se configurar | |

**User's choice:** Wizard de boas-vindas

### Comportamento Mobile

| Option | Description | Selected |
|--------|-------------|----------|
| Hamburger menu | Ícone ≡ no topo, sidebar desliza da esquerda | |
| Barra inferior no mobile | Sidebar no desktop, barra de ícones embaixo no mobile | |
| Você decide | Faça o que funcionar melhor | ✓ |

**User's choice:** Claude's discretion
**Notes:** User emphasized "O sistema tem que ser responsivo para mobile também" — responsiveness is non-negotiable.

---

## Claude's Discretion

- Mobile navigation behavior (hamburger vs bottom bar)
- JSON schema details
- PAT delivery mechanism
- Seed data (categories, payment methods)
- Wizard implementation details

## Deferred Ideas

None
