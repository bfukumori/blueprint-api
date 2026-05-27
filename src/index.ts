import { cors } from "@elysiajs/cors";
import { Elysia, t } from "elysia";
import { ChatRepository } from "./repositories/chat.repository";
import { ChatService } from "./services/chat.service";

const chatService = new ChatService();
const chatRepo = new ChatRepository();

const app = new Elysia()
	.use(cors())
	.group("/api/v1", (api) =>
		api
			.get(
				"/chat/session/:id/download",
				async ({ params, set }) => {
					try {
						const session = await chatRepo.getSessionById(params.id);

						if (!session) {
							set.status = 404;
							return { error: "Sessão não encontrada." };
						}

						if (session.status !== "COMPLETED" || !session.generatedConfig) {
							set.status = 422;
							return {
								error:
									"O artefato ainda não foi gerado. Tente novamente em instantes.",
							};
						}

						set.headers["Content-Type"] = "text/markdown; charset=utf-8";
						set.headers["Content-Disposition"] =
							`attachment; filename="AGENT_${session.id.substring(0, 8)}.md"`;

						return session.generatedConfig;
					} catch (error) {
						set.status = 500;
						console.error(
							"[Elysia] Erro ao processar o download do artefato:",
							error,
						);
						return { error: "Falha ao processar o download do artefato." };
					}
				},
				{
					params: t.Object({
						id: t.String({ format: "uuid" }),
					}),
				},
			)
			.post("/chat/session", async ({ set }) => {
				try {
					const session = await chatRepo.createSession();

					set.status = 201;
					return {
						success: true,
						sessionId: session.id,
						message: "Sessão criada com sucesso.",
					};
				} catch (error) {
					console.error("[Elysia] Erro ao instanciar sessão no banco:", error);
					set.status = 500;
					return {
						success: false,
						error: "Falha interna ao criar a sessão de chat.",
					};
				}
			})
			.post(
				"/chat/stream",
				async function* ({ body, set }) {
					set.headers["Content-Type"] = "text/event-stream";
					set.headers["Cache-Control"] = "no-cache";
					set.headers.Connection = "keep-alive";

					try {
						const stream = chatService.processStreamMessage(
							body.sessionId,
							body.message,
						);

						for await (const jsonString of stream) {
							yield `data: ${jsonString}\n\n`;
						}

						yield `data: [DONE]\n\n`;
					} catch (error) {
						console.error(
							`[Elysia] Erro no stream da sessão ${body.sessionId}:`,
							error,
						);
						yield `data: ${JSON.stringify({ error: "Interrupção inesperada no processamento da IA." })}\n\n`;
						yield `data: [DONE]\n\n`;
					}
				},
				{
					body: t.Object({
						sessionId: t.String({ format: "uuid" }),
						message: t.String({ minLength: 1, maxLength: 4000 }),
					}),
				},
			),
	)
	.listen(3000);

console.log(
	`🦊 Blueprint API rodando em http://${app.server?.hostname}:${app.server?.port}`,
);
