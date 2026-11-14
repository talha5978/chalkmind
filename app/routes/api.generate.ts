import { redirect } from "react-router";
import type { Route } from "./+types/api.generate";
import { GoogleGenAI, Type } from "@google/genai";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";

const ai = new GoogleGenAI({
	apiKey: process.env.GEMINI_API_KEY,
	apiVersion: "v1beta",
});

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData();
	const prompt = formData.get("prompt");

	if (!prompt || typeof prompt !== "string") {
		return Response.json({ error: "Prompt is required" }, { status: 400 });
	}

	const lessonId = Math.random().toString(36).substring(2, 9);
	const outputDir = path.join(process.cwd(), "public", "outputs", lessonId);
	await fs.mkdir(outputDir, { recursive: true });

	try {
		const response = await ai.models.generateContent({
			model: "gemini-2.5-flash",
			contents: [
				{
					role: "user",
					parts: [
						{
							text: `You are an expert educational scriptwriter and Manim (Python Community Edition v0.18+) animation developer.
      Create EXACTLY 3 concise scenes for a blackboard explanation of the following topic: "${prompt}".
      Rules for manim_code:
      - Write ONLY statements that go inside \`def construct(self):\`.
      - Indent every line with 8 spaces.
      - Use chalk-style colors on a dark background (WHITE, YELLOW, BLUE_B, GREEN_B, RED_B).
      - NEVER use Tex or MathTex. Use only standard Text("...").
      - Keep animations short and simple.
      Return valid JSON matching the schema.`,
						},
					],
				},
			],
			config: {
				responseMimeType: "application/json",
				responseSchema: {
					type: Type.OBJECT,
					properties: {
						title: { type: Type.STRING },
						scenes: {
							type: Type.ARRAY,
							minItems: 1,
							maxItems: 3, // <--- Strictly limit to 3 scenes max
							items: {
								type: Type.OBJECT,
								properties: {
									step: { type: Type.INTEGER },
									narration: { type: Type.STRING },
									manim_code: { type: Type.STRING },
								},
								required: ["step", "narration", "manim_code"],
							},
						},
					},
					required: ["title", "scenes"],
				},
			},
		});

		const lessonData = JSON.parse(response.text || "{}");
		await fs.writeFile(path.join(outputDir, "lesson.json"), JSON.stringify(lessonData, null, 2));
		await fs.writeFile(
			path.join(outputDir, "status.json"),
			JSON.stringify({
				status: "generating",
				progress: 25,
				message: "Script generated. Rendering Manim blackboard animation...",
			}),
		);

		// 2. Spawn Python worker in the background
		const worker = spawn(
			"python3",
			[path.join(process.cwd(), "worker", "render_blackboard.py"), outputDir],
			{
				detached: true,
				stdio: "ignore",
			},
		);
		worker.unref();

		return redirect(`/generate/${lessonId}`);
	} catch (error) {
		console.error("\x1b[31mGeneration pipeline failed:\x1b[0m", error);
		return Response.json({ error: "Failed to generate blackboard video." }, { status: 500 });
	}
}
