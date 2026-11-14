import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/watch";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { VideoPlayer } from "~/components/VideoPlayer";
import { LessonsService } from "~/services/lessons.service.server";

export function meta({ loaderData }: Route.MetaArgs) {
	return [
		{ title: `${loaderData?.title ?? "Watch Lesson"} — ChalkMind` },
		{
			name: "description",
			content: "Watch a step-by-step blackboard lesson with synchronized narration and transcript.",
		},
	];
}

export async function loader({ request, params }: Route.LoaderArgs) {
	if (!params.id) {
		throw new Response("Missing id. Please try again", { status: 400 });
	}

	const lessonsService = new LessonsService(request);
	const { data, error } = await lessonsService.getLessonWithScenes(params.id);

	if (error || !data) {
		throw new Response("Lesson not found or still generating", { status: 404 });
	}

	const { lesson, scenes } = data;

	let accumulatedSeconds = 0;
	const scenesWithTimestamps: {
		step: number;
		timestamp: string;
		narration: string;
	}[] = scenes.map((scene: any, index: number) => {
		const minutes = Math.floor(accumulatedSeconds / 60)
			.toString()
			.padStart(2, "0");
		const seconds = Math.floor(accumulatedSeconds % 60)
			.toString()
			.padStart(2, "0");
		const timestamp = `${minutes}:${seconds}`;

		const sceneDuration = scene.duration || 8;
		const currentTimestamp = timestamp;
		accumulatedSeconds += sceneDuration;

		return {
			step: scene.step || index + 1,
			timestamp: currentTimestamp,
			narration: scene.narration,
		};
	});

	return {
		id: params.id,
		title: lesson.title || "Generated Blackboard Lesson",
		videoUrl: lesson.video_url,
		scenes: scenesWithTimestamps,
	};
}

export default function WatchLesson() {
	const { id, title, videoUrl, scenes } = useLoaderData<typeof loader>();

	return (
		<main className="min-h-screen bg-background text-foreground p-6">
			<div className="mx-auto max-w-4xl space-y-6">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div className="space-y-1">
						<div className="flex items-center gap-2">
							<Badge variant="secondary">Lesson #{id}</Badge>
							<Badge variant="outline">Cloud Blackboard AI</Badge>
						</div>
						<h1 className="text-2xl font-bold tracking-tight">{title}</h1>
					</div>
					<Link to="/">
						<Button variant="outline">New Problem</Button>
					</Link>
				</div>

				<Card className="overflow-hidden border-border bg-card">
					<div className="w-full bg-muted">
						<VideoPlayer src={videoUrl} title={title} />
					</div>

					<CardContent className="pt-6">
						<Tabs defaultValue="transcript" className="w-full">
							<TabsList>
								<TabsTrigger value="transcript">Step-by-Step Transcript</TabsTrigger>
								<TabsTrigger value="accessibility">Overview</TabsTrigger>
							</TabsList>

							<TabsContent value="transcript" className="mt-4 space-y-4">
								{scenes.map((scene, index) => (
									<div key={scene.step} className="space-y-2">
										<div className="flex items-center gap-2">
											<Badge variant="secondary">Step {scene.step}</Badge>
											<span className="text-xs font-mono text-muted-foreground">
												{scene.timestamp}
											</span>
										</div>
										<p className="text-sm leading-relaxed text-foreground">
											{scene.narration}
										</p>
										{index < scenes.length - 1 && <Separator className="mt-4" />}
									</div>
								))}
							</TabsContent>

							<TabsContent value="accessibility" className="mt-4">
								<Card className="bg-muted/50 border-border">
									<CardHeader>
										<CardTitle className="text-base">Core Topic</CardTitle>
										<CardDescription>
											AI-generated visual animation breakdown
										</CardDescription>
									</CardHeader>
									<CardContent className="text-sm leading-relaxed text-foreground">
										This lesson was custom-generated using Gemini and Manim, then securely
										stored and served via Supabase Storage.
									</CardContent>
								</Card>
							</TabsContent>
						</Tabs>
					</CardContent>
				</Card>
			</div>
		</main>
	);
}
