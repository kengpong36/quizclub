"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getGuestId, getSavedNickname, saveNickname } from "@/lib/guest";
import type { PokRoom, PokPlayer, PokBet, PokHand } from "@/lib/types";
import { freshDeck, shuffleDeck, isPok, classifyHand, compareHands, type Card } from "@/lib/pokdeng";
import { playFlip, playReveal, playFanfare } from "@/lib/sound";
import SoundToggle from "@/components/SoundToggle";

const POLL_MS = 1600;

function CardView({ card, hidden }: { card?: Card; hidden?: boolean }) {
  if (hidden || !card) {
    return (
      <div
        style={{
          width: 40,
          height: 56,
          borderRadius: 6,
          background: "linear-gradient(160deg,var(--gold-dim),var(--gold))",
          border: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
        }}
      >
        🂠
      </div>
    );
  }
  const isRed = card.suit === "♥" || card.suit === "♦";
  return (
    <div
      style={{
        width: 40,
        height: 56,
        borderRadius: 6,
        background: "#fff",
        border: "1px solid var(--line)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: isRed ? "#C23B33" : "#222",
        fontFamily: "Kanit",
        fontWeight: 800,
        boxShadow: "0 2px 4px rgba(0,0,0,0.12)",
      }}
    >
      <div style={{ fontSize: 13 }}>{card.rank}</div>
      <div style={{ fontSize: 15 }}>{card.suit}</div>
    </div>
  );
}

export default function PokDengRoomPage() {
  const { code } = useParams<{ code: string }>();
  const guestId = getGuestId();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [room, setRoom] = useState<PokRoom | null>(null);
  const [players, setPlayers] = useState<PokPlayer[]>([]);
  const [bets, setBets] = useState<PokBet[]>([]);
  const [hands, setHands] = useState<PokHand[]>([]);
  const [joined, setJoined] = useState(false);
  const [nicknameInput, setNicknameInput] = useState(getSavedNickname());

  const [betInput, setBetInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function playerName(id: string) {
    return players.find((p) => p.guest_id === id)?.nickname || "ผู้เล่น";
  }
  function playerChips(id: string) {
    return players.find((p) => p.guest_id === id)?.chips ?? 0;
  }

  useEffect(() => {
    async function init() {
      const { data: roomRow, error: roomErr } = await supabase
        .from("pokdeng_rooms")
        .select("*")
        .eq("code", code)
        .maybeSingle();
      if (roomErr || !roomRow) {
        setError("ไม่พบห้องนี้");
        setLoading(false);
        return;
      }
      setRoom(roomRow as PokRoom);
      const { data: existing } = await supabase
        .from("pokdeng_players")
        .select("*")
        .eq("room_id", roomRow.id)
        .eq("guest_id", guestId)
        .maybeSingle();
      if (existing) setJoined(true);
      setLoading(false);
      startPolling(roomRow.id);
    }
    init();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  function startPolling(roomId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => refresh(roomId), POLL_MS);
    refresh(roomId);
  }

  async function refresh(roomId: string) {
    const { data: roomRow } = await supabase.from("pokdeng_rooms").select("*").eq("id", roomId).maybeSingle();
    if (!roomRow) return;
    setRoom(roomRow as PokRoom);
    const { data: playerRows } = await supabase
      .from("pokdeng_players")
      .select("*")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true });
    setPlayers((playerRows as PokPlayer[]) || []);
    if (roomRow.round_number > 0) {
      const { data: betRows } = await supabase
        .from("pokdeng_bets")
        .select("*")
        .eq("room_id", roomId)
        .eq("round_number", roomRow.round_number);
      setBets((betRows as PokBet[]) || []);
      const { data: handRows } = await supabase
        .from("pokdeng_hands")
        .select("*")
        .eq("room_id", roomId)
        .eq("round_number", roomRow.round_number);
      setHands((handRows as PokHand[]) || []);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!room) return;
    const name = nicknameInput.trim();
    if (!name) return;
    saveNickname(name);
    await supabase
      .from("pokdeng_players")
      .upsert({ room_id: room.id, guest_id: guestId, nickname: name, chips: 200 }, { onConflict: "room_id,guest_id" });
    setJoined(true);
  }

  const isHost = room?.host_guest_id === guestId;
  const isBanker = room?.banker_guest_id === guestId;
  const myPlayer = players.find((p) => p.guest_id === guestId);
  const myHand = hands.find((h) => h.guest_id === guestId);
  const myBet = bets.find((b) => b.guest_id === guestId);

  // ---------------- LOBBY ----------------
  async function startGame() {
    if (!room || players.length < 2) return;
    const order = players.map((p) => p.guest_id);
    await supabase
      .from("pokdeng_rooms")
      .update({
        turn_order: order,
        banker_guest_id: order[0],
        round_number: 1,
        status: "betting",
        acting_guest_id: null,
        deck: [],
      })
      .eq("id", room.id);
    playReveal();
    refresh(room.id);
  }

  // ---------------- BETTING ----------------
  async function submitBet() {
    if (!room || !myPlayer) return;
    const amt = parseInt(betInput, 10);
    if (isNaN(amt) || amt < room.min_bet || amt > room.max_bet) {
      setFlash(`เดิมพันต้องอยู่ระหว่าง ${room.min_bet}-${room.max_bet}`);
      setTimeout(() => setFlash(""), 2000);
      return;
    }
    if (amt > myPlayer.chips) {
      setFlash("ชิปไม่พอ");
      setTimeout(() => setFlash(""), 2000);
      return;
    }
    setBusy(true);
    await supabase
      .from("pokdeng_bets")
      .upsert(
        { room_id: room.id, round_number: room.round_number, guest_id: guestId, amount: amt },
        { onConflict: "room_id,round_number,guest_id" }
      );
    setBusy(false);
    refresh(room.id);
  }

  function activeBettors(): string[] {
    if (!room) return [];
    return room.turn_order.filter((id) => id !== room.banker_guest_id && playerChips(id) > 0);
  }

  async function dealCards() {
    if (!room) return;
    setBusy(true);
    const bettors = activeBettors();
    const dealTo = [...bettors, room.banker_guest_id as string];
    let deck = shuffleDeck(freshDeck());
    const dealtHands: Record<string, Card[]> = {};
    dealTo.forEach((id) => (dealtHands[id] = []));
    for (let round = 0; round < 2; round++) {
      for (const id of dealTo) {
        dealtHands[id].push(deck.pop() as Card);
      }
    }
    // write hands
    const rows = dealTo.map((id) => ({
      room_id: room.id,
      round_number: room.round_number,
      guest_id: id,
      cards: dealtHands[id],
      stayed: false,
    }));
    await supabase.from("pokdeng_hands").upsert(rows, { onConflict: "room_id,round_number,guest_id" });

    // determine acting order: bettors first (in turn order), banker last; skip anyone with Pok
    const actionSeq = [...bettors, room.banker_guest_id as string];
    const firstActor = actionSeq.find((id) => !isPok(dealtHands[id]));

    await supabase
      .from("pokdeng_rooms")
      .update({
        deck,
        status: firstActor ? "acting" : "reveal",
        acting_guest_id: firstActor || null,
      })
      .eq("id", room.id);

    if (!firstActor) {
      await settleRound(dealtHands, bettors);
    }
    playFlip();
    setBusy(false);
    refresh(room.id);
  }

  // ---------------- ACTING ----------------
  function computeActionSequence(): string[] {
    if (!room) return [];
    return [...activeBettors(), room.banker_guest_id as string];
  }

  async function act(stay: boolean) {
    if (!room) return;
    setBusy(true);
    const seq = computeActionSequence();
    const currentHands: Record<string, Card[]> = {};
    hands.forEach((h) => (currentHands[h.guest_id] = h.cards));
    let myCards = currentHands[guestId] || [];
    let deck = [...room.deck];

    if (!stay) {
      const drawn = deck.pop();
      if (drawn) myCards = [...myCards, drawn];
    }
    currentHands[guestId] = myCards;

    await supabase
      .from("pokdeng_hands")
      .upsert(
        { room_id: room.id, round_number: room.round_number, guest_id: guestId, cards: myCards, stayed: true },
        { onConflict: "room_id,round_number,guest_id" }
      );

    const idx = seq.indexOf(guestId);
    const remaining = seq.slice(idx + 1).filter((id) => !isPok(currentHands[id] || []));
    const next = remaining[0] || null;

    await supabase
      .from("pokdeng_rooms")
      .update({ deck, status: next ? "acting" : "reveal", acting_guest_id: next })
      .eq("id", room.id);

    if (!next) {
      await settleRound(currentHands, activeBettors());
    } else {
      playFlip();
    }
    setBusy(false);
    refresh(room.id);
  }

  // ---------------- SETTLEMENT ----------------
  async function settleRound(handsMap: Record<string, Card[]>, bettors: string[]) {
    if (!room) return;
    const bankerId = room.banker_guest_id as string;
    const bankerHand = classifyHand(handsMap[bankerId] || []);
    let bankerDelta = 0;

    for (const pid of bettors) {
      const bet = bets.find((b) => b.guest_id === pid)?.amount || 0;
      const playerHand = classifyHand(handsMap[pid] || []);
      const cmp = compareHands(playerHand, bankerHand);
      let delta = 0;
      if (cmp > 0) {
        delta = bet * playerHand.multiplier; // player wins
      } else {
        delta = -bet * bankerHand.multiplier; // banker wins (tie goes to banker)
      }
      bankerDelta -= delta;
      const p = players.find((pp) => pp.guest_id === pid);
      if (p) {
        await supabase.from("pokdeng_players").update({ chips: p.chips + delta }).eq("id", p.id);
      }
    }
    const banker = players.find((pp) => pp.guest_id === bankerId);
    if (banker) {
      await supabase.from("pokdeng_players").update({ chips: banker.chips + bankerDelta }).eq("id", banker.id);
    }
    playFanfare();
  }

  // ---------------- ROUND PROGRESSION ----------------
  async function nextRound() {
    if (!room) return;
    const idx = room.turn_order.indexOf(room.banker_guest_id as string);
    const nextBanker = room.turn_order[(idx + 1) % room.turn_order.length];
    await supabase
      .from("pokdeng_rooms")
      .update({
        round_number: room.round_number + 1,
        banker_guest_id: nextBanker,
        status: "betting",
        acting_guest_id: null,
        deck: [],
      })
      .eq("id", room.id);
    refresh(room.id);
  }

  async function endGame() {
    if (!room) return;
    if (!confirm("จบเกมตอนนี้เลยไหม?")) return;
    await supabase.from("pokdeng_rooms").update({ status: "ended" }).eq("id", room.id);
    refresh(room.id);
  }

  // ---------------- RENDER ----------------
  if (loading) return <div className="frame">กำลังโหลด...</div>;
  if (error || !room) {
    return (
      <div className="frame">
        <div className="empty-note">{error || "ไม่พบห้องนี้"}</div>
        <Link href="/pokdeng" className="btn" style={{ display: "block", textAlign: "center", marginTop: 12 }}>
          ลองใหม่
        </Link>
      </div>
    );
  }

  if (!joined) {
    if (room.status !== "lobby") {
      return (
        <div className="frame">
          <div className="empty-note">ห้องนี้เริ่มเกมไปแล้ว รอรอบหน้าหรือให้เจ้าภาพสร้างห้องใหม่นะครับ</div>
        </div>
      );
    }
    return (
      <div className="frame">
        <SoundToggle />
        <h2 className="section-title">เข้าห้องป๊อกเด้ง {room.code}</h2>
        <form onSubmit={handleJoin}>
          <label className="field-label">ชื่อเล่น</label>
          <input type="text" value={nicknameInput} onChange={(e) => setNicknameInput(e.target.value)} maxLength={20} autoFocus />
          <button className="btn" style={{ marginTop: 16 }} type="submit">
            เข้าร่วม (ชิปเริ่มต้น 200)
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
          ห้อง {room.code}
        </h2>
        <div className="section-sub" style={{ textAlign: "center" }}>
          เดิมพัน {room.min_bet}-{room.max_bet} ชิป · ผู้เล่น {players.length} คน
        </div>
        {players.map((p) => (
          <div className="cat-manage-row" key={p.id}>
            <div className="cinfo">
              {p.nickname} {p.guest_id === guestId && "(คุณ)"}
            </div>
            <div className="cn">{p.chips} ชิป</div>
          </div>
        ))}
        {isHost ? (
          <button className="btn" style={{ marginTop: 16 }} disabled={players.length < 2} onClick={startGame}>
            {players.length < 2 ? "รอผู้เล่นอย่างน้อย 2 คน" : `เริ่มเกม (${players.length} คน)`}
          </button>
        ) : (
          <div className="info-text" style={{ textAlign: "center", marginTop: 16 }}>
            รอเจ้าภาพเริ่มเกม...
          </div>
        )}
      </div>
    );
  }

  if (room.status === "ended") {
    const ranked = [...players].sort((a, b) => b.chips - a.chips);
    return (
      <div className="frame">
        <SoundToggle />
        <h2 className="section-title" style={{ textAlign: "center" }}>
          🏆 สรุปชิป
        </h2>
        {ranked.map((p, i) => (
          <div className="lb-row" key={p.id}>
            <div className="lb-rank">{i + 1}</div>
            <div className="lb-name" style={{ flex: 1 }}>
              {p.nickname} {p.guest_id === guestId && "(คุณ)"}
            </div>
            <div className="lb-score">{p.chips}</div>
          </div>
        ))}
        <Link href="/" className="btn ghost" style={{ display: "block", textAlign: "center", marginTop: 16 }}>
          กลับหน้าแรก
        </Link>
      </div>
    );
  }

  const bankerName = playerName(room.banker_guest_id || "");
  const bettors = activeBettors();

  return (
    <div className="frame">
      <SoundToggle />
      <div className="row-between">
        <h2 className="section-title" style={{ marginBottom: 0 }}>
          🃏 ห้อง {room.code}
        </h2>
        <button className="link-btn" onClick={endGame}>
          🛑 จบเกม
        </button>
      </div>
      <div className="info-text" style={{ marginBottom: 14 }}>
        รอบที่ {room.round_number} · เจ้ามือ: {bankerName} {isBanker && "(คุณ)"} · ชิปของคุณ:{" "}
        {myPlayer?.chips ?? 0}
      </div>

      {room.status === "betting" && (
        <>
          {isBanker ? (
            <>
              <div className="info-text" style={{ textAlign: "center", marginBottom: 12 }}>
                รอผู้เล่นวางเดิมพัน {bets.length}/{bettors.length} คน
              </div>
              {bets.length >= bettors.length && bettors.length > 0 ? (
                <button className="btn" onClick={dealCards} disabled={busy}>
                  🎴 แจกไพ่
                </button>
              ) : (
                <div className="empty-note">คุณเป็นเจ้ามือรอบนี้ ไม่ต้องวางเดิมพัน</div>
              )}
            </>
          ) : myBet ? (
            <div className="info-text" style={{ textAlign: "center" }}>
              วางเดิมพัน {myBet.amount} ชิปแล้ว รอเจ้ามือแจกไพ่...
            </div>
          ) : (playerChips(guestId) <= 0) ? (
            <div className="empty-note">ชิปหมด รอบนี้พักดูก่อนนะครับ</div>
          ) : (
            <>
              <label className="field-label">
                วางเดิมพัน ({room.min_bet}-{room.max_bet} ชิป)
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={betInput}
                  onChange={(e) => setBetInput(e.target.value.replace(/\D/g, ""))}
                  placeholder={String(room.min_bet)}
                />
                <button className="btn small" onClick={submitBet} disabled={busy}>
                  วางเดิมพัน
                </button>
              </div>
              {flash && <div className="error-text">{flash}</div>}
            </>
          )}
        </>
      )}

      {(room.status === "acting" || room.status === "reveal") && (
        <>
          <div style={{ marginBottom: 16 }}>
            {[...bettors, room.banker_guest_id as string].map((pid) => {
              const h = hands.find((x) => x.guest_id === pid);
              const isMe = pid === guestId;
              const showFace = isMe || room.status === "reveal";
              const cards = h?.cards || [];
              const result = cards.length >= 2 ? classifyHand(cards) : null;
              return (
                <div className="qrow" key={pid}>
                  <div className="qrow-top" style={{ alignItems: "center" }}>
                    <div style={{ fontFamily: "Kanit", fontWeight: 700, fontSize: 13 }}>
                      {playerName(pid)} {pid === room.banker_guest_id && "👑"} {isMe && "(คุณ)"}
                      {room.status === "acting" && room.acting_guest_id === pid && " ⏳"}
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {[0, 1, 2].map((i) => (
                        <CardView key={i} card={cards[i]} hidden={!showFace || i >= cards.length} />
                      ))}
                    </div>
                  </div>
                  {room.status === "reveal" && result && (
                    <div className="qmeta" style={{ marginTop: 6 }}>
                      {result.label} · แต้ม {result.point}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {room.status === "acting" && room.acting_guest_id === guestId && (
            <div className="answers">
              <button className="ans-btn truth" onClick={() => act(true)} disabled={busy}>
                อยู่
              </button>
              <button className="ans-btn lie" onClick={() => act(false)} disabled={busy}>
                จั่ว
              </button>
            </div>
          )}
          {room.status === "acting" && room.acting_guest_id !== guestId && (
            <div className="info-text" style={{ textAlign: "center" }}>
              รอ {playerName(room.acting_guest_id || "")} ตัดสินใจ...
            </div>
          )}

          {room.status === "reveal" && (
            <button className="btn" style={{ marginTop: 10 }} onClick={nextRound}>
              รอบถัดไป (เจ้ามือ: {playerName(room.turn_order[(room.turn_order.indexOf(room.banker_guest_id || "") + 1) % room.turn_order.length])})
            </button>
          )}
        </>
      )}

      <div style={{ marginTop: 20 }}>
        <div className="qmeta" style={{ marginBottom: 6 }}>
          ชิปผู้เล่นทั้งหมด
        </div>
        {players.map((p) => (
          <div className="lb-row" key={p.id} style={{ padding: "8px 12px" }}>
            <div className="lb-name" style={{ flex: 1, fontSize: 13 }}>
              {p.nickname} {p.guest_id === room.banker_guest_id && "👑"}
            </div>
            <div className="lb-score" style={{ fontSize: 14 }}>
              {p.chips}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
