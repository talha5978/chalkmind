import type { Route } from "./+types/api.status";
import { LessonsService } from "~/services/lessons.service.server";

export async function loader({ request, params }: Route.LoaderArgs) {
	const { id } = params;

	if (!id) {
		return Response.json({ status: "failed", error: "Missing lesson ID" }, { status: 400 });
	}

	const lessonsService = new LessonsService(request);
	const { data, error } = await lessonsService.getLessonWithScenes(id);

	if (error || !data || !data.lesson) {
		return Response.json({ status: "generating", message: "Initializing pipeline..." });
	}

	const { lesson } = data;

	return Response.json({
		status: lesson.status, // "generating", "completed", or "failed"
		progress: lesson.progress || 50,
		message: lesson.message || "Processing...",
		error: lesson.status === "failed" ? lesson.message : null,
	});
}
