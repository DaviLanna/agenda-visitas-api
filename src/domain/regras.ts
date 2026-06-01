import { ValidationError } from "../shared/errors";
import type { Agendamento } from "./agendamento";

const DURACOES_VALIDAS = new Set([30, 60, 90, 120, 150, 180]);
const JANELA_INICIO_HORA = 8;   // 08:00 horário de Brasília
const JANELA_FIM_HORA = 19;     // 19:00 horário de Brasília
const BRASILIA_OFFSET_MS = -3 * 60 * 60 * 1000;

/** Converte uma data UTC para o horário local de Brasília (UTC-3). */
function toBrasilia(date: Date): { hour: number; minute: number; date: Date } {
  const local = new Date(date.getTime() + BRASILIA_OFFSET_MS);
  return {
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
    date: local,
  };
}

/** Retorna o instante UTC correspondente à meia-noite do dia calendário de Brasília. */
export function inicioDiaBrasilia(date: Date): Date {
  const local = new Date(date.getTime() + BRASILIA_OFFSET_MS);
  const meiaNoite = new Date(Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
    0, 0, 0, 0,
  ));
  return new Date(meiaNoite.getTime() - BRASILIA_OFFSET_MS);
}

/** Retorna a data calendário de Brasília no formato YYYY-MM-DD para um instante UTC. */
export function dataBrasilia(date: Date): string {
  const local = new Date(date.getTime() + BRASILIA_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function validarDuracao(duracaoMinutos: number): void {
  if (!DURACOES_VALIDAS.has(duracaoMinutos)) {
    throw new ValidationError(
      `Duração inválida: ${duracaoMinutos}min. Valores aceitos: 30, 60, 90, 120, 150, 180.`,
    );
  }
}

export function validarJanelaAtendimento(inicio: Date, fim: Date): void {
  const i = toBrasilia(inicio);
  const f = toBrasilia(fim);

  const inicioMinutos = i.hour * 60 + i.minute;
  const fimMinutos = f.hour * 60 + f.minute;

  if (inicioMinutos < JANELA_INICIO_HORA * 60) {
    throw new ValidationError(
      "O agendamento não pode começar antes das 08:00 (horário de Brasília).",
    );
  }
  if (fimMinutos > JANELA_FIM_HORA * 60) {
    throw new ValidationError(
      "O agendamento não pode terminar após as 19:00 (horário de Brasília).",
    );
  }
}

/**
 * Verifica sobreposição entre dois intervalos.
 * Intervalos adjacentes (fim de A == início de B) são permitidos.
 */
export function hasSobreposicao(a: Agendamento, b: { inicio: Date; fim: Date }): boolean {
  return a.inicio < b.fim && b.inicio < a.fim;
}

/**
 * Sugere até 3 horários de início livres no mesmo dia calendário de Brasília,
 * varrendo slots de 30 em 30 minutos a partir das 08:00.
 * Todos os candidatos respeitam a janela de atendimento e não colidem
 * com os agendamentos existentes do corretor.
 */
export function sugerirHorarios(
  existentes: Agendamento[],
  diaReferenciaUTC: Date,
  duracaoMinutos: number,
): Date[] {
  const diaInicio = inicioDiaBrasilia(diaReferenciaUTC);

  // Filtra apenas os agendamentos do mesmo dia calendário, em ordem cronológica
  const doMesmoDia = existentes
    .filter((a) => dataBrasilia(a.inicio) === dataBrasilia(diaReferenciaUTC))
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());

  const sugestoes: Date[] = [];
  const durationMs = duracaoMinutos * 60 * 1000;
  const janelaInicioUTC = new Date(diaInicio.getTime() + JANELA_INICIO_HORA * 60 * 60 * 1000);
  const janelaFimUTC = new Date(diaInicio.getTime() + JANELA_FIM_HORA * 60 * 60 * 1000);

  let cursor = janelaInicioUTC;

  while (sugestoes.length < 3 && cursor.getTime() + durationMs <= janelaFimUTC.getTime()) {
    const candidateFim = new Date(cursor.getTime() + durationMs);
    const candidato = { inicio: cursor, fim: candidateFim };

    const temConflito = doMesmoDia.some((a) => hasSobreposicao(a, candidato));
    if (!temConflito) {
      sugestoes.push(new Date(cursor));
    }

    cursor = new Date(cursor.getTime() + 30 * 60 * 1000);
  }

  return sugestoes;
}
