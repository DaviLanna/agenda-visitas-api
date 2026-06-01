# Agenda de Visitas API — Morada.ai

Microsserviço REST em TypeScript para gerenciamento de agendamentos de visitas à imóveis, evitando sobreposições de horário e sugerindo alternativas.

---

## Arquitetura

```
src/
├── domain/              # Entidades, regras de negócio puras e interface do repositório
│   ├── agendamento.ts           # Tipo Agendamento
│   ├── agendamentoRepository.ts # Interface do repositório (porta)
│   └── regras.ts                # Validações e algoritmo de sugestão
├── application/         # Casos de uso (orquestração, sem dependência de framework)
│   ├── criarAgendamento.ts
│   └── listarAgendamentos.ts
├── infrastructure/      # Adaptadores externos
│   ├── memory/
│   │   └── inMemoryAgendamentoRepository.ts  # Implementação do repositório em memória
│   └── http/
│       ├── routes.ts       # Roteamento Fastify
│       ├── serializers.ts  # Conversão de datas para ISO -03:00
│       └── server.ts       # Entry point
└── shared/
    └── errors.ts        # Erros de domínio tipados
```

### Decisões técnicas

- **Fastify** — framework HTTP com excelente suporte a TypeScript e injeção por objeto.
- **Vitest** — test runner nativo a ESM/TypeScript, sem build step.
- **`tsx`** — transpilação on-the-fly para desenvolvimento.

### Estrutura de dados

O repositório em memória usa `Map<corretorId, Agendamento[]>`:

- Chave: `corretorId` (string) — acesso O(1) aos agendamentos de um corretor.
- Valor: array de `Agendamento`, percorrido linearmente para verificar sobreposições.
- Correto para o escopo do desafio (agenda diária de corretores individuais).

### Timezone

Datas de entrada podem ter qualquer offset ISO 8601. `new Date(isoString)` normaliza para UTC internamente. A janela de atendimento (08:00–19:00) é verificada no fuso `America/Sao_Paulo` (UTC-3 fixo, sem DST no Brasil).

---

## Pré-requisitos

- Node.js ≥ 18
- npm

---

## Instalação

```bash
npm install
```

---

## Rodar o servidor

**Modo desenvolvimento (hot-reload):**
```bash
npm run dev
```

**Modo produção (compilar + executar):**
```bash
npm run build
npm start
```

O servidor escuta em `http://localhost:3000` por padrão. Para alterar a porta:
```bash
PORT=8080 npm run dev
```

---

## Rodar os testes

```bash
npm test
```

Saída esperada: **47 testes** passando (27 unitários + 20 de integração).

---

## Endpoints

### `POST /api/agendamentos`

Cria um agendamento. Valida janela de atendimento, duração e conflitos.

**Corpo:**
```json
{
  "corretorId": "c-101",
  "imovelId":   "im-553",
  "inicio":     "2026-06-10T14:00:00-03:00",
  "duracaoMinutos": 60
}
```

**Sucesso — 201 Created:**
```json
{
  "agendamentoId": "ag-...",
  "corretorId":    "c-101",
  "imovelId":      "im-553",
  "inicio":        "2026-06-10T14:00:00-03:00",
  "fim":           "2026-06-10T15:00:00-03:00",
  "status":        "confirmado"
}
```

**Conflito — 409 Conflict:**
```json
{
  "status":  "conflito",
  "motivo":  "Corretor indisponível no horário solicitado",
  "sugestoes": [
    "2026-06-10T08:00:00-03:00",
    "2026-06-10T08:30:00-03:00",
    "2026-06-10T09:00:00-03:00"
  ]
}
```

**Payload inválido — 400 Bad Request:**
```json
{ "status": "erro", "motivo": "Duração inválida: 45min. Valores aceitos: 30, 60, 90, 120, 150, 180." }
```

---

### `GET /api/agendamentos?corretorId=c-101&data=2026-06-10`

Lista agendamentos confirmados do corretor no dia, ordenados cronologicamente.

**Sucesso — 200 OK:**
```json
[
  {
    "agendamentoId": "ag-...",
    "corretorId":    "c-101",
    "imovelId":      "im-553",
    "inicio":        "2026-06-10T14:00:00-03:00",
    "fim":           "2026-06-10T15:00:00-03:00",
    "status":        "confirmado"
  }
]
```

---

## Exemplos com curl

> **Windows (PowerShell):** use `curl.exe` e backtick `` ` `` para quebra de linha.  
> **Linux/macOS:** use `curl` e `\` normalmente.

### Windows (PowerShell)

```powershell
# 1. Criar agendamento
curl.exe -s -X POST http://localhost:3000/api/agendamentos `
  -H "Content-Type: application/json" `
  -d '{\"corretorId\":\"c-101\",\"imovelId\":\"im-553\",\"inicio\":\"2026-06-10T14:00:00-03:00\",\"duracaoMinutos\":60}'

# 2. Tentar criar no mesmo horário (gera 409 com sugestões)
curl.exe -s -X POST http://localhost:3000/api/agendamentos `
  -H "Content-Type: application/json" `
  -d '{\"corretorId\":\"c-101\",\"imovelId\":\"im-999\",\"inicio\":\"2026-06-10T14:30:00-03:00\",\"duracaoMinutos\":60}'

# 3. Listar agenda do corretor no dia
curl.exe -s "http://localhost:3000/api/agendamentos?corretorId=c-101&data=2026-06-10"

# 4. Criar com duração inválida (400)
curl.exe -s -X POST http://localhost:3000/api/agendamentos `
  -H "Content-Type: application/json" `
  -d '{\"corretorId\":\"c-101\",\"imovelId\":\"im-553\",\"inicio\":\"2026-06-10T10:00:00-03:00\",\"duracaoMinutos\":45}'

# 5. Criar fora da janela de atendimento (400)
curl.exe -s -X POST http://localhost:3000/api/agendamentos `
  -H "Content-Type: application/json" `
  -d '{\"corretorId\":\"c-101\",\"imovelId\":\"im-553\",\"inicio\":\"2026-06-10T18:30:00-03:00\",\"duracaoMinutos\":60}'
```

### Linux / macOS

```bash
# 1. Criar agendamento
curl -s -X POST http://localhost:3000/api/agendamentos \
  -H "Content-Type: application/json" \
  -d '{"corretorId":"c-101","imovelId":"im-553","inicio":"2026-06-10T14:00:00-03:00","duracaoMinutos":60}'

# 2. Tentar criar no mesmo horário (gera 409 com sugestões)
curl -s -X POST http://localhost:3000/api/agendamentos \
  -H "Content-Type: application/json" \
  -d '{"corretorId":"c-101","imovelId":"im-999","inicio":"2026-06-10T14:30:00-03:00","duracaoMinutos":60}'

# 3. Listar agenda do corretor no dia
curl -s "http://localhost:3000/api/agendamentos?corretorId=c-101&data=2026-06-10"

# 4. Criar com duração inválida (400)
curl -s -X POST http://localhost:3000/api/agendamentos \
  -H "Content-Type: application/json" \
  -d '{"corretorId":"c-101","imovelId":"im-553","inicio":"2026-06-10T10:00:00-03:00","duracaoMinutos":45}'

# 5. Criar fora da janela de atendimento (400)
curl -s -X POST http://localhost:3000/api/agendamentos \
  -H "Content-Type: application/json" \
  -d '{"corretorId":"c-101","imovelId":"im-553","inicio":"2026-06-10T18:30:00-03:00","duracaoMinutos":60}'
```

---

## Regras de negócio implementadas

| Regra | Implementação |
|---|---|
| Janela 08:00–19:00 (Brasília) | `validarJanelaAtendimento` em `src/domain/regras.ts` |
| Durações válidas (30–180, múlt. 30) | `validarDuracao` em `src/domain/regras.ts` |
| Sem sobreposição (adjacência permitida) | `hasSobreposicao` — `a.inicio < b.fim && b.inicio < a.fim` |
| Sugestões determinísticas (até 3) | `sugerirHorarios` — varre slots de 30min a partir das 08:00 |
| Timezone ISO 8601 com offset | `new Date(isoString)` normaliza para UTC |
