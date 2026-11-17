export function authRedirect(pathname: string, signedIn: boolean): string | null {
  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  if (!signedIn && isDashboard) return "/login";
  if (signedIn && pathname === "/login") return "/dashboard";
  return null;
}
