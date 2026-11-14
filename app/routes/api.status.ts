import type { Route } from "./+types/api.status";
import fs from "fs/promises";
import path from "path";

export async function loader({ params }: Route.LoaderArgs) {
	const { id } = params;
	const outputDir = path.join(process.cwd(), "public", "outputs", id);

	try {
		// Check if final video exists
		const stats = await fs.stat(path.join(outputDir, "final.mp4"));
		if (stats.isFile()) {
			return Response.json({ status: "completed", progress: 100 });
		}
	} catch {
		// File not ready yet, check for worker progress or default to generating
		try {
			const statusRaw = await fs.readFile(path.join(outputDir, "status.json"), "utf-8");
			return Response.json(JSON.parse(statusRaw));
		} catch {
			return Response.json({
				status: "generating",
				progress: 50,
				message: "Compiling Manim vector animations and synthesizing audio...",
			});
		}
	}
}
