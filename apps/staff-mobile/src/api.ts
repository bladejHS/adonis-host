import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const BASE: string = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ?? "http://localhost:4000";
const KEY = "adonis.token";

export type User = { id: string; name: string; role: string; email: string };
export type Room = {
  id: string; number: string; floor: number; type: string; status: "clean" | "dirty" | "inspect" | "maintenance"; notes: string | null;
  occupied: boolean; departureToday: boolean; arrivalToday: boolean;
};
export type Task = {
  id: string; type: string; status: "todo" | "in_progress" | "done" | "verified"; priority: string; dueDate: string; startedAt: string | null;
  notes: string | null; room: { number: string; floor: number }; photos: { id: string }[];
};
export type Item = { id: string; name: string; unit: string; category: string; stock: number; minStock: number };

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await SecureStore.getItemAsync(KEY);
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (body as { message?: string }).message ?? "Nu am putut contacta serverul.");
  return body as T;
}

export const api = {
  async login(email: string, password: string) {
    const r = await request<{ token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    await SecureStore.setItemAsync(KEY, r.token);
    return r.user;
  },
  me: () => request<{ uid: string; name: string; role: string }>("/auth/me"),
  logout: () => SecureStore.deleteItemAsync(KEY),
  rooms: () => request<Room[]>("/housekeeping/rooms"),
  tasks: () => request<Task[]>("/housekeeping/tasks?mine=1"),
  advance: (id: string, status: Task["status"]) => request<Task>(`/housekeeping/tasks/${id}/advance`, { method: "POST", body: JSON.stringify({ status }) }),
  photo: (id: string, image: string, note?: string) => request(`/housekeeping/tasks/${id}/photos`, { method: "POST", body: JSON.stringify({ image, note, kind: "damage" }) }),
  inventory: () => request<Item[]>("/inventory"),
  adjust: (id: string, quantity: number, reason: "restock" | "adjustment" | "damage") => request<Item>(`/inventory/${id}/adjust`, { method: "POST", body: JSON.stringify({ quantity, reason }) }),
  registerDevice: (token: string, platform: "ios" | "android") => request("/devices", { method: "POST", body: JSON.stringify({ token, platform }) }),
};
