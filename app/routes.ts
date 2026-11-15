import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
	layout("./routes/protected_layout.tsx", [
		index("routes/home.tsx"),
		route("logout", "./routes/logout.ts"),
		route("api/generate", "./routes/api.generate.ts"),
		route("watch/:id", "./routes/watch.tsx"),
		route("api/status/:id", "./routes/api.status.ts"),
		route("generate/:id", "./routes/generate.tsx"),
		route("lessons", "./routes/lessons.tsx"),
	]),
	route("login", "./routes/login.tsx"),
	route("signup", "./routes/signup.tsx"),
] satisfies RouteConfig;
