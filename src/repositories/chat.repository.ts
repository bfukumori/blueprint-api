import { asc, eq } from "drizzle-orm";
import { db } from "../db";
import { type Message, messages, type Session, sessions } from "../db/schema";

export class ChatRepository {
	async createSession(): Promise<Session> {
		const [session] = await db.insert(sessions).values({}).returning();

		if (!session) {
			throw new Error(
				"Falha ao criar a sessão: Nenhum registro retornado pelo banco.",
			);
		}
		return session;
	}

	async saveMessage(
		sessionId: string,
		role: "user" | "assistant",
		content: string,
	): Promise<Message> {
		const [message] = await db
			.insert(messages)
			.values({
				sessionId,
				role,
				content,
			})
			.returning();

		if (!message) {
			throw new Error("Falha ao persistir mensagem no banco.");
		}
		return message;
	}

	async getSessionHistory(sessionId: string): Promise<Message[]> {
		return db.query.messages.findMany({
			where: eq(messages.sessionId, sessionId),
			orderBy: [asc(messages.createdAt)],
		});
	}

	async getSessionById(sessionId: string): Promise<Session | undefined> {
		return db.query.sessions.findFirst({
			where: eq(sessions.id, sessionId),
		});
	}
}
