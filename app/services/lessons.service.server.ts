import { BaseService } from "~/services/base.server.service";
import type { ServiceResult } from "~/types/service-result";
import { ApiError } from "~/utils/errors/ApiError";

export class LessonsService extends BaseService {
	/**
	 * Create a new lesson along with its normalized scenes
	 */
	async createLesson({
		id,
		userId,
		title,
		prompt,
		scenes,
	}: {
		id: string;
		userId: string;
		title: string;
		prompt: string;
		scenes: Array<{ step: number; narration: string; manim_code: string }>;
	}): Promise<ServiceResult<{ lessonId: string }>> {
		try {
			// 1. Insert parent lesson
			const { error: lessonError } = await this.supabase.from(this.LESSONS_TABLE).insert({
				id,
				user_id: userId,
				title,
				prompt,
				status: "generating",
				progress: 25,
				message: "Script generated. Rendering Manim blackboard animation...",
			});

			if (lessonError) {
				return { data: null, error: new ApiError(lessonError.message, 400, [lessonError]) };
			}

			// 2. Insert normalized child scenes
			const scenesPayload = scenes.map((scene, index) => ({
				lesson_id: id,
				step: scene.step || index + 1,
				narration: scene.narration,
				manim_code: scene.manim_code,
				duration: 8.0, // Default fallback, updated later after audio synthesis
			}));

			const { error: scenesError } = await this.supabase.from(this.SCENES_TABLE).insert(scenesPayload);

			if (scenesError) {
				return { data: null, error: new ApiError(scenesError.message, 400, [scenesError]) };
			}

			return { data: { lessonId: id }, error: null };
		} catch (err: any) {
			return {
				data: null,
				error: new ApiError(err.message || "Failed to create lesson", 500),
			};
		}
	}

	/**
	 * Fetch a lesson and its associated normalized scenes by ID
	 */
	async getLessonWithScenes(lessonId: string): Promise<ServiceResult<{ lesson: any; scenes: any[] }>> {
		try {
			const { data: lesson, error: lessonError } = await this.supabase
				.from(this.LESSONS_TABLE)
				.select("*")
				.eq("id", lessonId)
				.single();

			if (lessonError || !lesson) {
				return {
					data: null,
					error: new ApiError("Lesson not found", 404, lessonError ? [lessonError] : []),
				};
			}

			const { data: scenes, error: scenesError } = await this.supabase
				.from(this.SCENES_TABLE)
				.select("*")
				.eq("lesson_id", lessonId)
				.order("step", { ascending: true });

			if (scenesError) {
				return { data: null, error: new ApiError(scenesError.message, 500, [scenesError]) };
			}

			return { data: { lesson, scenes: scenes || [] }, error: null };
		} catch (err: any) {
			return {
				data: null,
				error: new ApiError(err.message || "Failed to fetch lesson", 500),
			};
		}
	}

	/**
	 * Update lesson status, progress, message, or final storage URL
	 */
	async updateLessonStatus(
		lessonId: string,
		updates: {
			status?: string;
			progress?: number;
			message?: string;
			video_url?: string;
		},
	): Promise<ServiceResult<boolean>> {
		try {
			const { error } = await this.supabase.from(this.LESSONS_TABLE).update(updates).eq("id", lessonId);

			if (error) {
				return { data: null, error: new ApiError(error.message, 400, [error]) };
			}

			return { data: true, error: null };
		} catch (err: any) {
			return {
				data: null,
				error: new ApiError(err.message || "Failed to update lesson status", 500),
			};
		}
	}

	/**
	 * Update individual scene duration after precise audio measurement
	 */
	async updateSceneDuration(sceneId: string, duration: number): Promise<ServiceResult<boolean>> {
		try {
			const { error } = await this.supabase
				.from(this.SCENES_TABLE)
				.update({ duration })
				.eq("id", sceneId);

			if (error) {
				return { data: null, error: new ApiError(error.message, 400, [error]) };
			}

			return { data: true, error: null };
		} catch (err: any) {
			return {
				data: null,
				error: new ApiError(err.message || "Failed to update scene duration", 500),
			};
		}
	}

	/**
	 * Get all lessons created by a specific user (Great for a library/dashboard view)
	 */
	async getUserLessons(userId: string): Promise<ServiceResult<any[]>> {
		try {
			const { data, error } = await this.supabase
				.from(this.LESSONS_TABLE)
				.select("*")
				.eq("user_id", userId)
				.order("created_at", { ascending: false });

			if (error) {
				return { data: null, error: new ApiError(error.message, 400, [error]) };
			}

			return { data: data || [], error: null };
		} catch (err: any) {
			return {
				data: null,
				error: new ApiError(err.message || "Failed to fetch user lessons", 500),
			};
		}
	}
}
