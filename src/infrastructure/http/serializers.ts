import type { Agendamento } from "../../domain/agendamento";

const BRASILIA_OFFSET = "-03:00";

function toISOBrasilia(date: Date): string {
  const local = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  // Remove os milissegundos e substitui o sufixo Z pelo offset de Brasília
  return local.toISOString().replace(/\.\d{3}Z$/, BRASILIA_OFFSET);
}

export function serializeAgendamento(a: Agendamento): Record<string, unknown> {
  return {
    agendamentoId: a.agendamentoId,
    corretorId: a.corretorId,
    imovelId: a.imovelId,
    inicio: toISOBrasilia(a.inicio),
    fim: toISOBrasilia(a.fim),
    status: a.status,
  };
}

export function serializeSugestoes(datas: Date[]): string[] {
  return datas.map(toISOBrasilia);
}
