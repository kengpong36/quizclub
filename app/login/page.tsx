"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { usernameToEmail, normalizeUsername } from "@/lib/username";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(normalizeUsername(username)),
      password,
    });
    setLoading(false);
    if (error) {
      setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      return;
    }
    router.push("/");
  }

  return (
    <div className="frame">
      <h2 className="section-title">เข้าสู่ระบบ</h2>
      <div className="section-sub">ล็อกอินเพื่อเล่นเกมและบันทึกคะแนนลงอันดับ</div>
      <form onSubmit={handleSubmit}>
        <label className="field-label">ชื่อผู้ใช้</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          required
        />
        <label className="field-label">รหัสผ่าน</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <div className="error-text">{error}</div>}
        <button className="btn" style={{ marginTop: 18 }} type="submit" disabled={loading}>
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </form>
      <div className="info-text">
        ยังไม่มีบัญชี? <Link href="/signup" style={{ color: "var(--gold)" }}>สมัครสมาชิก</Link>
      </div>
    </div>
  );
}
