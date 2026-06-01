import type { Agendamento } from "./agendamento";

export interface AgendamentoRepository {
  save(agendamento: Agendamento): void;
  findByCorretor(corretorId: string): Agendamento[];
  findByCorretorEDia(corretorId: string, data: string): Agendamento[];
}
