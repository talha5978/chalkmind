import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/watch";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import fs from "node:fs";
import path from "node:path";
import { VideoPlayer } from "~/components/VideoPlayer";

export function meta({ loaderData }: Route.MetaArgs) {
	return [
		{ title: `${loaderData?.title ?? "Watch Lesson"} — ChalkMind` },
		{
			name: "description",
			content: "Watch a step-by-step blackboard lesson with synchronized narration and transcript.",
		},
	];
}

export async function loader({ params }: Route.LoaderArgs) {
	if (!params.id) {
		throw new Response("Missing id. Please try again", { status: 400 });
	}

	const outputDir = path.join(process.cwd(), "public", "outputs", params.id);
	const lessonJsonPath = path.join(outputDir, "lesson.json");

	if (!fs.existsSync(lessonJsonPath)) {
		throw new Response("Lesson not found or still generating", { status: 404 });
	}

	const lessonData = JSON.parse(fs.readFileSync(lessonJsonPath, "utf-8"));

	// Calculate running timestamps based on audio file durations if available,
	// or estimate ~8 seconds per scene
	let accumulatedSeconds = 0;
	const scenesWithTimestamps: {
		step: number;
		timestamp: string;
		narration: string;
	}[] = lessonData.scenes.map((scene: any, index: number) => {
		const minutes = Math.floor(accumulatedSeconds / 60)
			.toString()
			.padStart(2, "0");
		const seconds = Math.floor(accumulatedSeconds % 60)
			.toString()
			.padStart(2, "0");
		const timestamp = `${minutes}:${seconds}`;

		// Try reading actual audio duration if generated
		let sceneDuration = 8; // default fallback
		try {
			const audioPath = path.join(outputDir, `scene_${index}.mp3`);
			sceneDuration = Math.ceil(fs.statSync(audioPath).size / 1024 / 1024);
		} catch (e) {
			// fallback
		}
		accumulatedSeconds += sceneDuration;

		return {
			step: scene.step || index + 1,
			timestamp,
			narration: scene.narration,
		};
	});

	return {
		id: params.id,
		title: lessonData.title || "Generated Blackboard Lesson",
		videoUrl: `/outputs/${params.id}/final.mp4`,
		scenes: scenesWithTimestamps,
	};
}

export default function WatchLesson() {
	const { id, title, videoUrl, scenes } = useLoaderData<typeof loader>();

	return (
		<main className="min-h-screen bg-background text-foreground p-6">
			<div className="mx-auto max-w-5xl space-y-6">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div className="space-y-1">
						<div className="flex items-center gap-2">
							<Badge variant="secondary">Lesson #{id}</Badge>
							<Badge variant="outline">Blackboard AI</Badge>
						</div>
						<h1 className="text-2xl font-bold tracking-tight">{title}</h1>
					</div>
					<Link to="/">
						<Button variant="outline">New Problem</Button>
					</Link>
				</div>

				<Card className="overflow-hidden border-border bg-card">
					{/* <div className="aspect-video w-full bg-muted flex items-center justify-center border-b border-border">
						<video controls playsInline className="h-full w-full object-contain" src={videoUrl} />
					</div> */}

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
										This lesson was custom-generated using Gemini and Manim to provide an
										intuitive, step-by-step vector animation of your prompt.
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
