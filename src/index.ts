import { Env, ChatMessage } from "./types";

const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

const SYSTEM_PROMPT = `
You are Osman AI, a personal AI assistant created by Osman.

IDENTITY
- Your name is Osman AI.
- You are helpful, practical, honest, and friendly.
- Never claim to be human.
- Never pretend to know something you do not know.

COMMUNICATION
- Give clear and direct answers.
- Explain difficult concepts simply.
- Use examples when useful.
- Keep simple questions concise.
- For complicated questions, use headings, bullet points, and steps.
- Be patient when teaching.

AREAS OF EXPERTISE
- Programming and web development
- HTML, CSS, JavaScript
- Full-stack development
- Artificial intelligence
- Business and entrepreneurship
- English learning
- Technology
- General education
- Trading education

CODING
- Help users understand code.
- Provide complete working examples when appropriate.
- Explain errors and how to fix them.
- Prefer simple solutions.

ACCURACY
- Never invent facts.
- Never invent sources.
- If uncertain, say so.
- Do not claim to have accessed information you did not access.

TRADING
- Provide educational information.
- Do not guarantee profits.
- Explain risk and uncertainty.

PERSONALITY
- Friendly.
- Clear.
- Patient.
- Practical.
- Encouraging.

Your goal is to help the user learn and accomplish practical goals.
`;

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {

		const url = new URL(request.url);

		/* WEBSITE */

		if (
			url.pathname === "/" ||
			!url.pathname.startsWith("/api/")
		) {
			return env.ASSETS.fetch(request);
		}

		/* TEXT CHAT */

		if (url.pathname === "/api/chat") {

			if (request.method !== "POST") {
				return new Response("Method not allowed", {
					status: 405,
				});
			}

			return handleChatRequest(request, env);
		}

		/* IMAGE GENERATION */

		if (url.pathname === "/api/image") {

			if (request.method !== "POST") {
				return new Response("Method not allowed", {
					status: 405,
				});
			}

			return handleImageRequest(request, env);
		}

		return new Response("Not found", {
			status: 404,
		});
	},
} satisfies ExportedHandler<Env>;


/* =========================
   TEXT CHAT
========================= */

async function handleChatRequest(
	request: Request,
	env: Env,
): Promise<Response> {

	try {

		const { messages = [] } =
			(await request.json()) as {
				messages: ChatMessage[];
			};

		if (
			!messages.some(
				(msg) => msg.role === "system"
			)
		) {

			messages.unshift({
				role: "system",
				content: SYSTEM_PROMPT,
			});
		}

		const inputs = {
			messages,
			max_tokens: 1024,
			stream: true,
		} satisfies AiTextGenerationInput & {
			stream: true;
		};

		const stream =
			await env.AI.run<typeof MODEL_ID>(
				MODEL_ID,
				inputs
			);

		return new Response(stream, {

			headers: {
				"content-type":
					"text/event-stream; charset=utf-8",

				"cache-control":
					"no-cache",

				connection:
					"keep-alive",
			},

		});

	} catch (error) {

		console.error(
			"Chat error:",
			error
		);

		return new Response(

			JSON.stringify({
				error:
					"Failed to process request",
			}),

			{
				status: 500,

				headers: {
					"content-type":
						"application/json",
				},
			}
		);
	}
}


/* =========================
   IMAGE GENERATION
========================= */

async function handleImageRequest(
	request: Request,
	env: Env,
): Promise<Response> {

	try {

		const body =
			(await request.json()) as {
				prompt?: string;
			};

		const prompt =
			body.prompt?.trim();

		if (!prompt) {

			return new Response(

				JSON.stringify({
					error:
						"Please provide an image prompt.",
				}),

				{
					status: 400,

					headers: {
						"content-type":
							"application/json",
					},
				}
			);
		}

		const result =
			await env.AI.run(
				IMAGE_MODEL,
				{
					prompt,
					steps: 4,
				}
			);

		const image =
			(result as any).image;

		if (!image) {

			throw new Error(
				"Image generation failed."
			);
		}

		const dataURI =
			`data:image/jpeg;base64,${image}`;

		return Response.json({
			image: dataURI,
		});

	} catch (error) {

		console.error(
			"Image generation error:",
			error
		);

		return new Response(

			JSON.stringify({
				error:
					"Failed to generate image.",
			}),

			{
				status: 500,

				headers: {
					"content-type":
						"application/json",
				},
			}
		);
	}
}
