import { redirect } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { AuthService } from "~/services/auth.service.server";

export async function action({ request }: ActionFunctionArgs) {
	const auth = new AuthService(request);
	const { error } = await auth.signOut();

	if (error) {
		throw new Response(error.message, { status: error.statusCode });
	}

	return redirect("/login", { headers: auth.headers });
}
