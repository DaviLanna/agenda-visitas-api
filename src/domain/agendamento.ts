export type AgendamentoStatus = "confirmado";

export interface Agendamento {
  agendamentoId: string;
  corretorId: string;
  imovelId: string;
  inicio: Date;
  fim: Date;
  status: AgendamentoStatus;
}
