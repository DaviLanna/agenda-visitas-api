import { describe, it, expect } from "vitest";
import {
  validarDuracao,
  validarJanelaAtendimento,
  hasSobreposicao,
  sugerirHorarios,
  dataBrasilia,
  inicioDiaBrasilia,
} from "../../src/domain/regras";
import { ValidationError } from "../../src/shared/errors";
import type { Agendamento } from "../../src/domain/agendamento";

// Utilitário: interpreta uma string ISO 8601 com offset como objeto Date
function brDate(iso: string): Date {
  return new Date(iso);
}

function makeAgendamento(inicio: Date, fim: Date): Agendamento {
  return {
    agendamentoId: "ag-test",
    corretorId: "c-101",
    imovelId: "im-001",
    inicio,
    fim,
    status: "confirmado",
  };
}

describe("validarDuracao", () => {
  it.each([30, 60, 90, 120, 150, 180])("aceita duração válida %d", (d) => {
    expect(() => validarDuracao(d)).not.toThrow();
  });

  it.each([0, 15, 45, 200, -30, 31])("rejeita duração inválida %d", (d) => {
    expect(() => validarDuracao(d)).toThrow(ValidationError);
  });
});

describe("validarJanelaAtendimento", () => {
  it("aceita início às 08:00 e fim às 09:00 Brasília", () => {
    const inicio = brDate("2026-06-10T08:00:00-03:00");
    const fim = brDate("2026-06-10T09:00:00-03:00");
    expect(() => validarJanelaAtendimento(inicio, fim)).not.toThrow();
  });

  it("aceita início às 18:00 e fim às 19:00 Brasília (limite exato)", () => {
    const inicio = brDate("2026-06-10T18:00:00-03:00");
    const fim = brDate("2026-06-10T19:00:00-03:00");
    expect(() => validarJanelaAtendimento(inicio, fim)).not.toThrow();
  });

  it("rejeita início antes das 08:00", () => {
    const inicio = brDate("2026-06-10T07:30:00-03:00");
    const fim = brDate("2026-06-10T08:30:00-03:00");
    expect(() => validarJanelaAtendimento(inicio, fim)).toThrow(ValidationError);
  });

  it("rejeita fim após as 19:00", () => {
    const inicio = brDate("2026-06-10T18:30:00-03:00");
    const fim = brDate("2026-06-10T19:30:00-03:00");
    expect(() => validarJanelaAtendimento(inicio, fim)).toThrow(ValidationError);
  });
});

describe("hasSobreposicao", () => {
  const a10_11 = makeAgendamento(
    brDate("2026-06-10T10:00:00-03:00"),
    brDate("2026-06-10T11:00:00-03:00"),
  );

  it("detecta sobreposição parcial (candidato começa no meio)", () => {
    expect(hasSobreposicao(a10_11, {
      inicio: brDate("2026-06-10T10:30:00-03:00"),
      fim: brDate("2026-06-10T11:30:00-03:00"),
    })).toBe(true);
  });

  it("detecta sobreposição total (candidato engloba o existente)", () => {
    expect(hasSobreposicao(a10_11, {
      inicio: brDate("2026-06-10T09:00:00-03:00"),
      fim: brDate("2026-06-10T12:00:00-03:00"),
    })).toBe(true);
  });

  it("não detecta sobreposição quando adjacente (fim == início do próximo)", () => {
    expect(hasSobreposicao(a10_11, {
      inicio: brDate("2026-06-10T11:00:00-03:00"),
      fim: brDate("2026-06-10T12:00:00-03:00"),
    })).toBe(false);
  });

  it("não detecta sobreposição quando candidato está antes", () => {
    expect(hasSobreposicao(a10_11, {
      inicio: brDate("2026-06-10T08:00:00-03:00"),
      fim: brDate("2026-06-10T10:00:00-03:00"),
    })).toBe(false);
  });

  it("não detecta sobreposição quando candidato está depois", () => {
    expect(hasSobreposicao(a10_11, {
      inicio: brDate("2026-06-10T11:00:00-03:00"),
      fim: brDate("2026-06-10T12:00:00-03:00"),
    })).toBe(false);
  });
});

describe("sugerirHorarios", () => {
  it("retorna slots a partir das 08:00 quando não há agendamentos", () => {
    const ref = brDate("2026-06-10T14:00:00-03:00");
    const sugestoes = sugerirHorarios([], ref, 60);
    expect(sugestoes).toHaveLength(3);
    // Primeira sugestão deve ser às 08:00 de Brasília
    expect(sugestoes[0].toISOString()).toBe(brDate("2026-06-10T08:00:00-03:00").toISOString());
  });

  it("pula horários ocupados e sugere os próximos livres", () => {
    // Corretor tem dois agendamentos consecutivos: 08:00–09:00 e 09:00–10:00
    const existentes: Agendamento[] = [
      makeAgendamento(brDate("2026-06-10T08:00:00-03:00"), brDate("2026-06-10T09:00:00-03:00")),
      makeAgendamento(brDate("2026-06-10T09:00:00-03:00"), brDate("2026-06-10T10:00:00-03:00")),
    ];
    const ref = brDate("2026-06-10T09:00:00-03:00");
    const sugestoes = sugerirHorarios(existentes, ref, 60);
    expect(sugestoes.length).toBeGreaterThan(0);
    // Primeiro slot livre deve ser às 10:00
    expect(sugestoes[0].toISOString()).toBe(brDate("2026-06-10T10:00:00-03:00").toISOString());
  });

  it("retorna no máximo 3 sugestões", () => {
    const sugestoes = sugerirHorarios([], brDate("2026-06-10T14:00:00-03:00"), 30);
    expect(sugestoes.length).toBeLessThanOrEqual(3);
  });

  it("retorna lista vazia se não houver espaço no dia", () => {
    // Preenche toda a janela de atendimento com slots de 30 min (08:00–19:00 = 22 slots)
    const existentes: Agendamento[] = [];
    let t = brDate("2026-06-10T08:00:00-03:00");
    while (t < brDate("2026-06-10T19:00:00-03:00")) {
      const fim = new Date(t.getTime() + 30 * 60 * 1000);
      existentes.push(makeAgendamento(t, fim));
      t = fim;
    }
    const sugestoes = sugerirHorarios(existentes, brDate("2026-06-10T10:00:00-03:00"), 30);
    expect(sugestoes).toHaveLength(0);
  });
});

describe("dataBrasilia", () => {
  it("extrai a data de Brasília a partir de um instante UTC", () => {
    // 2026-06-10T01:00:00Z equivale a 2026-06-09T22:00:00-03:00
    expect(dataBrasilia(new Date("2026-06-10T01:00:00Z"))).toBe("2026-06-09");
  });

  it("extrai a data correta próxima à meia-noite de Brasília", () => {
    // 2026-06-10T02:59:00Z equivale a 2026-06-09T23:59:00-03:00
    expect(dataBrasilia(new Date("2026-06-10T02:59:00Z"))).toBe("2026-06-09");
    // 2026-06-10T03:00:00Z equivale a 2026-06-10T00:00:00-03:00
    expect(dataBrasilia(new Date("2026-06-10T03:00:00Z"))).toBe("2026-06-10");
  });
});
