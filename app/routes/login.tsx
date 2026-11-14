import { Link, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { useActionData, useFetcher, useNavigation } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { toast } from "sonner";

import { AuthService } from "~/services/auth.service.server";
import { Field, FieldLabel, FieldError, FieldGroup } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";

const loginSchema = z.object({
	email: z.string().email("Please enter a valid email").min(1, "Email is required"),
	password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export async function loader({ request }: LoaderFunctionArgs) {
	const auth = new AuthService(request);
	const { data: user } = await auth.getUser();

	if (user) {
		return redirect("/");
	}

	return null;
}

export const meta = () => {
	return [{ title: "Sign In | ChalkMind" }];
};

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData();
	const auth = new AuthService(request);

	const email = String(formData.get("email") || "")
		.toLowerCase()
		.trim();
	const password = String(formData.get("password") || "").trim();

	const parsed = loginSchema.safeParse({ email, password });
	if (!parsed.success) {
		return {
			ok: false,
			message: "Validation failed",
			errors: parsed.error.flatten().fieldErrors,
		};
	}

	const { error } = await auth.signInWithPassword({
		email: parsed.data.email,
		password: parsed.data.password,
	});

	if (error) {
		return {
			ok: false,
			message: error.message || "Invalid email or password",
		};
	}

	return redirect("/", { headers: auth.headers });
}

export default function LoginPage() {
	const actionData = useActionData<typeof action>();
	const fetcher = useFetcher<typeof action>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state !== "idle" || fetcher.state !== "idle";

	const form = useForm<LoginFormValues>({
		resolver: zodResolver(loginSchema),
		defaultValues: { email: "", password: "" },
	});

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = form;

	const fetcherErrors =
		fetcher.data && !fetcher.data.ok && "errors" in fetcher.data ? fetcher.data.errors : undefined;

	useEffect(() => {
		if (actionData && !actionData.ok) {
			toast.error(actionData.message || "Something went wrong");
		}
	}, [actionData]);

	useEffect(() => {
		if (fetcher.data && !fetcher.data.ok && !("errors" in fetcher.data)) {
			toast.error(fetcher.data.message || "Something went wrong");
		}
	}, [fetcher.data]);

	const onSubmit = handleSubmit((values) => {
		fetcher.submit(values, { method: "post" });
	});

	return (
		<div className="min-h-screen flex">
			{/* Left branding */}
			<div className="hidden lg:flex lg:w-1/2 bg-muted items-center justify-center p-12">
				<div className="max-w-md space-y-4">
					<h1 className="text-3xl font-bold tracking-tight">ChalkMind</h1>
					<p className="text-muted-foreground text-lg">
						Transform prompts into animated blackboard lessons instantly with AI and vector math.
					</p>
				</div>
			</div>

			{/* Right form */}
			<div className="flex-1 flex items-center justify-center p-6 sm:p-12">
				<Card className="w-full max-w-md border-0 shadow-none sm:border sm:shadow-sm">
					<CardHeader className="space-y-1">
						<CardTitle className="text-2xl">Welcome back</CardTitle>
						<CardDescription>Enter your email to sign in to your account</CardDescription>
					</CardHeader>

					<CardContent className="space-y-6">
						{/* Email/Password Form */}
						<fetcher.Form method="post" noValidate className="space-y-4" onSubmit={onSubmit}>
							<FieldGroup>
								<Field data-invalid={!!errors.email || !!fetcherErrors?.email?.[0]}>
									<FieldLabel htmlFor="email">Email</FieldLabel>
									<Input
										id="email"
										type="email"
										placeholder="you@example.com"
										autoComplete="email"
										disabled={isSubmitting}
										{...register("email")}
									/>
									{(errors.email?.message || fetcherErrors?.email?.[0]) && (
										<FieldError>
											{errors.email?.message || fetcherErrors?.email?.[0]}
										</FieldError>
									)}
								</Field>

								<Field data-invalid={!!errors.password || !!fetcherErrors?.password?.[0]}>
									<FieldLabel htmlFor="password">Password</FieldLabel>
									<Input
										id="password"
										type="password"
										placeholder="••••••••"
										autoComplete="current-password"
										disabled={isSubmitting}
										{...register("password")}
									/>
									{(errors.password?.message || fetcherErrors?.password?.[0]) && (
										<FieldError>
											{errors.password?.message || fetcherErrors?.password?.[0]}
										</FieldError>
									)}
								</Field>
							</FieldGroup>

							<Button type="submit" className="w-full" disabled={isSubmitting}>
								{isSubmitting ? "Signing in…" : "Sign In"}
							</Button>
						</fetcher.Form>
					</CardContent>

					<CardFooter>
						<div className="flex justify-between items-center w-full text-sm">
							<span>Don't have an account?</span>
							<Link
								to="/signup"
								prefetch="intent"
								className="text-primary hover:underline font-medium"
							>
								Sign up
							</Link>
						</div>
					</CardFooter>
				</Card>
			</div>
		</div>
	);
}
