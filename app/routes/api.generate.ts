import fs from "fs";
import { redirect } from "react-router";
import type { Route } from "./+types/api.generate";
import { GoogleGenAI, Type } from "@google/genai";
import { spawn } from "child_process";
import path from "path";
import { AuthService } from "~/services/auth.service.server";
import { LessonsService } from "~/services/lessons.service.server";

const ai = new GoogleGenAI({
	apiKey: process.env.GEMINI_API_KEY,
	apiVersion: "v1beta",
});

export async function action({ request }: Route.ActionArgs) {
	const auth = new AuthService(request);
	const user = await auth.requireUser();

	const formData = await request.formData();
	const prompt = formData.get("prompt");

	if (!prompt || typeof prompt !== "string") {
		return Response.json({ error: "Prompt is required" }, { status: 400 });
	}

	const lessonId = Math.random().toString(36).substring(2, 9);
	const lessonsService = new LessonsService(request);

	try {
		const response = await ai.models.generateContent({
			model: "gemini-2.5-flash",
			contents: [
				{
					role: "user",
					parts: [
						{
							text: `You are an expert educational scriptwriter and Manim (Python Community Edition) animation developer.
Create between 5 and 8 detailed, sequential scenes for a blackboard explanation of the following topic: "${prompt}".

CRITICAL UNIVERSAL VISUAL & LAYOUT RULES:
- Use clean symmetric grid positioning and coordinate offsets (e.g., ORIGIN, UP * 2, LEFT * 3 + DOWN * 1) so shapes never overlap or clip off-screen.
- Whenever combining shapes with text labels, ALWAYS group them into a VGroup (e.g., box_node = VGroup(Rectangle(width=2, height=1), Text("Step 1", font_size=20))) so they move, scale, and transform together cleanly.
- When connecting shapes or nodes with lines, anchor them precisely using center points (e.g., Line(shape_a.get_center(), shape_b.get_center(), color=WHITE)).
- NEVER use Tex or MathTex. Use only standard Text("...").
- NEVER use self.mobjects indexing (such as self.mobjects[0]). Always assign created objects to named variables and animate those variables directly.
- Ensure each scene has meaningful visual animations (e.g., creating shapes, writing text, transforming objects, shifting layouts) so there is continuous visual engagement matching the narration.

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
							minItems: 5,
							maxItems: 8,
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

		// Create lesson and normalized scenes using LessonsService
		const { error: createError } = await lessonsService.createLesson({
			id: lessonId,
			userId: user.id,
			title: lessonData.title || "Generated Blackboard Lesson",
			prompt: prompt,
			scenes: lessonData.scenes,
		});

		if (createError) {
			throw new Error(createError.message);
		}

		const logStream = fs.openSync(path.join(process.cwd(), "worker_debug.log"), "w");

		const worker = spawn(
			"python3",
			[path.join(process.cwd(), "worker", "render_blackboard.py"), lessonId, user.id],
			{
				detached: true,
				stdio: ["ignore", logStream, logStream],
			},
		);
		worker.unref();

		return redirect(`/generate/${lessonId}`);
	} catch (error: any) {
		console.error("\x1b[31mGeneration pipeline failed:\x1b[0m", error?.message);
		return Response.json(
			{ error: error?.message?.error?.message ?? "Failed to generate blackboard video." },
			{ status: 500 },
		);
	}
}
