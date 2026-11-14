import { redirect, Outlet, type LoaderFunctionArgs, useLoaderData } from "react-router";
import { Header } from "~/components/Header";
import { AuthService } from "~/services/auth.service.server";

export async function loader({ request }: LoaderFunctionArgs) {
	const auth = new AuthService(request);

	try {
		const { data } = await auth.getCurrentProfile();

		if (!data?.user) {
			throw redirect("/login");
		}

		return {
			user: data.user,
			profile: data.profile,
		};
	} catch (error) {
		if (error instanceof Response) throw error;
		throw redirect("/login");
	}
}

export default function ProtectedLayout() {
	const L = useLoaderData<typeof loader>();
	return (
		<div className="min-h-screen flex flex-col bg-background text-foreground">
			<main className="flex-1 max-w-5xl  mx-auto w-full px-4 sm:px-6">
				<Header />
				<Outlet context={L} />
			</main>
		</div>
	);
}
