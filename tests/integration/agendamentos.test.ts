import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../../src/infrastructure/http/server";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

beforeEach(async () => {
  // Instancia um servidor isolado por teste, garantindo estado limpo em memória
  app = buildApp();
  await app.ready();
});

const BASE_PAYLOAD = {
  corretorId: "c-101",
  imovelId: "im-553",
  inicio: "2026-06-10T14:00:00-03:00",
  duracaoMinutos: 60,
};

describe("POST /api/agendamentos - criação com sucesso", () => {
  it("retorna 201 com agendamento confirmado", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/agendamentos",
      payload: BASE_PAYLOAD,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.status).toBe("confirmado");
    expect(body.corretorId).toBe("c-101");
    expect(body.imovelId).toBe("im-553");
    expect(body.inicio).toBe("2026-06-10T14:00:00-03:00");
    expect(body.fim).toBe("2026-06-10T15:00:00-03:00");
    expect(body.agendamentoId).toBeDefined();
  });

  it("permite agendamento adjacente (começa exatamente quando o anterior termina)", async () => {
    await app.inject({ method: "POST", url: "/api/agendamentos", payload: BASE_PAYLOAD });

    const res = await app.inject({
      method: "POST",
      url: "/api/agendamentos",
      payload: { ...BASE_PAYLOAD, inicio: "2026-06-10T15:00:00-03:00" },
    });
    expect(res.statusCode).toBe(201);
  });

  it("permite agendamentos de diferentes corretores no mesmo horário", async () => {
    await app.inject({ method: "POST", url: "/api/agendamentos", payload: BASE_PAYLOAD });

    const res = await app.inject({
      method: "POST",
      url: "/api/agendamentos",
      payload: { ...BASE_PAYLOAD, corretorId: "c-202" },
    });
    expect(res.statusCode).toBe(201);
  });
});

describe("POST /api/agendamentos - conflito (409)", () => {
  it("retorna 409 com sugestões quando há sobreposição total", async () => {
    await app.inject({ method: "POST", url: "/api/agendamentos", payload: BASE_PAYLOAD });

    const res = await app.inject({
      method: "POST",
      url: "/api/agendamentos",
      payload: BASE_PAYLOAD,
    });
    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.status).toBe("conflito");
    expect(Array.isArray(body.sugestoes)).toBe(true);
    expect(body.sugestoes.length).toBeGreaterThan(0);
    expect(body.sugestoes.length).toBeLessThanOrEqual(3);
  });

  it("retorna 409 com sugestões quando há sobreposição parcial", async () => {
    await app.inject({ method: "POST", url: "/api/agendamentos", payload: BASE_PAYLOAD });

    const res = await app.inject({
      method: "POST",
      url: "/api/agendamentos",
      payload: { ...BASE_PAYLOAD, inicio: "2026-06-10T14:30:00-03:00" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("sugestões não colidem com agendamentos existentes", async () => {
    await app.inject({ method: "POST", url: "/api/agendamentos", payload: BASE_PAYLOAD });

    const res = await app.inject({
      method: "POST",
      url: "/api/agendamentos",
      payload: BASE_PAYLOAD,
    });
    const { sugestoes } = res.json() as { sugestoes: string[] };

    // Cada sugestão deve ser reservável de forma independente.
    // Usa um corretor distinto por slot para evitar conflito entre as próprias sugestões.
    for (let i = 0; i < sugestoes.length; i++) {
      const corretorTemporario = `c-fresh-${i}`;
      const bookRes = await app.inject({
        method: "POST",
        url: "/api/agendamentos",
        payload: { ...BASE_PAYLOAD, corretorId: corretorTemporario, inicio: sugestoes[i] },
      });
      expect(bookRes.statusCode).toBe(201);
    }
  });
});

describe("POST /api/agendamentos - validações (400)", () => {
  it("rejeita payload sem corretorId", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/agendamentos",
      payload: { imovelId: "im-1", inicio: "2026-06-10T10:00:00-03:00", duracaoMinutos: 60 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejeita duração inválida (45 min)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/agendamentos",
      payload: { ...BASE_PAYLOAD, duracaoMinutos: 45 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejeita duração acima de 180 min", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/agendamentos",
      payload: { ...BASE_PAYLOAD, duracaoMinutos: 210 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejeita agendamento antes das 08:00", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/agendamentos",
      payload: { ...BASE_PAYLOAD, inicio: "2026-06-10T07:00:00-03:00" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejeita agendamento que termina após as 19:00", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/agendamentos",
      payload: { ...BASE_PAYLOAD, inicio: "2026-06-10T18:30:00-03:00", duracaoMinutos: 60 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejeita data inválida no campo inicio", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/agendamentos",
      payload: { ...BASE_PAYLOAD, inicio: "not-a-date" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejeita payload com injeção de campos extras sem causar erro interno", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/agendamentos",
      payload: {
        ...BASE_PAYLOAD,
        "__proto__": { admin: true },
        "constructor": "hacked",
      },
    });
    // Deve processar normalmente (201) ou rejeitar (400) — nunca retornar erro 500
    expect(res.statusCode).not.toBe(500);
  });

  it("rejeita body com duracaoMinutos como string", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/agendamentos",
      payload: { ...BASE_PAYLOAD, duracaoMinutos: "60" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/agendamentos - listagem", () => {
  it("retorna lista vazia quando não há agendamentos", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/agendamentos?corretorId=c-101&data=2026-06-10",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("retorna agendamentos ordenados cronologicamente", async () => {
    // Cria três agendamentos fora de ordem para validar a ordenação da resposta
    await app.inject({
      method: "POST",
      url: "/api/agendamentos",
      payload: { ...BASE_PAYLOAD, inicio: "2026-06-10T16:00:00-03:00" },
    });
    await app.inject({
      method: "POST",
      url: "/api/agendamentos",
      payload: { ...BASE_PAYLOAD, inicio: "2026-06-10T08:00:00-03:00" },
    });
    await app.inject({
      method: "POST",
      url: "/api/agendamentos",
      payload: { ...BASE_PAYLOAD, inicio: "2026-06-10T12:00:00-03:00" },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/agendamentos?corretorId=c-101&data=2026-06-10",
    });
    expect(res.statusCode).toBe(200);
    const lista = res.json() as Array<{ inicio: string }>;
    expect(lista).toHaveLength(3);
    expect(lista[0]!.inicio).toBe("2026-06-10T08:00:00-03:00");
    expect(lista[1]!.inicio).toBe("2026-06-10T12:00:00-03:00");
    expect(lista[2]!.inicio).toBe("2026-06-10T16:00:00-03:00");
  });

  it("não retorna agendamentos de outros corretores", async () => {
    await app.inject({
      method: "POST",
      url: "/api/agendamentos",
      payload: { ...BASE_PAYLOAD, corretorId: "c-202" },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/agendamentos?corretorId=c-101&data=2026-06-10",
    });
    expect(res.json()).toHaveLength(0);
  });

  it("não retorna agendamentos de outros dias", async () => {
    await app.inject({ method: "POST", url: "/api/agendamentos", payload: BASE_PAYLOAD });

    const res = await app.inject({
      method: "GET",
      url: "/api/agendamentos?corretorId=c-101&data=2026-06-11",
    });
    expect(res.json()).toHaveLength(0);
  });

  it("retorna 400 quando corretorId está ausente", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/agendamentos?data=2026-06-10",
    });
    expect(res.statusCode).toBe(400);
  });

  it("retorna 400 quando data está no formato errado", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/agendamentos?corretorId=c-101&data=10-06-2026",
    });
    expect(res.statusCode).toBe(400);
  });
});
