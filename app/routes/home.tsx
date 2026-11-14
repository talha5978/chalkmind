import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/home";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "ChalkMind — AI Blackboard Explainer" },
		{
			name: "description",
			content: "Turn any problem or concept into a narrated blackboard animation.",
		},
	];
}

const SAMPLE_PROMPTS = [
	"How do we balance AVL tree in data structures. Explain each case with good example",
	"Explain how binary search works on a sorted array",
	"Visualize derivatives as the slope of a tangent line",
];

export default function Home() {
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";

	return (
		<main className="min-h-[calc(100dvh-3.5rem)] bg-background text-foreground flex flex-col items-center justify-center p-6">
			<div className="w-full max-w-5xl space-y-6">
				<div className="flex items-center justify-between">
					<div className="space-y-1">
						<div>
							<h1 className="text-2xl font-bold tracking-tight">ChalkMind</h1>
						</div>
						<p className="text-sm text-muted-foreground">
							Visual, step-by-step blackboard explanations with synchronized audio & captions.
						</p>
					</div>
				</div>

				<Card className="border-border bg-card text-card-foreground">
					<CardHeader>
						<CardTitle>What concept do you want explained?</CardTitle>
						<CardDescription>
							Paste a math problem, algorithm, or physics question. We will break it down on a
							blackboard.
						</CardDescription>
					</CardHeader>

					<Form method="post" action="/api/generate">
						<CardContent className="space-y-4 mb-4">
							<div className="space-y-2">
								<Label htmlFor="prompt">Problem or Topic Statement</Label>
								<Textarea
									id="prompt"
									name="prompt"
									rows={5}
									required
									disabled={isSubmitting}
									placeholder="e.g., Explain why the area of a circle is πr² using concentric rings..."
									className="resize-none font-mono text-sm"
								/>
							</div>

							<div className="space-y-2">
								<div className="text-xs font-medium text-muted-foreground">
									Try an example prompt:
								</div>
								<div className="flex flex-wrap gap-2">
									{SAMPLE_PROMPTS.map((sample) => (
										<Badge
											key={sample}
											variant="outline"
											className="cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
											onClick={() => {
												const textarea = document.getElementById(
													"prompt",
												) as HTMLTextAreaElement | null;
												if (textarea) textarea.value = sample;
											}}
										>
											{sample}
										</Badge>
									))}
								</div>
							</div>
						</CardContent>

						<CardFooter className="flex justify-end border-t border-border pt-6">
							<Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
								{isSubmitting ? "Synthesizing Blackboard..." : "Generate Blackboard Lesson"}
							</Button>
						</CardFooter>
					</Form>
				</Card>
			</div>
		</main>
	);
}
