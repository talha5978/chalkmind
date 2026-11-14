import { BaseService } from "~/services/base.server.service";
import { ApiError } from "~/utils/errors/ApiError";
import type { User, Session } from "@supabase/supabase-js";
import { clearCachedProfile, getCachedProfile, setCachedProfile } from "~/utils/auth-cache.server";
import type { ServiceResult } from "~/types/service-result";

export class AuthService extends BaseService {
	/**
	 * Exchange OAuth code for a session
	 */
	async exchangeCodeForSession(
		code: string,
	): Promise<ServiceResult<{ user: User | null; session: Session | null }>> {
		try {
			const { data, error } = await this.supabase.auth.exchangeCodeForSession(code);
			return {
				data,
				error: error
					? new ApiError(error.message || "Failed to exchange code for session", 400, [error])
					: null,
			};
		} catch (err: any) {
			return {
				data: null,
				error: new ApiError(err.message || "Failed to exchange code for session", 500),
			};
		}
	}

	/**
	 * Sign up with email, password, and optional metadata
	 */
	async signUpWithPassword({
		email,
		password,
		options,
	}: {
		email: string;
		password: string;
		options?: {
			data?: {
				full_name?: string;
				[key: string]: any;
			};
		};
	}): Promise<ServiceResult<{ user: User | null; session: Session | null }>> {
		try {
			const { data, error } = await this.supabase.auth.signUp({
				email,
				password,
				options,
			});

			if (error) {
				return {
					data: null,
					error: new ApiError(error.message, 400, [error]),
				};
			}

			return {
				data: { user: data.user, session: data.session },
				error: null,
			};
		} catch (err: any) {
			return {
				data: null,
				error: new ApiError(err.message || "Failed to sign up", 500),
			};
		}
	}

	/**
	 * Initiate Google OAuth sign-in flow
	 */
	async signInWithGoogle(redirectToUrl: string): Promise<ServiceResult<{ url: string }>> {
		try {
			const { data, error } = await this.supabase.auth.signInWithOAuth({
				provider: "google",
				options: {
					redirectTo: redirectToUrl,
				},
			});

			if (error || !data.url) {
				return {
					data: null,
					error: new ApiError(error?.message || "Failed to start Google login", 400),
				};
			}

			return {
				data: { url: data.url },
				error: null,
			};
		} catch (err: any) {
			return {
				data: null,
				error: new ApiError(err.message || "Failed to sign in with Google", 500),
			};
		}
	}

	/**
	 * Login with email + password
	 */
	async signInWithPassword({
		email,
		password,
	}: {
		email: string;
		password: string;
	}): Promise<ServiceResult<{ user: User; session: Session }>> {
		try {
			const { data, error } = await this.supabase.auth.signInWithPassword({
				email,
				password,
			});

			if (error) {
				return {
					data: null,
					error: new ApiError(error.message, 401, [error]),
				};
			}

			if (!data.user || !data.session) {
				return {
					data: null,
					error: new ApiError("Login failed – no user or session returned", 401),
				};
			}

			return {
				data: { user: data.user, session: data.session },
				error: null,
			};
		} catch (err: any) {
			return {
				data: null,
				error: new ApiError(err.message || "Failed to sign in", 500),
			};
		}
	}

	/**
	 * Get the currently authenticated user (or null)
	 */
	async getUser(): Promise<ServiceResult<User>> {
		try {
			const {
				data: { user },
				error,
			} = await this.supabase.auth.getUser();

			if (error) {
				return {
					data: null,
					error: new ApiError(error.message, 401, [error]),
				};
			}

			return { data: user, error: null };
		} catch (err: any) {
			return {
				data: null,
				error: new ApiError(err.message || "Failed to get user", 500),
			};
		}
	}

	/**
	 * Require a user. Throws ApiError if not authenticated.
	 */
	async requireUser(): Promise<User> {
		const { data: user, error } = await this.getUser();

		if (error || !user) {
			throw new ApiError("Unauthorized", 401);
		}

		return user;
	}

	/**
	 * Sign the user out
	 */
	async signOut(): Promise<ServiceResult<boolean>> {
		try {
			const cookieHeader = this.request.headers.get("cookie");
			clearCachedProfile(cookieHeader);

			const { error } = await this.supabase.auth.signOut();

			if (error) {
				return {
					data: null,
					error: new ApiError(error.message, 400, [error]),
				};
			}

			return { data: true, error: null };
		} catch (err: any) {
			return {
				data: null,
				error: new ApiError(err.message || "Failed to sign out", 500),
			};
		}
	}

	/**
	 * Get both the user and the profile in one call with caching
	 */
	async getCurrentProfile() {
		const cookieHeader = this.request.headers.get("cookie");

		const cached = getCachedProfile(cookieHeader);
		if (cached) {
			return { data: cached, error: null };
		}

		const { data: user, error: userError } = await this.getUser();

		if (userError || !user) {
			return {
				data: null,
				error: userError || new ApiError("Unauthorized", 401),
			};
		}

		const { data: profile, error: profileError } = await this.supabase
			.from(this.PROFILES_TABLE)
			.select("*")
			.eq("id", user.id)
			.single();

		if (profileError) {
			return {
				data: null,
				error: new ApiError(profileError.message, 500, [profileError]),
			};
		}

		const resultData = { user, profile };
		setCachedProfile(cookieHeader, resultData, 45);

		return {
			data: resultData,
			error: null,
		};
	}
}
