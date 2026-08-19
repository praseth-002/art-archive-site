import { hasAdminEntrance, isAdmin } from "@/lib/auth";
import { adminEntranceRequired } from "@/lib/runtime";
import { AdminStudio } from "../components/AdminStudio";
import { LoginForm } from "../components/LoginForm";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authenticated = await isAdmin();
  if (authenticated) return <main className="admin-page admin-studio-page"><AdminStudio /></main>;
  if (adminEntranceRequired() && !(await hasAdminEntrance())) notFound();
  return (
    <main className="admin-page">
      <div className="admin-top">
        <div className="site-shell site-header"><Link className="wordmark" href="/">The Archive</Link><Link className="button secondary" href="/">View public site</Link></div>
      </div>
      <LoginForm />
    </main>
  );
}
