import { runtime } from "./runtime";

export type StoredArtwork = {
  id: number;
  title: string;
  artworkDate: string;
  description: string;
  imageKey: string;
  published: boolean;
  sortOrder: number;
};

function configuration() {
  const { D1_GATEWAY_URL: url, D1_GATEWAY_SECRET: secret } = runtime();
  if (!url || !secret) throw new Error("D1 gateway is not configured.");
  return { url: url.replace(/\/$/, ""), secret };
}

export async function gatewayRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, secret } = configuration();
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${secret}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${url}${path}`, { ...init, headers, cache: "no-store" });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || `D1 gateway request failed (${response.status}).`);
  return data;
}

export function listArtworks(includeHidden: boolean, limit: number, page: number) {
  return gatewayRequest<{ artworks: StoredArtwork[] }>(`/artworks?admin=${includeHidden ? "1" : "0"}&limit=${limit}&page=${page}`);
}

export function createArtwork(input: Omit<StoredArtwork, "id" | "sortOrder"> & { imageKey: string }) {
  return gatewayRequest<{ id: number }>("/artworks", { method: "POST", body: JSON.stringify(input) });
}

export function updateArtwork(id: number, input: Pick<StoredArtwork, "artworkDate" | "description" | "published">) {
  return gatewayRequest<{ ok: true }>(`/artworks/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteArtworkRecord(id: number) {
  return gatewayRequest<{ ok: true; imageKey?: string }>(`/artworks/${id}`, { method: "DELETE" });
}
