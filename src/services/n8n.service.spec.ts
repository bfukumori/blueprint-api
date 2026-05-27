/** biome-ignore-all lint/suspicious/noExplicitAny: <tests> */
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import type { ChatRepository } from "../repositories/chat.repository";
import { N8nService } from "./n8n.service";

describe("N8nService", () => {
	let service: N8nService;
	let mockChatRepo: Record<string, any>;
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();

		mockChatRepo = {
			getSessionHistory: vi.fn(),
		};

		service = new N8nService(mockChatRepo as ChatRepository);

		fetchMock = vi.fn();
		(global as any).fetch = fetchMock;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should generate artifacts with valid session and history", async () => {
		const sessionId = "test-session-123";
		const mockHistory = [
			{ role: "user", content: "Hello", id: 1, createdAt: new Date() },
			{
				role: "assistant",
				content: "Hi there",
				id: 2,
				createdAt: new Date(),
			},
		];

		mockChatRepo.getSessionHistory.mockResolvedValue(mockHistory);
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
		});

		service.generateArtifacts(sessionId);

		await new Promise((resolve) => setTimeout(resolve, 100));

		expect(mockChatRepo.getSessionHistory).toHaveBeenCalledWith(sessionId);
		expect(fetchMock).toHaveBeenCalled();

		const callArgs = fetchMock.mock.calls[0];
		if (!callArgs) {
			throw new Error("Expected fetch to be called");
		}
		const payload = JSON.parse(callArgs[1].body);

		expect(payload.sessionId).toBe(sessionId);
		expect(payload.history).toHaveLength(2);
		expect(payload.history[0]).toEqual({
			role: "user",
			content: "Hello",
		});
		expect(payload.timestamp).toBeDefined();
	});

	it("should include correct headers in webhook request", async () => {
		const sessionId = "test-session";
		mockChatRepo.getSessionHistory.mockResolvedValue([]);
		fetchMock.mockResolvedValue({ ok: true });

		service.generateArtifacts(sessionId);

		await new Promise((resolve) => setTimeout(resolve, 100));

		if (fetchMock.mock.calls.length > 0) {
			const callArgs = fetchMock.mock.calls[0];

			if (!callArgs?.[1]) {
				throw new Error("Expected fetch options to be defined");
			}

			const headers = callArgs[1].headers;

			expect(headers["Content-Type"]).toBe("application/json");
			expect(headers.Authorization).toBeDefined();
			expect(headers.Authorization).toMatch(/^Bearer /);
		}
	});

	it("should handle empty session history gracefully", async () => {
		const sessionId = "empty-session";
		mockChatRepo.getSessionHistory.mockResolvedValue([]);
		fetchMock.mockResolvedValue({ ok: true });

		service.generateArtifacts(sessionId);

		await new Promise((resolve) => setTimeout(resolve, 100));

		expect(mockChatRepo.getSessionHistory).toHaveBeenCalledWith(sessionId);
		expect(fetchMock).toHaveBeenCalled();

		if (fetchMock.mock.calls.length > 0) {
			const body = fetchMock.mock.calls[0]?.[1]?.body;

			expect(body).toBeDefined();

			const payload = JSON.parse(body as string);

			expect(payload.history).toEqual([]);
		}
	});

	it("should handle fetch errors gracefully", async () => {
		const sessionId = "error-session";

		mockChatRepo.getSessionHistory.mockResolvedValue([]);

		fetchMock.mockRejectedValue(new Error("Network error"));

		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});

		service.generateArtifacts(sessionId);

		await new Promise((resolve) => setTimeout(resolve, 100));

		expect(consoleErrorSpy).toHaveBeenCalled();
	});

	it("should use environment variables for webhook URL and token", async () => {
		const originalUrl = process.env.N8N_GENERATE_URL;
		const originalToken = process.env.N8N_WEBHOOK_TOKEN;

		process.env.N8N_GENERATE_URL = "http://custom-url:5678/webhook";
		process.env.N8N_WEBHOOK_TOKEN = "custom-token";

		mockChatRepo.getSessionHistory.mockResolvedValue([]);
		fetchMock.mockResolvedValue({ ok: true });

		const customService = new N8nService(mockChatRepo as ChatRepository);
		customService.generateArtifacts("test");

		await new Promise((resolve) => setTimeout(resolve, 100));

		const callArgs = fetchMock.mock.calls[0];
		if (!callArgs) {
			throw new Error("Expected fetch to be called");
		}
		expect(callArgs[0]).toBe("http://custom-url:5678/webhook");

		process.env.N8N_GENERATE_URL = originalUrl;
		process.env.N8N_WEBHOOK_TOKEN = originalToken;
	});
});
