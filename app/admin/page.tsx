"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import type { Category, Question } from "@/lib/types";
import { GAMES } from "@/lib/types";
import { normalizeUsername } from "@/lib/username";

const GAME_ID = "truth-or-lie"; // default game managed here; extend with a game selector if you add more

function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function AdminPage() {
  const { session, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<"questions" | "categories" | "settings">("questions");
  const [categories, setCategories] = useState<Category[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filterCat, setFilterCat] = useState("all");
  const [newCatName, setNewCatName] = useState("");
  const [toastMsg, setToastMsg] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mCat, setMCat] = useState("");
  const [mText, setMText] = useState("");
  const [mAnswer, setMAnswer] = useState<"true" | "false" | "">("");
  const [mExplain, setMExplain] = useState("");

  // Settings tab state
  const [dailyLimit, setDailyLimit] = useState<string>("3");
  const [limitSaving, setLimitSaving] = useState(false);
  const [resetUsername, setResetUsername] = useState("");
  const [resetGameId, setResetGameId] = useState(GAME_ID);
  const [resetLookup, setResetLookup] = useState<{ userId: string; count: number } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");

  useEffect(() => {
    if (!authLoading && (!session || profile?.role !== "admin")) {
      router.push("/");
    }
  }, [authLoading, session, profile, router]);

  useEffect(() => {
    if (profile?.role === "admin") {
      loadAll();
      loadSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  function flash(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 2200);
  }

  async function loadAll() {
    const { data: cats } = await supabase.from("categories").select("*").eq("game_id", GAME_ID);
    const { data: qs } = await supabase.from("questions").select("*").eq("game_id", GAME_ID);
    setCategories(cats || []);
    setQuestions(qs || []);
  }

  async function loadSettings() {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "daily_play_limit")
      .maybeSingle();
    if (!error && data) setDailyLimit(data.value);
  }

  async function saveDailyLimit() {
    const n = parseInt(dailyLimit, 10);
    if (isNaN(n) || n < 1) return flash("ใส่จำนวนที่ถูกต้อง (อย่างน้อย 1)");
    setLimitSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "daily_play_limit", value: String(n) });
    setLimitSaving(false);
    if (error) return flash(error.message);
    flash(`ตั้งโควตาเป็น ${n} ครั้ง/วันแล้ว`);
  }

  async function lookupPlays() {
    setResetError("");
    setResetLookup(null);
    const uname = normalizeUsername(resetUsername);
    if (!uname) return;
    setResetLoading(true);
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", uname)
      .maybeSingle();
    if (profErr || !prof) {
      setResetLoading(false);
      setResetError("ไม่พบผู้ใช้ชื่อนี้");
      return;
    }
    const { count } = await supabase
      .from("scores")
      .select("*", { count: "exact", head: true })
      .eq("user_id", prof.id)
      .eq("game_id", resetGameId)
      .gte("played_at", startOfTodayISO());
    setResetLoading(false);
    setResetLookup({ userId: prof.id, count: count ?? 0 });
  }

  async function resetPlays() {
    if (!resetLookup) return;
    if (
      !confirm(
        `รีเซ็ตโควตาวันนี้ของ "${resetUsername}" จะลบคะแนนที่เล่นวันนี้ทั้งหมด (${resetLookup.count} ครั้ง) ออกจากอันดับด้วย ยืนยันไหม?`
      )
    )
      return;
    setResetLoading(true);
    const { error } = await supabase
      .from("scores")
      .delete()
      .eq("user_id", resetLookup.userId)
      .eq("game_id", resetGameId)
      .gte("played_at", startOfTodayISO());
    setResetLoading(false);
    if (error) return flash(error.message);
    flash("รีเซ็ตโควตาแล้ว");
    setResetLookup({ ...resetLookup, count: 0 });
  }

  async function addCategory() {
    const name = newCatName.trim();
    if (!name) return flash("พิมพ์ชื่อหมวดก่อนนะ");
    const { error } = await supabase.from("categories").insert({ game_id: GAME_ID, name });
    if (error) return flash(error.message);
    setNewCatName("");
    loadAll();
    flash("เพิ่มหมวดแล้ว");
  }

  async function renameCategory(c: Category) {
    const name = prompt("ชื่อหมวดใหม่:", c.name);
    if (!name || !name.trim()) return;
    const { error } = await supabase.from("categories").update({ name: name.trim() }).eq("id", c.id);
    if (error) return flash(error.message);
    loadAll();
    flash("เปลี่ยนชื่อหมวดแล้ว");
  }

  async function deleteCategory(c: Category) {
    const count = questions.filter((q) => q.category_id === c.id).length;
    if (count > 0 && !confirm(`หมวดนี้มีคำถามอยู่ ${count} ข้อ ลบหมวดจะลบคำถามทั้งหมดไปด้วย ยืนยันไหม?`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) return flash(error.message);
    loadAll();
    flash("ลบหมวดแล้ว");
  }

  function openAddModal() {
    if (categories.length === 0) return flash('เพิ่มหมวดหมู่ก่อนในแท็บ "หมวดหมู่"');
    setEditingId(null);
    setMCat(categories[0].id);
    setMText("");
    setMAnswer("");
    setMExplain("");
    setModalOpen(true);
  }

  function openEditModal(q: Question) {
    setEditingId(q.id);
    setMCat(q.category_id);
    setMText(q.text);
    setMAnswer(q.answer ? "true" : "false");
    setMExplain(q.explain);
    setModalOpen(true);
  }

  async function saveQuestion() {
    if (!mText.trim() || mAnswer === "") return flash("กรอกคำถามและเลือกคำตอบให้ครบก่อนนะ");
    const payload = {
      game_id: GAME_ID,
      category_id: mCat,
      text: mText.trim(),
      answer: mAnswer === "true",
      explain: mExplain.trim(),
    };
    if (editingId) {
      const { error } = await supabase.from("questions").update(payload).eq("id", editingId);
      if (error) return flash(error.message);
      flash("บันทึกการแก้ไขแล้ว");
    } else {
      const { error } = await supabase.from("questions").insert(payload);
      if (error) return flash(error.message);
      flash("เพิ่มคำถามแล้ว");
    }
    setModalOpen(false);
    loadAll();
  }

  async function deleteQuestion(id: string) {
    if (!confirm("ลบคำถามนี้ใช่ไหม?")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) return flash(error.message);
    loadAll();
    flash("ลบคำถามแล้ว");
  }

  if (authLoading || profile?.role !== "admin") {
    return <div className="frame">กำลังตรวจสอบสิทธิ์...</div>;
  }

  const catName = (id: string) => categories.find((c) => c.id === id)?.name || "ไม่มีหมวดหมู่";
  const filteredQuestions =
    filterCat === "all" ? questions : questions.filter((q) => q.category_id === filterCat);

  return (
    <div className="frame">
      <h2 className="section-title">จัดการคำถาม</h2>
      <div className="section-sub">เปลี่ยนแปลงที่นี่จะอัปเดตให้ผู้เล่นทุกคนเห็นทันที</div>

      <div className="admin-tabs">
        <button className={tab === "questions" ? "active" : ""} onClick={() => setTab("questions")}>
          คำถาม
        </button>
        <button className={tab === "categories" ? "active" : ""} onClick={() => setTab("categories")}>
          หมวดหมู่
        </button>
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>
          ตั้งค่า
        </button>
      </div>

      {tab === "questions" && (
        <>
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} style={{ marginBottom: 14 }}>
            <option value="all">ทุกหมวดหมู่</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="btn" style={{ marginBottom: 14 }} onClick={openAddModal}>
            + เพิ่มคำถามใหม่
          </button>
          {filteredQuestions.length === 0 && <div className="empty-note">ยังไม่มีคำถามในหมวดนี้</div>}
          {filteredQuestions.map((q) => (
            <div className="qrow" key={q.id}>
              <div className="qrow-top">
                <div style={{ flex: 1 }}>
                  <div className="qmeta">
                    {catName(q.category_id)} ·{" "}
                    <span className={"badge " + (q.answer ? "ok" : "no")}>
                      {q.answer ? "จริง" : "มั่ว"}
                    </span>
                  </div>
                  <div className="qtext">{q.text}</div>
                </div>
                <div className="qrow-actions">
                  <button className="icon-btn" onClick={() => openEditModal(q)}>✏️</button>
                  <button className="icon-btn" onClick={() => deleteQuestion(q.id)}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {tab === "categories" && (
        <>
          <label className="field-label">ชื่อหมวดใหม่</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="เช่น กีฬา, ดนตรี, เทคโนโลยี"
            />
            <button className="btn small" onClick={addCategory}>
              เพิ่ม
            </button>
          </div>
          <div style={{ marginTop: 18 }}>
            {categories.length === 0 && <div className="empty-note">ยังไม่มีหมวดหมู่ เพิ่มด้านบนได้เลย</div>}
            {categories.map((c) => {
              const count = questions.filter((q) => q.category_id === c.id).length;
              return (
                <div className="cat-manage-row" key={c.id}>
                  <div className="cinfo">
                    {c.name}
                    <span className="cn">{count} ข้อ</span>
                  </div>
                  <div className="qrow-actions">
                    <button className="icon-btn" onClick={() => renameCategory(c)}>✏️</button>
                    <button className="icon-btn" onClick={() => deleteCategory(c)}>🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "settings" && (
        <>
          <h3 style={{ fontFamily: "Kanit", fontSize: 15, marginBottom: 8 }}>
            จำนวนครั้งที่เล่นได้ต่อวัน (สำหรับสมาชิกทั่วไป)
          </h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              type="text"
              inputMode="numeric"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value.replace(/[^0-9]/g, ""))}
              style={{ maxWidth: 100 }}
            />
            <button className="btn small" onClick={saveDailyLimit} disabled={limitSaving}>
              {limitSaving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
          <div className="info-text" style={{ marginBottom: 24 }}>
            ผู้ใช้ role admin ไม่ถูกจำกัดจำนวนครั้งเสมอ ไม่ว่าตั้งค่านี้เท่าไหร่
          </div>

          <hr style={{ borderColor: "var(--line)", margin: "20px 0" }} />

          <h3 style={{ fontFamily: "Kanit", fontSize: 15, marginBottom: 8 }}>
            รีเซ็ตโควตาการเล่นวันนี้ของผู้เล่น
          </h3>
          <label className="field-label">เกม</label>
          <select value={resetGameId} onChange={(e) => setResetGameId(e.target.value)}>
            {GAMES.filter((g) => g.playable).map((g) => (
              <option key={g.id} value={g.id}>
                {g.icon} {g.name}
              </option>
            ))}
          </select>
          <label className="field-label">ชื่อผู้ใช้ (username)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={resetUsername}
              onChange={(e) => setResetUsername(e.target.value)}
              placeholder="เช่น kengpong36"
              autoCapitalize="none"
            />
            <button className="btn small" onClick={lookupPlays} disabled={resetLoading || !resetUsername.trim()}>
              ค้นหา
            </button>
          </div>
          {resetError && <div className="error-text">{resetError}</div>}
          {resetLookup && (
            <div className="qrow" style={{ marginTop: 12 }}>
              <div className="qtext">
                วันนี้เล่นไปแล้ว <b>{resetLookup.count}</b> ครั้ง
              </div>
              <button
                className="btn danger small"
                style={{ marginTop: 10 }}
                onClick={resetPlays}
                disabled={resetLoading || resetLookup.count === 0}
              >
                รีเซ็ตโควตาวันนี้
              </button>
            </div>
          )}
        </>
      )}

      {modalOpen && (
        <div className="modal-back" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingId ? "แก้ไขคำถาม" : "เพิ่มคำถามใหม่"}</h3>
            <label className="field-label">หมวดหมู่</label>
            <select value={mCat} onChange={(e) => setMCat(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label className="field-label">คำถาม</label>
            <textarea value={mText} onChange={(e) => setMText(e.target.value)} />
            <label className="field-label">คำตอบที่ถูกต้อง</label>
            <div className="answer-toggle">
              <label>
                <input
                  type="radio"
                  name="m-answer"
                  checked={mAnswer === "true"}
                  onChange={() => setMAnswer("true")}
                />{" "}
                จริง
              </label>
              <label>
                <input
                  type="radio"
                  name="m-answer"
                  checked={mAnswer === "false"}
                  onChange={() => setMAnswer("false")}
                />{" "}
                มั่ว
              </label>
            </div>
            <label className="field-label">คำอธิบาย (แสดงหลังตอบ)</label>
            <textarea value={mExplain} onChange={(e) => setMExplain(e.target.value)} />
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setModalOpen(false)}>
                ยกเลิก
              </button>
              <button className="btn" onClick={saveQuestion}>
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMsg && <div className="toast">{toastMsg}</div>}
    </div>
  );
}
