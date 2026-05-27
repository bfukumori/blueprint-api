export class OllamaService {
	private readonly baseUrl: string;
	private readonly timeoutMs: number;

	constructor() {
		this.baseUrl = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
		this.timeoutMs = parseInt(process.env.OLLAMA_TIMEOUT ?? "60000", 10);
	}

	async ping(): Promise<boolean> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 2000);

		try {
			const response = await fetch(this.baseUrl, { signal: controller.signal });
			return response.ok;
		} catch {
			return false;
		} finally {
			clearTimeout(timeoutId);
		}
	}

	async getChatStream(history: { role: string; content: string }[]) {
		if (!(await this.ping())) {
			throw new Error("SERVICO_IA_INDISPONIVEL");
		}

		const payload = {
			model: "qwen2.5:7b",
			keep_alive: "1h",
			messages: [
				{
					role: "system",
					content:
						"Você é um Analista de Requisitos Sênior. Faça UMA pergunta por vez para extrair o escopo de um MVP. Quando tiver todos os dados para gerar um AGENT.md, encerre escrevendo EXATAMENTE a tag: [ENTREVISTA ENCERRADA].",
				},
				...history,
			],
			stream: true,
		};

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

		try {
			const response = await fetch(`${this.baseUrl}/api/chat`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			if (!response.body || !response.ok) {
				throw new Error(`Falha no Ollama. Status: ${response.status}`);
			}

			return response.body.getReader();
		} catch (error) {
			clearTimeout(timeoutId);

			if (error instanceof Error && error.name === "AbortError") {
				console.error(
					`[OllamaService] Timeout de ${this.timeoutMs}ms excedido.`,
				);
				throw new Error("TIMEOUT_IA");
			}

			console.error("[OllamaService] Falha de comunicação de rede:", error);
			throw new Error("FALHA_CONEXAO_IA");
		}
	}
}
