import Fastify from "fastify";
import { InMemoryAgendamentoRepository } from "../memory/inMemoryAgendamentoRepository";
import { registerRoutes } from "./routes";

export function buildApp() {
  const app = Fastify({ logger: false });
  const repo = new InMemoryAgendamentoRepository();
  registerRoutes(app, repo);
  return app;
}

if (require.main === module) {
  const app = buildApp();
  const port = Number(process.env["PORT"] ?? 3000);
  app.listen({ port, host: "0.0.0.0" }, (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Servidor rodando em ${address}`);
  });
}
