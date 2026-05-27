import { ChatRepository } from "../repositories/chat.repository";

async function seed() {
	const repo = new ChatRepository();
	const session = await repo.createSession();
	console.log("✅ Sessão criada! Use este UUID no seu cURL:");
	console.log(session.id);
	process.exit(0);
}

seed();
