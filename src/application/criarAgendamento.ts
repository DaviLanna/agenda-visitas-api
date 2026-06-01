import { randomUUID } from "crypto";
import type { Agendamento } from "../domain/agendamento";
import type { AgendamentoRepository } from "../domain/agendamentoRepository";
import {
  validarDuracao,
  validarJanelaAtendimento,
  hasSobreposicao,
  sugerirHorarios,
} from "../domain/regras";
import { ValidationError } from "../shared/errors";

export interface CriarAgendamentoInput {
  corretorId: string;
  imovelId: string;
  inicio: string;
  duracaoMinutos: number;
}

export interface CriarAgendamentoOutput {
  agendamento: Agendamento;
}

export type CriarResult =
  | { tipo: "sucesso"; agendamento: Agendamento }
  | { tipo: "conflito"; sugestoes: Date[] };

function parseDateWithOffset(raw: string): Date {
  const d = new Date(raw);
  if (isNaN(d.getTime())) {
    throw new ValidationError(`Data inválida: "${raw}"`);
  }
  return d;
}

export function criarAgendamento(
  input: CriarAgendamentoInput,
  repo: AgendamentoRepository,
): CriarResult {
  if (!input.corretorId || typeof input.corretorId !== "string") {
    throw new ValidationError("corretorId é obrigatório.");
  }
  if (!input.imovelId || typeof input.imovelId !== "string") {
    throw new ValidationError("imovelId é obrigatório.");
  }
  if (typeof input.duracaoMinutos !== "number" || !Number.isInteger(input.duracaoMinutos)) {
    throw new ValidationError("duracaoMinutos deve ser um número inteiro.");
  }

  validarDuracao(input.duracaoMinutos);

  const inicio = parseDateWithOffset(input.inicio);
  const fim = new Date(inicio.getTime() + input.duracaoMinutos * 60 * 1000);

  validarJanelaAtendimento(inicio, fim);

  const existentes = repo.findByCorretor(input.corretorId);

  const conflito = existentes.some((a) => hasSobreposicao(a, { inicio, fim }));
  if (conflito) {
    const sugestoes = sugerirHorarios(existentes, inicio, input.duracaoMinutos);
    return { tipo: "conflito", sugestoes };
  }

  const agendamento: Agendamento = {
    agendamentoId: `ag-${randomUUID()}`,
    corretorId: input.corretorId,
    imovelId: input.imovelId,
    inicio,
    fim,
    status: "confirmado",
  };

  repo.save(agendamento);
  return { tipo: "sucesso", agendamento };
}
