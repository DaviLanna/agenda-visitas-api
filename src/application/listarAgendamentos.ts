import type { Agendamento } from "../domain/agendamento";
import type { AgendamentoRepository } from "../domain/agendamentoRepository";
import { ValidationError } from "../shared/errors";

export interface ListarAgendamentosInput {
  corretorId: string;
  data: string; // AAAA-MM-DD
}

export function listarAgendamentos(
  input: ListarAgendamentosInput,
  repo: AgendamentoRepository,
): Agendamento[] {
  if (!input.corretorId || typeof input.corretorId !== "string") {
    throw new ValidationError("corretorId é obrigatório.");
  }
  if (!input.data || !/^\d{4}-\d{2}-\d{2}$/.test(input.data)) {
    throw new ValidationError("data deve estar no formato YYYY-MM-DD.");
  }

  const agendamentos = repo.findByCorretorEDia(input.corretorId, input.data);
  return agendamentos.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
}
