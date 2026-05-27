import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const sessions = pgTable("sessions", {
	id: uuid("id").defaultRandom().primaryKey(),
	status: varchar("status", { length: 50 }).default("IN_PROGRESS").notNull(),
	generatedConfig: text("generated_config"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
	id: uuid("id").defaultRandom().primaryKey(),
	sessionId: uuid("session_id")
		.references(() => sessions.id, { onDelete: "cascade" })
		.notNull(),
	role: varchar("role", { length: 20 }).notNull(),
	content: text("content").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;
export type Message = InferSelectModel<typeof messages>;
export type NewMessage = InferInsertModel<typeof messages>;
