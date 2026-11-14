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
							text: `You are an expert educational scriptwriter and Manim (Python Community Edition) developer.
Create between 5 and 8 detailed, sequential scenes for a blackboard explanation of the following topic: "${prompt}".
Rules for manim_code:
- Write ONLY statements that go inside \`def construct(self):\`.
- Indent every line with 8 spaces.
- Use chalk-style colors on a dark background (WHITE, YELLOW, BLUE_B, GREEN_B, RED_B).
- NEVER use Tex or MathTex. Use only standard Text("...").
- NEVER use self.mobjects indexing (such as self.mobjects[0] or self.mobjects[1:]). Always assign created Text, Shapes, and Groups to named variables (e.g., 'my_box = Square()') and reference those variables directly.
- Ensure each scene has meaningful visual animations (e.g., creating shapes, writing text, transforming objects, shifting layouts) so there is continuous visual engagement matching the narration.
- Use clean symmetric grid positioning and coordinate offsets (e.g., ORIGIN, UP * 2, LEFT * 3 + DOWN * 1) so shapes never overlap or clip off-screen.
- Whenever combining shapes with text labels, ALWAYS group them into a VGroup (e.g., box_node = VGroup(Rectangle(width=2, height=1), Text("Step 1", font_size=20))) so they move, scale, and transform together cleanly.
- When connecting shapes or nodes with lines, anchor them precisely using center points (e.g., Line(shape_a.get_center(), shape_b.get_center(), color=WHITE)).
- For the current concept being explained the heading or the relevant text should not overlap other objects on the screen. 
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
							maxItems: 8, // <--- Increased from 3 to 8 scenes for smooth, continuous coverage
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
