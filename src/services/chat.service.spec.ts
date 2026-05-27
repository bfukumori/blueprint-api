/** biome-ignore-all lint/suspicious/noExplicitAny: <tests> */
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import type { ChatRepository } from "../repositories/chat.repository";
import { ChatService } from "./chat.service";
import type { N8nService } from "./n8n.service";
import type { OllamaService } from "./ollama.service";

describe("ChatService", () => {
	let service: ChatService;
	let mockChatRepo: Record<string, any>;
	let mockOllamaService: Record<string, any>;
	let mockN8nService: Record<string, any>;

	beforeEach(() => {
		vi.clearAllMocks();

		mockChatRepo = {
			saveMessage: vi.fn(),
			getSessionHistory: vi.fn(),
			getSessionById: vi.fn(),
		};

		mockOllamaService = {
			getChatStream: vi.fn(),
		};

		mockN8nService = {
			generateArtifacts: vi.fn(),
		};

		service = new ChatService(
			mockChatRepo as ChatRepository,
			mockOllamaService as OllamaService,
			mockN8nService as N8nService,
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should process a simple user message and return assistant response", async () => {
		const sessionId = "test-session";
		const userText = "Hello, how are you?";

		mockChatRepo.saveMessage.mockResolvedValue(undefined);
		mockChatRepo.getSessionHistory.mockResolvedValue([]);

		const mockStream = {
			read: vi
				.fn()
				.mockResolvedValueOnce({
					done: false,
					value: new TextEncoder().encode(
						JSON.stringify({ message: { content: "Hello! " } }),
					),
				})
				.mockResolvedValueOnce({
					done: false,
					value: new TextEncoder().encode(
						JSON.stringify({ message: { content: "I'm doing well." } }),
					),
				})
				.mockResolvedValueOnce({
					done: true,
					value: undefined,
				}),
		};

		mockOllamaService.getChatStream.mockResolvedValue(mockStream);

		const messages: string[] = [];
		for await (const message of service.processStreamMessage(
			sessionId,
			userText,
		)) {
			messages.push(message);
		}

		expect(mockChatRepo.saveMessage).toHaveBeenCalledWith(
			sessionId,
			"user",
			userText,
		);
		expect(messages.length).toBeGreaterThan(0);
		expect(mockChatRepo.saveMessage).toHaveBeenCalledWith(
			sessionId,
			"assistant",
			expect.any(String),
		);
	});

	it("should retrieve and use recent chat history (last 6 messages)", async () => {
		const sessionId = "test-session";
		const userText = "Continue our conversation";

		const history = Array.from({ length: 10 }, (_, i) => ({
			id: i,
			role: i % 2 === 0 ? "user" : "assistant",
			content: `Message ${i}`,
			createdAt: new Date(),
		}));

		mockChatRepo.saveMessage.mockResolvedValue(undefined);
		mockChatRepo.getSessionHistory.mockResolvedValue(history);

		const mockStream = {
			read: vi.fn().mockResolvedValueOnce({ done: true }),
		};

		mockOllamaService.getChatStream.mockResolvedValue(mockStream);

		for await (const _ of service.processStreamMessage(sessionId, userText)) {
		}

		expect(mockOllamaService.getChatStream).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ role: "user", content: "Message 4" }),
				expect.objectContaining({
					role: "assistant",
					content: "Message 5",
				}),
			]),
		);
	});

	it("should trigger n8n when interview is complete", async () => {
		const sessionId = "test-session";
		const userText = "Finish the interview";

		mockChatRepo.saveMessage.mockResolvedValue(undefined);
		mockChatRepo.getSessionHistory.mockResolvedValue([]);
		mockChatRepo.getSessionById.mockResolvedValue({
			status: "COMPLETED",
			generatedConfig: { data: "config" },
		});

		const completeResponse = "Response [ENTREVISTA ENCERRADA]";
		const mockStream = {
			read: vi
				.fn()
				.mockResolvedValueOnce({
					done: false,
					value: new TextEncoder().encode(
						JSON.stringify({ message: { content: completeResponse } }),
					),
				})
				.mockResolvedValueOnce({
					done: true,
					value: undefined,
				}),
		};

		mockOllamaService.getChatStream.mockResolvedValue(mockStream);

		const messages: string[] = [];
		for await (const message of service.processStreamMessage(
			sessionId,
			userText,
		)) {
			messages.push(message);
		}

		expect(mockN8nService.generateArtifacts).toHaveBeenCalledWith(sessionId);

		const actionMessages = messages.filter((m) =>
			m.includes("GENERATING_ARTIFACT"),
		);
		expect(actionMessages.length).toBeGreaterThan(0);
	});

	it("should poll for artifact completion with PING messages", async () => {
		const sessionId = "test-session";
		const userText = "Complete";

		mockChatRepo.saveMessage.mockResolvedValue(undefined);
		mockChatRepo.getSessionHistory.mockResolvedValue([]);
		mockChatRepo.getSessionById.mockResolvedValueOnce({ status: "PENDING" });
		mockChatRepo.getSessionById.mockResolvedValueOnce({
			status: "COMPLETED",
			generatedConfig: { data: "config" },
		});

		const mockStream = {
			read: vi
				.fn()
				.mockResolvedValueOnce({
					done: false,
					value: new TextEncoder().encode(
						JSON.stringify({
							message: { content: "[ENTREVISTA ENCERRADA]" },
						}),
					),
				})
				.mockResolvedValueOnce({
					done: true,
					value: undefined,
				}),
		};

		mockOllamaService.getChatStream.mockResolvedValue(mockStream);

		const messages: string[] = [];
		for await (const message of service.processStreamMessage(
			sessionId,
			userText,
		)) {
			messages.push(message);
		}

		const pingMessages = messages.filter((m) => m.includes("PING"));
		expect(pingMessages.length).toBeGreaterThan(0);
	});

	it("should return artifact download URL when ready", async () => {
		const sessionId = "test-session";
		const userText = "Complete";

		mockChatRepo.saveMessage.mockResolvedValue(undefined);
		mockChatRepo.getSessionHistory.mockResolvedValue([]);
		mockChatRepo.getSessionById.mockResolvedValue({
			status: "COMPLETED",
			generatedConfig: { data: "config" },
		});

		const mockStream = {
			read: vi
				.fn()
				.mockResolvedValueOnce({
					done: false,
					value: new TextEncoder().encode(
						JSON.stringify({
							message: { content: "[ENTREVISTA ENCERRADA]" },
						}),
					),
				})
				.mockResolvedValueOnce({
					done: true,
					value: undefined,
				}),
		};

		mockOllamaService.getChatStream.mockResolvedValue(mockStream);

		const messages: string[] = [];
		for await (const message of service.processStreamMessage(
			sessionId,
			userText,
		)) {
			messages.push(message);
		}

		const artifactReady = messages.find((m) => m.includes("ARTIFACT_READY"));
		expect(artifactReady).toBeDefined();
		expect(artifactReady).toContain(
			`/api/v1/chat/session/${sessionId}/download`,
		);
	});
});
