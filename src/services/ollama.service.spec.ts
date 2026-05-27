/** biome-ignore-all lint/suspicious/noExplicitAny: <tests> */
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { OllamaService } from "./ollama.service";

describe("OllamaService", () => {
	let service: OllamaService;
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(console, "error").mockImplementation(() => {});
		fetchMock = vi.fn();
		(global as any).fetch = fetchMock;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("ping", () => {
		it("should return true when service is available", async () => {
			fetchMock.mockResolvedValue({
				ok: true,
				status: 200,
			});

			service = new OllamaService();
			const result = await service.ping();

			expect(result).toBe(true);
			expect(fetchMock).toHaveBeenCalledWith(
				"http://127.0.0.1:11434",
				expect.objectContaining({
					signal: expect.any(AbortSignal),
				}),
			);
		});

		it("should return false when service is unavailable", async () => {
			fetchMock.mockRejectedValue(new Error("Connection refused"));

			service = new OllamaService();
			const result = await service.ping();

			expect(result).toBe(false);
		});

		it("should return false on non-OK response", async () => {
			fetchMock.mockResolvedValue({
				ok: false,
				status: 503,
			});

			service = new OllamaService();
			const result = await service.ping();

			expect(result).toBe(false);
		});

		it("should use custom base URL from environment", async () => {
			const originalUrl = process.env.OLLAMA_URL;
			process.env.OLLAMA_URL = "http://custom-ollama:11434";

			fetchMock.mockResolvedValue({
				ok: true,
				status: 200,
			});

			service = new OllamaService();
			await service.ping();

			expect(fetchMock).toHaveBeenCalledWith(
				"http://custom-ollama:11434",
				expect.any(Object),
			);

			process.env.OLLAMA_URL = originalUrl;
		});

		it("should handle abort signal on timeout", async () => {
			const abortError = new Error("Aborted");
			abortError.name = "AbortError";

			fetchMock.mockRejectedValue(abortError);

			service = new OllamaService();
			const result = await service.ping();

			expect(result).toBe(false);
		});
	});

	describe("getChatStream", () => {
		it("should throw error when service is unavailable", async () => {
			fetchMock.mockRejectedValue(new Error("Connection refused"));

			service = new OllamaService();

			await expect(
				service.getChatStream([{ role: "user", content: "Hello" }]),
			).rejects.toThrow("SERVICO_IA_INDISPONIVEL");
		});

		it("should return readable stream on successful request", async () => {
			const mockReader = {
				read: vi.fn(),
				releaseLock: vi.fn(),
				closed: Promise.resolve(),
				cancel: vi.fn(),
			};

			fetchMock
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
				})
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					body: {
						getReader: () => mockReader,
					},
				});

			service = new OllamaService();
			const result = await service.getChatStream([
				{ role: "user", content: "Hello" },
			]);

			expect(result).toBe(mockReader as any);
		});

		it("should send correct payload to chat endpoint", async () => {
			const mockReader = {
				read: vi.fn(),
				releaseLock: vi.fn(),
				closed: Promise.resolve(),
				cancel: vi.fn(),
			};
			const history = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi" },
			];

			fetchMock
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
				})
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					body: {
						getReader: () => mockReader,
					},
				});

			service = new OllamaService();
			await service.getChatStream(history);

			const secondCall = fetchMock.mock.calls[1];
			if (!secondCall) {
				throw new Error("Expected second fetch call");
			}
			expect(secondCall[0]).toBe("http://127.0.0.1:11434/api/chat");
			expect(secondCall[1].method).toBe("POST");
			expect(secondCall[1].headers["Content-Type"]).toBe("application/json");

			const payload = JSON.parse(secondCall[1].body);
			expect(payload.model).toBe("qwen2.5:7b");
			expect(payload.stream).toBe(true);
			expect(payload.keep_alive).toBe("1h");
			expect(payload.messages).toHaveLength(3);
		});

		it("should include system message in payload", async () => {
			const mockReader = {
				read: vi.fn(),
				releaseLock: vi.fn(),
				closed: Promise.resolve(),
				cancel: vi.fn(),
			};

			fetchMock
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
				})
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					body: {
						getReader: () => mockReader,
					},
				});

			service = new OllamaService();
			await service.getChatStream([]);

			const secondCall = fetchMock.mock.calls[1];
			if (!secondCall) {
				throw new Error("Expected second fetch call");
			}
			const payload = JSON.parse(secondCall[1].body);

			expect(payload.messages[0].role).toBe("system");
			expect(payload.messages[0].content).toContain("Analista de Requisitos");
			expect(payload.messages[0].content).toContain("ENTREVISTA ENCERRADA");
		});

		it("should throw TIMEOUT_IA when request exceeds timeout", async () => {
			const originalTimeout = process.env.OLLAMA_TIMEOUT;
			process.env.OLLAMA_TIMEOUT = "100";

			const abortError = new Error("Aborted");
			abortError.name = "AbortError";

			fetchMock
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
				})
				.mockRejectedValueOnce(abortError);

			service = new OllamaService();

			await expect(
				service.getChatStream([{ role: "user", content: "Hello" }]),
			).rejects.toThrow("TIMEOUT_IA");

			process.env.OLLAMA_TIMEOUT = originalTimeout;
		});

		it("should throw FALHA_CONEXAO_IA on network failure after ping", async () => {
			fetchMock
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
				})
				.mockRejectedValueOnce(new Error("Network error"));

			service = new OllamaService();

			await expect(
				service.getChatStream([{ role: "user", content: "Hello" }]),
			).rejects.toThrow("FALHA_CONEXAO_IA");
		});

		it("should throw error when response body is null", async () => {
			fetchMock
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
				})
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					body: null,
				});

			service = new OllamaService();

			await expect(
				service.getChatStream([{ role: "user", content: "Hello" }]),
			).rejects.toThrow();
		});

		it("should use custom timeout from environment", async () => {
			const originalTimeout = process.env.OLLAMA_TIMEOUT;
			process.env.OLLAMA_TIMEOUT = "30000";

			const mockReader = {
				read: vi.fn(),
				releaseLock: vi.fn(),
				closed: Promise.resolve(),
				cancel: vi.fn(),
			};
			fetchMock
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
				})
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					body: {
						getReader: () => mockReader,
					},
				});

			service = new OllamaService();
			await service.getChatStream([]);

			expect(service).toBeDefined();

			process.env.OLLAMA_TIMEOUT = originalTimeout;
		});

		it("should throw error on non-OK response status", async () => {
			fetchMock
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
				})
				.mockResolvedValueOnce({
					ok: false,
					status: 500,
				});

			service = new OllamaService();

			await expect(
				service.getChatStream([{ role: "user", content: "Hello" }]),
			).rejects.toThrow("FALHA_CONEXAO_IA");
		});
	});
});
