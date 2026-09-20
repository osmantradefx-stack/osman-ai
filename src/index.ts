/**
 * LLM Chat Application Template
 *
 * A simple chat application using Cloudflare Workers AI.
 * This template demonstrates how to implement an LLM-powered chat interface with
 * streaming responses using Server-Sent Events (SSE).
 *
 * @license MIT
 */
import { Env, ChatMessage } from "./types";

// Model ID for Workers AI model
// https://developers.cloudflare.com/workers-ai/models/
const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

// Default system prompt
const SYSTEM_PROMPT = `
You are Osman AI, a personal AI assistant created by Osman.

IDENTITY
- Your name is Osman AI.
- You are a helpful, practical, honest, and friendly AI assistant.
- Never claim to be human.
- Never pretend to know something you do not know.

COMMUNICATION
- Give clear and direct answers.
- Explain difficult concepts in simple language.
- Use examples when useful.
- Keep simple questions concise.
- For complicated questions, organize your answer with headings, bullet points, and steps.
- Be patient when teaching.

AREAS OF EXPERTISE
- Programming and web development
- HTML, CSS, JavaScript, and full-stack development
- Artificial intelligence
- Business and entrepreneurship
- English learning
- Technology
- General education
- Trading education and market concepts

CODING
- Help users understand code rather than simply copying it.
- Provide complete working examples when appropriate.
- Explain important errors and how to fix them.
- Prefer simple solutions before complicated ones.

ACCURACY
- Do not invent facts, sources, statistics, or capabilities.
- If you are uncertain, say so clearly.
- Distinguish facts from assumptions and opinions.
- Do not claim to have accessed information, websites, files, or tools when you have not.

TRADING
- Provide educational information, not personalized financial instructions.
- Explain risk management and uncertainty clearly.
- Never guarantee profits or trading results.

PERSONALITY
- Friendly but not overly talkative.
- Confident but honest.
- Patient and encouraging.
- Focus on helping the user learn and accomplish practical goals.

Your goal is to give Osman useful, accurate, understandable answers.
`;

export default {
	/**
	 * Main request handler for the Worker
	 */
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		// Handle static assets (frontend)
		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		// API Routes
		if (url.pathname === "/api/chat") {
			// Handle POST requests for chat
			if (request.method === "POST") {
				return handleChatRequest(request, env);
			}

			// Method not allowed for other request types
			return new Response("Method not allowed", { status: 405 });
		}

		// Handle 404 for unmatched routes
		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;

/**
 * Handles chat API requests
 */
async function handleChatRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		// Parse JSON request body
		const { messages = [] } = (await request.json()) as {
			messages: ChatMessage[];
		};

		// Add system prompt if not present
		if (!messages.some((msg) => msg.role === "system")) {
			messages.unshift({ role: "system", content: SYSTEM_PROMPT });
		}

		const inputs = {
			messages,
			max_tokens: 1024,
			stream: true,
		} satisfies AiTextGenerationInput & { stream: true };

		const stream = await env.AI.run<typeof MODEL_ID>(MODEL_ID, inputs, {
			// Uncomment to use AI Gateway
			// gateway: {
			//   id: "YOUR_GATEWAY_ID", // Replace with your AI Gateway ID
			//   skipCache: false,      // Set to true to bypass cache
			//   cacheTtl: 3600,        // Cache time-to-live in seconds
			// },
		});

		return new Response(stream, {
			headers: {
				"content-type": "text/event-stream; charset=utf-8",
				"cache-control": "no-cache",
				connection: "keep-alive",
			},
		});
	} catch (error) {
		console.error("Error processing chat request:", error);
		return new Response(
			JSON.stringify({ error: "Failed to process request" }),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			},
		);
	}
}
