import type { Message } from "../db/schema";
import { ChatRepository } from "../repositories/chat.repository";

export interface N8nGeneratePayload {
	sessionId: string;
	history: Array<{ role: string; content: string }>;
	timestamp: string;
}

export class N8nService {
	private readonly webhookUrl: string;
	private readonly webhookToken: string;

	constructor(private readonly chatRepo = new ChatRepository()) {
		this.webhookUrl =
			process.env.N8N_GENERATE_URL ??
			"http://127.0.0.1:5678/webhook/generate-artifacts";
		this.webhookToken =
			process.env.N8N_WEBHOOK_TOKEN ?? "seu-token-secreto-super-seguro";
	}

	async generateArtifacts(sessionId: string): Promise<void> {
		try {
			console.log(
				`[n8n] Iniciando geração de artefatos para sessão: ${sessionId}`,
			);

			const rawHistory = await this.chatRepo.getSessionHistory(sessionId);

			const cleanHistory = rawHistory.map((m: Message) => ({
				role: m.role,
				content: m.content,
			}));

			const payload: N8nGeneratePayload = {
				sessionId,
				history: cleanHistory,
				timestamp: new Date().toISOString(),
			};

			fetch(this.webhookUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.webhookToken}`,
				},
				body: JSON.stringify(payload),
			}).catch((err) => {
				console.error(
					`[n8n] Erro de rede ao contatar webhook para sessão ${sessionId}:`,
					err,
				);
			});
		} catch (error) {
			console.error(
				`[N8nService] Erro interno ao recuperar histórico da sessão ${sessionId}:`,
				error,
			);
		}
	}
}
