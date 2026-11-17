export function authRedirect(pathname: string, signedIn: boolean): string | null {
  const inDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  if (!signedIn && inDashboard) return "/login";
  if (signedIn && pathname === "/login") return "/dashboard";
  return null;
}
