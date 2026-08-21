"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { supabase } from "@/lib/supabaseClient";

export default function NavBar() {
  const { session, profile } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  const linkClass = (href: string) => "nav-link" + (pathname === href ? " active" : "");

  return (
    <header className="top">
      <Link href="/" className="brand">
        ควิซ<span>คลับ</span>
      </Link>
      <nav className="tabs">
        <Link href="/" className={linkClass("/")}>หน้าแรก</Link>
        <Link href="/leaderboard" className={linkClass("/leaderboard")}>อันดับ</Link>
        {profile?.role === "admin" && (
          <Link href="/admin" className={linkClass("/admin")}>จัดการคำถาม</Link>
        )}
        {session ? (
          <button className="nav-link" onClick={handleLogout}>
            ออกจากระบบ ({profile?.username || "…"})
          </button>
        ) : (
          <Link href="/login" className={linkClass("/login")}>เข้าสู่ระบบ</Link>
        )}
      </nav>
    </header>
  );
}
