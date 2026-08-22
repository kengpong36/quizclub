"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getGuestId, getSavedNickname, saveNickname } from "@/lib/guest";
import type { Category, Question, Room, RoomPlayer, RoomAnswer } from "@/lib/types";
import { playTick, playCorrect, playWrong, playFanfare } from "@/lib/sound";
import SoundToggle from "@/components/SoundToggle";

const POLL_MS = 1500;
const TOTAL_TIME = 10;

export default function PlayerRoomPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const guestId = getGuestId();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [questionsById, setQuestionsById] = useState<Record<string, Question>>({});
  const [joined, setJoined] = useState(false);
  const [nickname, setNickname] = useState("");
  const [nicknameInput, setNicknameInput] = useState("");

  const [seenIndex, setSeenIndex] = useState(-1);
  const [chosen, setChosen] = useState<boolean | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [allAnswers, setAllAnswers] = useState<RoomAnswer[]>([]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setNickname(getSavedNickname());
    setNicknameInput(getSavedNickname());
  }, []);

  useEffect(() => {
    async function init() {
      const { data: roomRow, error: roomErr } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", code)
        .maybeSingle();
      if (roomErr || !roomRow) {
        setError("ไม่พบห้องนี้");
        setLoading(false);
        return;
      }
      setRoom(roomRow as Room);

      const { data: cats } = await supabase
        .from("categories")
        .select("*")
        .eq("game_id", roomRow.game_id);
      setCategories(cats || []);

      if (roomRow.question_ids?.length > 0) {
        const { data: qs } = await supabase
          .from("questions")
          .select("*")
          .in("id", roomRow.question_ids);
        const map: Record<string, Question> = {};
        (qs || []).forEach((q: Question) => (map[q.id] = q));
        setQuestionsById(map);
      }

      const { data: existingPlayer } = await supabase
        .from("room_players")
        .select("*")
        .eq("room_id", roomRow.id)
        .eq("guest_id", guestId)
        .maybeSingle();
      if (existingPlayer) setJoined(true);

      setLoading(false);
      startPolling(roomRow.id);
    }
    init();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  function startPolling(roomId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => refresh(roomId), POLL_MS);
  }

  async function refresh(roomId: string) {
    const { data: roomRow } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
    if (roomRow) setRoom(roomRow as Room);
    const { data: playerRows } = await supabase
      .from("room_players")
      .select("*")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true });
    setPlayers((playerRows as RoomPlayer[]) || []);
    if (roomRow?.status === "ended") {
      const { data: answerRows } = await supabase.from("room_answers").select("*").eq("room_id", roomId);
      setAllAnswers((answerRows as RoomAnswer[]) || []);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!room) return;
    const name = nicknameInput.trim();
    if (!name) return;
    saveNickname(name);
    setNickname(name);
    await supabase
      .from("room_players")
      .upsert({ room_id: room.id, guest_id: guestId, nickname: name }, { onConflict: "room_id,guest_id" });
    setJoined(true);
  }

  // Start a fresh per-question timer whenever the host advances current_index
  useEffect(() => {
    if (!room || room.status !== "playing") return;
    if (room.current_index === seenIndex) return;
    setSeenIndex(room.current_index);
    setChosen(null);
    setSubmitted(false);
    setTimeLeft(TOTAL_TIME);
    if (timerRef.current) clearInterval(timerRef.current);
    let t = TOTAL_TIME;
    timerRef.current = setInterval(() => {
      t -= 0.1;
      setTimeLeft(Math.max(0, t));
      if (Math.ceil(t) <= 3 && Math.ceil(t) >= 1 && t % 1 < 0.15) playTick();
      if (t <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        submitAnswer(null);
      }
    }, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.current_index, room?.status]);

  async function submitAnswer(value: boolean | null) {
    if (!room || submitted) return;
    setSubmitted(true);
    setChosen(value);
    if (timerRef.current) clearInterval(timerRef.current);
    const q = questionsById[room.question_ids[room.current_index]];
    if (!q) return;
    const correct = value !== null && value === q.answer;
    if (value !== null) {
      if (correct) playCorrect();
      else playWrong();
    }
    await supabase.from("room_answers").upsert(
      {
        room_id: room.id,
        question_index: room.current_index,
        guest_id: guestId,
        nickname,
        answer: value,
        correct,
      },
      { onConflict: "room_id,question_index,guest_id" }
    );
  }

  if (loading) return <div className="frame">กำลังโหลด...</div>;
  if (error || !room) {
    return (
      <div className="frame">
        <div className="empty-note">{error || "ไม่พบห้องนี้"}</div>
        <Link href="/multiplayer/join" className="btn" style={{ display: "block", textAlign: "center", marginTop: 12 }}>
          ลองใหม่
        </Link>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="frame">
        <SoundToggle />
        <h2 className="section-title">เข้าห้อง {room.code}</h2>
        <div className="section-sub">ใส่ชื่อเล่นของคุณเพื่อเข้าร่วม</div>
        <form onSubmit={handleJoin}>
          <label className="field-label">ชื่อเล่น</label>
          <input
            type="text"
            value={nicknameInput}
            onChange={(e) => setNicknameInput(e.target.value)}
            maxLength={20}
            autoFocus
          />
          <button className="btn" style={{ marginTop: 16 }} type="submit">
            เข้าร่วม
          </button>
        </form>
      </div>
    );
  }

  if (room.status === "lobby") {
    return (
      <div className="frame">
        <SoundToggle />
        <h2 className="section-title" style={{ textAlign: "center" }}>
          รอเจ้าภาพเริ่มเกม...
        </h2>
        <div className="section-sub" style={{ textAlign: "center" }}>
          ห้อง {room.code} · เข้าร่วมแล้ว {players.length} คน
        </div>
        {players.map((p) => (
          <div className="cat-manage-row" key={p.id}>
            <div className="cinfo">
              {p.nickname} {p.guest_id === guestId && "(คุณ)"}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (room.status === "ended") {
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
    const myRank = ranking.findIndex((r) => r.nickname === nickname);

    return (
      <div className="frame">
        <SoundToggle />
        <h2 className="section-title" style={{ textAlign: "center" }}>
          🏆 สรุปผล
        </h2>
        {ranking.map((r, i) => (
          <div
            className="lb-row"
            key={i}
            style={i === myRank ? { borderColor: "var(--gold)" } : {}}
          >
            <div className="lb-rank">{i + 1}</div>
            <div className="lb-name" style={{ flex: 1 }}>
              {r.nickname}
            </div>
            <div className="lb-score">
              {r.correct}/{room.question_ids.length}
            </div>
          </div>
        ))}
        <Link href="/" className="btn ghost" style={{ display: "block", textAlign: "center", marginTop: 16 }}>
          กลับหน้าแรก
        </Link>
      </div>
    );
  }

  // status === "playing"
  const q = questionsById[room.question_ids[room.current_index]];
  const catName = q ? categories.find((c) => c.id === q.category_id)?.name || "หมวด" : "";
  const pct = Math.max(0, (timeLeft / TOTAL_TIME) * 100);

  return (
    <div className="frame">
      <SoundToggle />
      <div className="row-between">
        <span className="category-tag">{catName}</span>
        <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "Kanit" }}>
          ข้อ {room.current_index + 1}/{room.question_ids.length}
        </span>
      </div>
      <div className="fuse-track">
        <div className="fuse-bar" style={{ width: pct + "%" }} />
      </div>
      <div className="qcard" key={q?.id}>{q?.text}</div>
      {!submitted ? (
        <div className="answers">
          <button className="ans-btn truth" onClick={() => submitAnswer(true)}>
            จริง
          </button>
          <button className="ans-btn lie" onClick={() => submitAnswer(false)}>
            มั่ว
          </button>
        </div>
      ) : (
        <div className="info-text" style={{ textAlign: "center" }}>
          {chosen === null ? "⏱ หมดเวลา" : "✅ ส่งคำตอบแล้ว"} — รอเจ้าภาพไปข้อถัดไป...
        </div>
      )}
    </div>
  );
}
