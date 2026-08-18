"use client";
/* eslint-disable @next/next/no-img-element -- local blob preview exists only in this browser session */

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Artwork, ArtworkVisual } from "./Gallery";

const DESCRIPTION_LIMIT = 300;
const ADMIN_PAGE_SIZE = 6;

function DescriptionField({ initialValue = "" }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue.slice(0, DESCRIPTION_LIMIT));
  return <div className="field">
    <label htmlFor="description">Reference note</label>
    <textarea id="description" name="description" maxLength={DESCRIPTION_LIMIT} value={value} onChange={(event) => setValue(event.target.value)} placeholder="A short note about this piece…" />
    <span className="character-count">{value.length}/{DESCRIPTION_LIMIT}</span>
  </div>;
}

export function AdminStudio() {
  const [works, setWorks] = useState<Artwork[]>([]);
  const [loadingWorks, setLoadingWorks] = useState(true);
  const [listPage, setListPage] = useState(1);
  const [formVersion, setFormVersion] = useState(0);
  const [editing, setEditing] = useState<Artwork | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [preparedImage, setPreparedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageNote, setImageNote] = useState("");
  const today = (() => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  })();

  async function readResult(response: Response) {
    const text = await response.text();
    try { return JSON.parse(text) as { error?: string }; }
    catch { return { error: response.ok ? undefined : `Request failed (${response.status}).` }; }
  }

  function formatBytes(bytes: number) {
    return bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  async function encodeWebp(canvas: HTMLCanvasElement, quality: number) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (!blob) throw new Error("This browser could not create the display copy.");
    return blob;
  }

  async function makeDisplayCopy(source: File) {
    const bitmap = await createImageBitmap(source);
    const maxEdge = 3200;
    const targetBytes = 1.5 * 1024 * 1024;
    if (source.size <= targetBytes && Math.max(bitmap.width, bitmap.height) <= maxEdge) {
      bitmap.close();
      return { file: source, changed: false };
    }

    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    let width = Math.max(1, Math.round(bitmap.width * scale));
    let height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    let selected: Blob | null = null;

    for (let sizePass = 0; sizePass < 6 && !selected; sizePass += 1) {
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser could not prepare the image.");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, width, height);

      // Find the highest WebP quality that fits the size budget.
      let low = 0.55;
      let high = 0.92;
      for (let qualityPass = 0; qualityPass < 7; qualityPass += 1) {
        const quality = (low + high) / 2;
        const candidate = await encodeWebp(canvas, quality);
        if (candidate.size <= targetBytes) {
          selected = candidate;
          low = quality;
        } else {
          high = quality;
        }
      }

      if (!selected) {
        const smallest = await encodeWebp(canvas, 0.55);
        const reduction = Math.min(0.88, Math.sqrt(targetBytes / smallest.size) * 0.96);
        const minimumScale = Math.min(1, 1200 / Math.max(width, height));
        const appliedScale = Math.max(minimumScale, reduction);
        if (appliedScale >= 0.99) {
          selected = smallest;
        } else {
          width = Math.max(1, Math.round(width * appliedScale));
          height = Math.max(1, Math.round(height * appliedScale));
        }
      }
    }

    bitmap.close();
    if (!selected) selected = await encodeWebp(canvas, 0.55);
    const baseName = source.name.replace(/\.[^.]+$/, "") || "artwork";
    return { file: new File([selected], `${baseName}.webp`, { type: "image/webp", lastModified: Date.now() }), changed: true };
  }

  async function prepareSelectedImage(event: ChangeEvent<HTMLInputElement>) {
    const source = event.target.files?.[0];
    setPreparedImage(null);
    setPreviewUrl((current) => { if (current) URL.revokeObjectURL(current); return ""; });
    setImageNote("");
    if (!source) return;
    try {
      setImageNote(`Preparing ${formatBytes(source.size)} original…`);
      const prepared = await makeDisplayCopy(source);
      setPreparedImage(prepared.file);
      setPreviewUrl(URL.createObjectURL(prepared.file));
      setImageNote(prepared.changed
        ? `${formatBytes(source.size)} original → ${formatBytes(prepared.file.size)} display copy · adaptive quality · max 3200 px`
        : `${formatBytes(source.size)} · already optimized, keeping the original file`);
    } catch (error) {
      event.target.value = "";
      setImageNote(error instanceof Error ? error.message : "Could not prepare this image.");
    }
  }

  const load = useCallback(() => fetch("/api/artworks?admin=1&limit=100")
    .then((response) => response.ok ? response.json() : Promise.reject())
    .then((data) => {
      const nextWorks = data.artworks || [];
      setWorks(nextWorks);
      setListPage((current) => Math.min(current, Math.max(1, Math.ceil(nextWorks.length / ADMIN_PAGE_SIZE))));
    })
    .catch(() => { setWorks([]); setListPage(1); })
    .finally(() => setLoadingWorks(false)), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const listPages = Math.max(1, Math.ceil(works.length / ADMIN_PAGE_SIZE));
  const visibleWorks = works.slice((listPage - 1) * ADMIN_PAGE_SIZE, listPage * ADMIN_PAGE_SIZE);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = event.currentTarget;
    let response: Response;
    if (editing) {
      const data = new FormData(form);
      response = await fetch(`/api/artworks/${editing.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(data)) });
    } else {
      if (!preparedImage) { setMessage("Choose an image and wait for its display copy to finish preparing."); setBusy(false); return; }
      const data = new FormData(form);
      data.delete("imageSource");
      data.set("image", preparedImage);
      response = await fetch("/api/artworks", { method: "POST", body: data });
    }
    const result = await readResult(response);
    if (!response.ok) setMessage(result.error || "Something went wrong.");
    else {
      setMessage(editing ? "Changes saved." : "Artwork added.");
      form.reset();
      setPreparedImage(null);
      setPreviewUrl("");
      setImageNote("");
      setEditing(null);
      setFormVersion((current) => current + 1);
      if (!editing) setListPage(1);
      await load();
    }
    setBusy(false);
  }

  async function remove(work: Artwork) {
    if (!window.confirm("Delete this artwork and its image? This cannot be undone.")) return;
    const response = await fetch(`/api/artworks/${work.id}`, { method: "DELETE" });
    if (response.ok) await load(); else setMessage("Could not delete that artwork.");
  }

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); window.location.reload(); }

  return <>
    <header className="admin-top">
      <div className="site-shell admin-heading">
        <h1>Manage artwork</h1>
        <div className="admin-actions"><Link className="button secondary" href="/">View archive</Link><button className="button secondary" onClick={logout}>Sign out</button></div>
      </div>
    </header>
    <div className="site-shell admin-layout">
      <form className="upload-panel" onSubmit={save} key={`${editing?.id || "new"}-${formVersion}`}>
        <h2>{editing ? "Edit artwork" : "Add artwork"}</h2>
        {!editing && <div className="upload-field">
          <label className="dropzone" htmlFor="imageSource">
            {previewUrl ? <img className="upload-preview" src={previewUrl} alt="Selected artwork preview" /> : <span className="dropzone-mark" aria-hidden="true">＋</span>}
            <strong>{preparedImage ? "Choose a different image" : "Click anywhere to choose artwork"}</strong>
            <span>JPG, PNG, WebP or AVIF</span>
            <input id="imageSource" name="imageSource" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required onChange={prepareSelectedImage} />
          </label>
          {imageNote && <p className="image-note">{imageNote}</p>}
        </div>}
        <div className="field"><label htmlFor="artworkDate">Date</label><input id="artworkDate" name="artworkDate" type="date" defaultValue={editing?.artworkDate || today} /></div>
        <DescriptionField initialValue={editing?.description} />
        <div className="field"><label htmlFor="published">Visibility</label><select id="published" name="published" defaultValue={editing ? String(editing.published) : "true"}><option value="true">Published</option><option value="false">Hidden draft</option></select></div>
        {message && <p className={message.includes("saved") || message.includes("added") ? "" : "error"}>{message}</p>}
        <div className="row-actions"><button className="button" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add to archive"}</button>{editing && <button type="button" className="button secondary" onClick={() => setEditing(null)}>Cancel</button>}</div>
      </form>
      <section className="works-panel"><h2>{loadingWorks ? "All artwork" : `All artwork · ${works.length}`}</h2>
        <div className="admin-list">{loadingWorks ? Array.from({ length: 4 }, (_, index) => <div className="admin-row admin-skeleton" key={index} aria-hidden="true">
          <div className="admin-thumb" />
          <div className="admin-skeleton-copy"><span /><span /></div>
          <div className="admin-skeleton-actions"><span /><span /></div>
        </div>) : works.length ? visibleWorks.map((work, index) => <article className="admin-row" key={work.id}>
          <div className="admin-thumb"><ArtworkVisual artwork={work} index={(listPage - 1) * ADMIN_PAGE_SIZE + index} /></div><div><p>{work.artworkDate || "No date"} · {work.published ? "Published" : "Hidden"}</p></div>
          <div className="row-actions"><button className="icon-button" onClick={() => setEditing(work)}>Edit</button><button className="icon-button" onClick={() => remove(work)}>Delete</button></div>
        </article>) : <div className="empty-state">No uploaded works yet. Add the first one from the form.</div>}</div>
        {loadingWorks && <span className="sr-only" role="status">Loading artwork list</span>}
        {!loadingWorks && listPages > 1 && <nav className="admin-pagination" aria-label="Admin artwork pages">
          <button className="page-button" disabled={listPage === 1} onClick={() => setListPage((page) => page - 1)} aria-label="Previous artwork page">←</button>
          <span>Page {listPage} of {listPages}</span>
          <button className="page-button" disabled={listPage === listPages} onClick={() => setListPage((page) => page + 1)} aria-label="Next artwork page">→</button>
        </nav>}
      </section>
    </div>
  </>;
}
