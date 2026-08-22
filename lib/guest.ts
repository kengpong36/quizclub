"use client";

const GUEST_ID_KEY = "qc_guest_id";
const NICKNAME_KEY = "qc_nickname";

export function getGuestId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = "g_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

export function getSavedNickname(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(NICKNAME_KEY) || "";
}

export function saveNickname(name: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(NICKNAME_KEY, name);
}
