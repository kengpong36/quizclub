"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
  }

  return (
    <div className="frame">
      <h2 className="section-title">เข้าสู่ระบบ</h2>
      <div className="section-sub">ล็อกอินเพื่อบันทึกคะแนนลงอันดับ และเข้าถึงสิทธิ์ของคุณ</div>
      <form onSubmit={handleSubmit}>
        <label className="field-label">อีเมล</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
