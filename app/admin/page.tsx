import { isAdmin } from "@/lib/auth";
import { AdminStudio } from "../components/AdminStudio";
import { LoginForm } from "../components/LoginForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authenticated = await isAdmin();
  if (authenticated) return <main className="admin-page admin-studio-page"><AdminStudio /></main>;
  return (
    <main className="admin-page">
      <div className="admin-top">
        <div className="site-shell site-header"><Link className="wordmark" href="/">The Archive</Link><Link className="button secondary" href="/">View public site</Link></div>
      </div>
      <LoginForm />
    </main>
  );
}
