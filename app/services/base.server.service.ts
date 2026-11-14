import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "~/lib/supabase/supabase.server";
import type { Database } from "~/types/database";

export class BaseService {
	supabase: SupabaseClient<Database>;
	readonly request: Request;
	readonly headers: Headers;

	protected readonly PROFILES_TABLE = "profiles";
	protected readonly SCENES_TABLE = "scenes";
	protected readonly LESSONS_TABLE = "lessons";

	constructor(request: Request) {
		const { supabase, headers } = createServerSupabaseClient(request);
		this.supabase = supabase;
		this.request = request;
		this.headers = headers;
	}
}
