import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import type { Route } from "./+types/generate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

export function meta({}: Route.MetaArgs) {
	return [{ title: "Generating Blackboard Lesson — ChalkMind" }];
}

export default function GeneratingProgress() {
	const { id } = useParams();
	const navigate = useNavigate();
	const [message, setMessage] = useState("Initializing AI blackboard pipeline...");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const interval = setInterval(async () => {
			try {
				const res = await fetch(`/api/status/${id}`);
				const data = await res.json();

				if (data.status === "completed") {
					clearInterval(interval);
					navigate(`/watch/${id}`);
				} else if (data.status === "failed") {
					clearInterval(interval);
					setError(data.error || "Video generation failed. Please try again.");
				} else if (data.message) {
					setMessage(data.message);
				}
			} catch (err) {
				console.error("Polling network error:", err);
			}
		}, 2500);

		return () => clearInterval(interval);
	}, [id, navigate]);

	return (
		<main className="min-h-[calc(100dvh-3.5rem)] bg-background text-foreground flex items-center justify-center p-6">
			<Card className="w-full max-w-md border-border bg-card text-card-foreground shadow-lg">
				<CardHeader className="text-center space-y-2">
					<div className="flex justify-center mb-1">
						<Badge variant="secondary" className="animate-pulse">
							Live Pipeline Active
						</Badge>
					</div>
					<CardTitle className="text-xl font-bold tracking-tight">
						Synthesizing Blackboard Video
					</CardTitle>
					<CardDescription className="text-muted-foreground text-sm min-h-8">
						{error ? <span className="text-destructive font-medium">{error}</span> : message}
					</CardDescription>
				</CardHeader>

				<CardContent className="flex flex-col items-center space-y-6 pt-2 pb-6">
					{!error ? (
						<div className="flex flex-col items-center space-y-4 w-full">
							<div className="relative flex items-center justify-center py-4">
								<div className="w-12 h-12 rounded-full border-4 border-muted border-t-primary animate-spin" />
							</div>
							<p className="text-xs text-muted-foreground text-center px-4 leading-relaxed">
								Gemini is scripting scenes, Manim is drawing equations, and edge-tts is
								syncing voiceovers. This usually takes 15–30 seconds.
							</p>
						</div>
					) : (
						<Button onClick={() => navigate("/")} variant="outline" className="w-full">
							Back to Home
						</Button>
					)}
				</CardContent>
			</Card>
		</main>
	);
}
