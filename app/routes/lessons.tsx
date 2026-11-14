import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/lessons";
import { AuthService } from "~/services/auth.service.server";
import { LessonsService } from "~/services/lessons.service.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";

export async function loader({ request }: Route.LoaderArgs) {
	const auth = new AuthService(request);
	const user = await auth.requireUser();

	const lessonsService = new LessonsService(request);
	const { data: lessons, error } = await lessonsService.getUserLessons(user.id);

	if (error) {
		throw new Response("Failed to load your lessons", { status: 500 });
	}

	return { lessons: lessons || [] };
}

export const meta = () => {
	return [{ title: "My Lessons | ChalkMind" }];
};

export default function MyLessonsPage() {
	const { lessons } = useLoaderData<typeof loader>();

	return (
		<main className="min-h-screen bg-background text-foreground p-6 sm:p-10">
			<div className="mx-auto max-w-4xl space-y-8">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="space-y-1">
						<h1 className="text-3xl font-bold tracking-tight">My Lessons</h1>
						<p className="text-muted-foreground text-sm">
							Manage and review all your AI-generated blackboard animations.
						</p>
					</div>
					<Link to="/">
						<Button>+ Create New Lesson</Button>
					</Link>
				</div>

				{/* Lessons Grid or Empty State */}
				{lessons.length === 0 ? (
					<Card className="border-dashed bg-card/50 py-12 text-center">
						<CardContent className="space-y-4">
							<p className="text-muted-foreground text-sm">
								You haven't generated any lessons yet.
							</p>
							<Link to="/">
								<Button variant="outline">Generate Your First Lesson</Button>
							</Link>
						</CardContent>
					</Card>
				) : (
					<div className="grid gap-4 sm:grid-cols-2">
						{lessons.map((lesson) => {
							const isCompleted = lesson.status === "completed";
							const isFailed = lesson.status === "failed";

							return (
								<Card
									key={lesson.id}
									className="flex flex-col justify-between border-border bg-card"
								>
									<CardHeader className="space-y-2">
										<div className="flex items-center justify-between">
											<Badge
												variant={
													isCompleted
														? "default"
														: isFailed
															? "destructive"
															: "secondary"
												}
											>
												{lesson.status.charAt(0).toUpperCase() +
													lesson.status.slice(1)}
											</Badge>
											<span className="text-xs text-muted-foreground font-mono">
												{new Date(lesson.created_at).toLocaleDateString()}
											</span>
										</div>
										<CardTitle className="text-lg leading-snug line-clamp-1">
											{lesson.title || "Untitled Lesson"}
										</CardTitle>
										<CardDescription className="line-clamp-2 text-xs">
											"{lesson.prompt}"
										</CardDescription>
									</CardHeader>

									<CardFooter className="pt-2">
										{isCompleted ? (
											<Link to={`/watch/${lesson.id}`} className="w-full">
												<Button variant="default" className="w-full" size="sm">
													Watch Lesson
												</Button>
											</Link>
										) : isFailed ? (
											<div className="w-full text-xs text-destructive text-center py-1">
												{lesson.message || "Generation failed"}
											</div>
										) : (
											<Link to={`/generate/${lesson.id}`} className="w-full">
												<Button variant="outline" className="w-full" size="sm">
													View Progress ({lesson.progress || 0}%)
												</Button>
											</Link>
										)}
									</CardFooter>
								</Card>
							);
						})}
					</div>
				)}
			</div>
		</main>
	);
}
