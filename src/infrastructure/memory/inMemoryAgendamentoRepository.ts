import type { Agendamento } from "../../domain/agendamento";
import type { AgendamentoRepository } from "../../domain/agendamentoRepository";
import { dataBrasilia } from "../../domain/regras";

export class InMemoryAgendamentoRepository implements AgendamentoRepository {
  // Chave: corretorId — permite acesso O(1) à agenda de cada corretor
  private readonly store = new Map<string, Agendamento[]>();

  save(agendamento: Agendamento): void {
    const lista = this.store.get(agendamento.corretorId) ?? [];
    lista.push(agendamento);
    this.store.set(agendamento.corretorId, lista);
  }

  findByCorretor(corretorId: string): Agendamento[] {
    return this.store.get(corretorId) ?? [];
  }

  findByCorretorEDia(corretorId: string, data: string): Agendamento[] {
    return this.findByCorretor(corretorId).filter(
      (a) => dataBrasilia(a.inicio) === data,
    );
  }
}
