"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getGuestId } from "@/lib/guest";
import type { Category, Question, Room, RoomPlayer, RoomAnswer } from "@/lib/types";
import { playCorrect, playReveal, playFanfare } from "@/lib/sound";
import SoundToggle from "@/components/SoundToggle";

const SOURCE_GAME_ID = "truth-or-lie";
const POLL_MS = 1800;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = String(Math.floor(10000 + Math.random() * 90000));
    const { data } = await supabase.from("rooms").select("id").eq("code", code).maybeSingle();
    if (!data) return code;
  }
  return String(Math.floor(10000 + Math.random() * 90000));
}

type Stage = "setup" | "lobby" | "playing" | "ended";

export default function HostMultiplayerPage() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedCatIds, setSelectedCatIds] = useState<Set<string>>(new Set());
  const [roundLength, setRoundLength] = useState(10);

  const [stage, setStage] = useState<Stage>("setup");
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [answersForCurrent, setAnswersForCurrent] = useState<RoomAnswer[]>([]);
  const [allAnswers, setAllAnswers] = useState<RoomAnswer[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function load() {
      const { data: cats } = await supabase
        .from("categories")
        .select("*")
        .eq("game_id", SOURCE_GAME_ID);
      const { data: qs } = await supabase
        .from("questions")
        .select("*")
        .eq("game_id", SOURCE_GAME_ID);
      setCategories(cats || []);
      setQuestions(qs || []);
      setSelectedCatIds(new Set((cats || []).map((c) => c.id)));
      setLoading(false);
    }
    load();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const pool = questions.filter((q) => selectedCatIds.has(q.category_id));
  const availableOptions = Array.from(
    new Set([5, 10, 15, pool.length].filter((v) => v > 0 && v <= pool.length))
  ).sort((a, b) => a - b);

  function toggleCat(id: string) {
    const next = new Set(selectedCatIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCatIds(next);
  }

  async function createRoom() {
    setLoading(true);
    const chosenLen = roundLength && pool.length >= roundLength ? roundLength : pool.length;
    const deck = shuffle(pool).slice(0, chosenLen);
    const code = await generateUniqueCode();
    const hostGuestId = getGuestId();
    const { data, error } = await supabase
      .from("rooms")
      .insert({
        code,
        host_guest_id: hostGuestId,
        game_id: SOURCE_GAME_ID,
        category_ids: Array.from(selectedCatIds),
        question_ids: deck.map((q) => q.id),
        current_index: -1,
        status: "lobby",
      })
      .select()
      .single();
    setLoading(false);
    if (error || !data) return alert("สร้างห้องไม่สำเร็จ: " + error?.message);
    setRoom(data as Room);
    setStage("lobby");
    startPolling(data.id);
  }

  function startPolling(roomId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => refreshRoomData(roomId), POLL_MS);
    refreshRoomData(roomId);
  }

  async function refreshRoomData(roomId: string) {
    const { data: roomRow } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
    if (roomRow) {
      setRoom(roomRow as Room);
      if (roomRow.status === "playing") setStage("playing");
      if (roomRow.status === "ended") setStage("ended");
    }
    const { data: playerRows } = await supabase
      .from("room_players")
      .select("*")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true });
    setPlayers((playerRows as RoomPlayer[]) || []);

    const { data: answerRows } = await supabase.from("room_answers").select("*").eq("room_id", roomId);
    setAllAnswers((answerRows as RoomAnswer[]) || []);
    if (roomRow) {
      setAnswersForCurrent(
        ((answerRows as RoomAnswer[]) || []).filter((a) => a.question_index === roomRow.current_index)
      );
    }
  }

  async function startGame() {
    if (!room) return;
    playReveal();
    const { data } = await supabase
      .from("rooms")
      .update({ status: "playing", current_index: 0 })
      .eq("id", room.id)
      .select()
      .single();
    if (data) {
      setRoom(data as Room);
      setStage("playing");
    }
  }

  async function nextQuestion() {
    if (!room) return;
    const next = room.current_index + 1;
    if (next >= room.question_ids.length) {
      playFanfare();
      const { data } = await supabase
        .from("rooms")
        .update({ status: "ended" })
        .eq("id", room.id)
        .select()
        .single();
      if (data) {
        setRoom(data as Room);
        setStage("ended");
      }
      return;
    }
    playCorrect();
    const { data } = await supabase
      .from("rooms")
      .update({ current_index: next })
      .eq("id", room.id)
      .select()
      .single();
    if (data) {
      setRoom(data as Room);
      setAnswersForCurrent([]);
    }
  }

  async function endGameNow() {
    if (!room) return;
    if (!confirm("จบเกมตอนนี้เลยไหม?")) return;
    playFanfare();
    const { data } = await supabase
      .from("rooms")
      .update({ status: "ended" })
      .eq("id", room.id)
      .select()
      .single();
    if (data) {
      setRoom(data as Room);
      setStage("ended");
    }
  }

  function resetToSetup() {
    if (pollRef.current) clearInterval(pollRef.current);
    setRoom(null);
    setPlayers([]);
    setAllAnswers([]);
    setAnswersForCurrent([]);
    setStage("setup");
  }

  if (loading) {
    return <div className="frame">กำลังโหลด...</div>;
  }

  if (stage === "setup") {
    return (
      <div className="frame">
        <SoundToggle />
        <h2 className="section-title">🎬 สร้างห้อง</h2>
        <div className="section-sub">เลือกหมวดคำถาม แล้วสร้างห้องแชร์รหัสให้เพื่อนเข้ามาเล่น</div>
        <div className="row-between">
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            {pool.length} คำถามที่เลือกไว้
          </span>
          <button
            className="link-btn"
            onClick={() =>
              setSelectedCatIds(
                selectedCatIds.size === categories.length
                  ? new Set()
                  : new Set(categories.map((c) => c.id))
              )
            }
          >
            เลือก/ยกเลิกทั้งหมด
          </button>
        </div>
        <div className="cat-list">
          {categories.map((c) => {
            const count = questions.filter((qq) => qq.category_id === c.id).length;
            return (
              <label className="cat-chip" key={c.id}>
                <span className="cname">
                  <input
                    type="checkbox"
                    checked={selectedCatIds.has(c.id)}
                    onChange={() => toggleCat(c.id)}
                  />
                  {c.name}
                </span>
                <span className="ccount">{count} ข้อ</span>
              </label>
            );
          })}
        </div>
        {pool.length > 0 && (
          <>
            <label className="field-label">จำนวนคำถามต่อรอบ</label>
            <div className="len-select">
              {availableOptions.map((v) => (
                <button
                  key={v}
                  className={v === roundLength ? "sel" : ""}
                  onClick={() => setRoundLength(v)}
                >
                  {v === pool.length ? `ทั้งหมด (${v})` : v}
                </button>
              ))}
            </div>
          </>
        )}
        <button className="btn" disabled={pool.length === 0} onClick={createRoom}>
          สร้างห้อง
        </button>
        <Link href="/multiplayer" className="btn ghost" style={{ display: "block", textAlign: "center", marginTop: 12 }}>
          ← กลับ
        </Link>
      </div>
    );
  }

  if (stage === "lobby" && room) {
    return (
      <div className="frame">
        <SoundToggle />
        <h2 className="section-title" style={{ textAlign: "center" }}>
          รหัสห้องของคุณ
        </h2>
        <div
          style={{
            fontFamily: "Kanit",
            fontWeight: 900,
            fontSize: 56,
            letterSpacing: 8,
            textAlign: "center",
            color: "var(--gold)",
            margin: "10px 0 20px",
          }}
        >
          {room.code}
        </div>
        <div className="info-text" style={{ textAlign: "center", marginBottom: 20 }}>
          บอกรหัสนี้ให้เพื่อนเข้าเว็บ → เล่นสด หลายคน → เข้าร่วมห้อง
        </div>
        <div className="qmeta" style={{ marginBottom: 8 }}>
          ผู้เล่นที่เข้าห้องแล้ว ({players.length})
        </div>
        {players.length === 0 && <div className="empty-note">รอผู้เล่นเข้าห้อง...</div>}
        {players.map((p) => (
          <div className="cat-manage-row" key={p.id}>
            <div className="cinfo">{p.nickname}</div>
          </div>
        ))}
        <button className="btn" style={{ marginTop: 16 }} disabled={players.length === 0} onClick={startGame}>
          {players.length === 0 ? "รอผู้เล่นก่อนนะ" : `เริ่มเกม (${players.length} คน)`}
        </button>
        <button className="btn ghost" style={{ marginTop: 10 }} onClick={resetToSetup}>
          ยกเลิกห้อง
        </button>
      </div>
    );
  }

  if (stage === "playing" && room) {
    const q = questions.find((qq) => qq.id === room.question_ids[room.current_index]);
    const catName = q ? categories.find((c) => c.id === q.category_id)?.name || "หมวด" : "";
    const correctCount = answersForCurrent.filter((a) => a.correct).length;
    return (
      <div className="frame">
        <SoundToggle />
        <div className="row-between">
          <span className="category-tag">{catName}</span>
          <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "Kanit" }}>
            ข้อ {room.current_index + 1}/{room.question_ids.length}
          </span>
        </div>
        <div className="qcard" key={q?.id}>{q?.text}</div>
        {q && (
          <div className="reveal show">
            <div className={"verdict " + (q.answer ? "ok" : "no")}>
              {q.answer ? "✅ คำตอบ: จริง" : "❌ คำตอบ: มั่ว"}
            </div>
            <div>{q.explain}</div>
          </div>
        )}
        <div className="info-text" style={{ textAlign: "center", margin: "16px 0" }}>
          ตอบแล้ว {answersForCurrent.length}/{players.length} คน · ถูก {correctCount} คน
        </div>
        <button className="btn" onClick={nextQuestion}>
          {room.current_index + 1 >= room.question_ids.length ? "จบเกม" : "ข้อถัดไป"}
        </button>
        <button className="btn ghost" style={{ marginTop: 10 }} onClick={endGameNow}>
          🛑 จบเกมตอนนี้เลย
        </button>
      </div>
    );
  }

  if (stage === "ended" && room) {
    const scoreMap: Record<string, { nickname: string; correct: number; total: number }> = {};
    players.forEach((p) => {
      scoreMap[p.guest_id] = { nickname: p.nickname, correct: 0, total: 0 };
    });
    allAnswers.forEach((a) => {
      if (!scoreMap[a.guest_id]) scoreMap[a.guest_id] = { nickname: a.nickname, correct: 0, total: 0 };
      scoreMap[a.guest_id].total += 1;
      if (a.correct) scoreMap[a.guest_id].correct += 1;
    });
    const ranking = Object.values(scoreMap).sort((a, b) => b.correct - a.correct);

    return (
      <div className="frame">
        <SoundToggle />
        <h2 className="section-title" style={{ textAlign: "center" }}>
          🏆 สรุปผล
        </h2>
        {ranking.map((r, i) => (
          <div className="lb-row" key={i}>
            <div className="lb-rank">{i + 1}</div>
            <div className="lb-name" style={{ flex: 1 }}>
              {r.nickname}
            </div>
            <div className="lb-score">
              {r.correct}/{room.question_ids.length}
            </div>
          </div>
        ))}
        <div className="end-actions" style={{ marginTop: 20 }}>
          <button className="btn" onClick={resetToSetup}>
            สร้างห้องใหม่
          </button>
          <Link href="/" className="btn ghost" style={{ textAlign: "center" }}>
            กลับหน้าแรก
          </Link>
        </div>
      </div>
    );
  }

  return <div className="frame">กำลังโหลด...</div>;
}
