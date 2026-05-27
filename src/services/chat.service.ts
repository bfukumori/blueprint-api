import { ChatRepository } from "../repositories/chat.repository";
import { N8nService } from "./n8n.service";
import { OllamaService } from "./ollama.service";

export class ChatService {
	constructor(
		private readonly chatRepo = new ChatRepository(),
		private readonly ollamaService = new OllamaService(),
		private readonly n8nService = new N8nService(),
	) {}

	async *processStreamMessage(
		sessionId: string,
		userText: string,
	): AsyncGenerator<string> {
		await this.chatRepo.saveMessage(sessionId, "user", userText);

		const rawHistory = await this.chatRepo.getSessionHistory(sessionId);
		const recentHistory = rawHistory
			.slice(-6)
			.map((m) => ({ role: m.role, content: m.content }));

		const reader = await this.ollamaService.getChatStream(recentHistory);
		const decoder = new TextDecoder("utf-8");
		let fullResponse = "";

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value, { stream: true });
				const lines = chunk.split("\n").filter((line) => line.trim() !== "");

				for (const line of lines) {
					const parsed = JSON.parse(line);
					if (parsed.message?.content) {
						const textChunk = parsed.message.content;
						fullResponse += textChunk;
						yield JSON.stringify({ text: textChunk });
					}
				}
			}
		} finally {
			await this.chatRepo.saveMessage(sessionId, "assistant", fullResponse);

			const isComplete = /\[\s*ENTREVISTA\s+ENCERRADA\s*\]/i.test(fullResponse);

			if (isComplete) {
				console.log(`[ChatService] Acionando n8n para a sessão: ${sessionId}`);
				this.n8nService.generateArtifacts(sessionId);

				yield JSON.stringify({ action: "GENERATING_ARTIFACT" });

				let attempts = 0;
				const maxAttempts = 30;

				while (attempts < maxAttempts) {
					await new Promise((resolve) => setTimeout(resolve, 2000));

					const session = await this.chatRepo.getSessionById(sessionId);

					yield JSON.stringify({
						action: "PING",
						message: `Aguardando artefato... (${attempts + 1}/${maxAttempts})`,
					});

					if (session?.status === "COMPLETED" && session?.generatedConfig) {
						yield JSON.stringify({
							action: "ARTIFACT_READY",
							downloadUrl: `/api/v1/chat/session/${sessionId}/download`,
						});
						break;
					}
					attempts++;
				}

				if (attempts >= maxAttempts) {
					yield JSON.stringify({
						error: "A geração do artefato demorou muito. Verifique mais tarde.",
					});
				}
			}
		}
	}
}
