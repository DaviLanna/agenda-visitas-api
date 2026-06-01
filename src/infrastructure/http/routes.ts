import type { FastifyInstance } from "fastify";
import { criarAgendamento } from "../../application/criarAgendamento";
import { listarAgendamentos } from "../../application/listarAgendamentos";
import type { AgendamentoRepository } from "../../domain/agendamentoRepository";
import { ValidationError } from "../../shared/errors";
import { serializeAgendamento, serializeSugestoes } from "./serializers";

export function registerRoutes(
  app: FastifyInstance,
  repo: AgendamentoRepository,
): void {
  app.post("/api/agendamentos", async (request, reply) => {
    const body = request.body as Record<string, unknown>;

    if (
      !body ||
      typeof body !== "object" ||
      typeof body["corretorId"] !== "string" ||
      typeof body["imovelId"] !== "string" ||
      typeof body["inicio"] !== "string" ||
      typeof body["duracaoMinutos"] !== "number"
    ) {
      return reply.status(400).send({
        status: "erro",
        motivo: "Payload inválido. Campos obrigatórios: corretorId (string), imovelId (string), inicio (string ISO 8601), duracaoMinutos (number).",
      });
    }

    try {
      const result = criarAgendamento(
        {
          corretorId: body["corretorId"] as string,
          imovelId: body["imovelId"] as string,
          inicio: body["inicio"] as string,
          duracaoMinutos: body["duracaoMinutos"] as number,
        },
        repo,
      );

      if (result.tipo === "conflito") {
        return reply.status(409).send({
          status: "conflito",
          motivo: "Corretor indisponível no horário solicitado",
          sugestoes: serializeSugestoes(result.sugestoes),
        });
      }

      return reply.status(201).send(serializeAgendamento(result.agendamento));
    } catch (err) {
      if (err instanceof ValidationError) {
        return reply.status(400).send({ status: "erro", motivo: err.message });
      }
      throw err;
    }
  });

  app.get("/api/agendamentos", async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const corretorId = query["corretorId"];
    const data = query["data"];

    if (typeof corretorId !== "string" || typeof data !== "string") {
      return reply.status(400).send({
        status: "erro",
        motivo: "Query params obrigatórios: corretorId (string), data (YYYY-MM-DD).",
      });
    }

    try {
      const agendamentos = listarAgendamentos({ corretorId, data }, repo);
      return reply.status(200).send(agendamentos.map(serializeAgendamento));
    } catch (err) {
      if (err instanceof ValidationError) {
        return reply.status(400).send({ status: "erro", motivo: err.message });
      }
      throw err;
    }
  });
}
