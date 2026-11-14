import { UserRound } from "lucide-react";
import { Form, Link } from "react-router";
import { LogoutButton } from "~/components/LogoutButton";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

export function Header() {
	return (
		<header className="w-full bg-background">
			<div className="mx-auto flex h-14 items-center justify-end px-4 sm:px-6 lg:px-8">
				<Form id="logout-form" method="post" action="/logout" className="hidden" />

				<DropdownMenu>
					<DropdownMenuTrigger>
						<Button variant="outline" size="icon-lg" aria-label="Open user menu">
							<UserRound aria-hidden="true" className="size-5" />
						</Button>
					</DropdownMenuTrigger>

					<DropdownMenuContent align="end" sideOffset={8}>
						<Link to="my-profile">
							<DropdownMenuItem>My Profile</DropdownMenuItem>
						</Link>
						<Link to="lessons">

						<DropdownMenuItem>My Lessons</DropdownMenuItem>
</Link>
						<DropdownMenuItem>
							<LogoutButton />
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</header>
	);
}
