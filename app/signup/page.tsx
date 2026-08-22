"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { usernameToEmail, normalizeUsername, isValidUsername } from "@/lib/username";

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const uname = normalizeUsername(username);
    if (!isValidUsername(uname)) {
      setError("ชื่อผู้ใช้ต้องเป็นตัวอักษร/ตัวเลข/ขีดล่าง 3-20 ตัว (ไม่มีเว้นวรรค)");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: usernameToEmail(uname),
      password,
      options: { data: { username: uname } },
    });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes("already registered")) {
        setError("มีชื่อผู้ใช้นี้อยู่แล้ว ลองชื่ออื่นดูนะ");
      } else {
        setError(error.message);
      }
      return;
    }
    if (data.session) {
      router.push("/");
    } else {
      // Email confirmation is on in Supabase settings — this shouldn't
      // normally happen for username auth. Guide the person either way.
      router.push("/login");
    }
  }

  return (
    <div className="frame">
      <h2 className="section-title">สมัครสมาชิก</h2>
      <div className="section-sub">สมัครเพื่อบันทึกคะแนนและขึ้นกระดานอันดับ (ไม่ต้องใช้อีเมล)</div>
      <form onSubmit={handleSubmit}>
        <label className="field-label">ชื่อผู้ใช้ (username)</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="เช่น kengpong36"
          autoCapitalize="none"
          required
        />
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
