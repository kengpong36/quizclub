"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // If email confirmation is off, session exists immediately.
    if (data.session) {
      router.push("/");
    } else {
      setDone(true);
    }
  }

  if (done) {
    return (
      <div className="frame">
        <h2 className="section-title">ยืนยันอีเมล</h2>
        <div className="info-text">
          สมัครสำเร็จ! เช็คอีเมลของคุณเพื่อกดยืนยันบัญชี (หากปิดการยืนยันอีเมลไว้ใน Supabase
          จะเข้าสู่ระบบได้ทันทีที่หน้าเข้าสู่ระบบ)
        </div>
        <Link href="/login" className="btn" style={{ display: "block", marginTop: 18, textAlign: "center" }}>
          ไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  return (
    <div className="frame">
      <h2 className="section-title">สมัครสมาชิก</h2>
      <div className="section-sub">สมัครเพื่อบันทึกคะแนนและขึ้นกระดานอันดับ</div>
      <form onSubmit={handleSubmit}>
        <label className="field-label">ชื่อที่แสดง (username)</label>
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <label className="field-label">อีเมล</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label className="field-label">รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        {error && <div className="error-text">{error}</div>}
        <button className="btn" style={{ marginTop: 18 }} type="submit" disabled={loading}>
          {loading ? "กำลังสมัคร..." : "สมัครสมาชิก"}
        </button>
      </form>
      <div className="info-text">
        มีบัญชีแล้ว? <Link href="/login" style={{ color: "var(--gold)" }}>เข้าสู่ระบบ</Link>
      </div>
    </div>
  );
}
