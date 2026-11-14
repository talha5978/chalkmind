import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("api/generate", "./routes/api.generate.ts"),
	route("watch/:id", "./routes/watch.tsx"),
	route("api/status/:id", "./routes/api.status.ts"),
	route("generate/:id", "./routes/generate.tsx"),
] satisfies RouteConfig;
