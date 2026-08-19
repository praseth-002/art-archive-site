"use client";
/* eslint-disable @next/next/no-img-element -- uploaded R2/OBS images have dynamic URLs */

import { useEffect, useRef, useState } from "react";

export type Artwork = {
  id: number;
  title: string;
  artworkDate: string;
  description: string;
  imageUrl?: string;
  published?: boolean;
};

const PAGE_SIZE = 12;

export function ArtworkVisual({ artwork, index = 0 }: { artwork: Artwork; index?: number }) {
  if (artwork.imageUrl) return <img src={artwork.imageUrl} alt={artwork.title} loading="lazy" />;
  const variants = ["one", "two", "three", "four", "five", "six"];
  return <div className={`art-surface ${variants[index % variants.length]}`} role="img" aria-label={`${artwork.title} placeholder`} />;
}

export function Gallery() {
  const [works, setWorks] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Artwork | null>(null);
  const entranceClicks = useRef({ count: 0, lastClick: 0, opening: false });

  useEffect(() => {
    fetch("/api/artworks?limit=100")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setWorks(data.artworks || []))
      .catch(() => setWorks([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selected]);

  const pages = Math.max(1, Math.ceil(works.length / PAGE_SIZE));
  const visible = works.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function tryAdminEntrance() {
    const now = Date.now();
    const state = entranceClicks.current;
    if (state.opening) return;
    if (now - state.lastClick > 1200) state.count = 0;
    state.lastClick = now;
    state.count += 1;
    if (state.count < 5) return;

    state.count = 0;
    state.opening = true;
    const response = await fetch("/api/auth/entrance", { method: "POST" }).catch(() => null);
    if (response?.ok) window.location.assign("/admin");
    else state.opening = false;
  }

  return (
    <main className="archive-page">
      <div className="site-shell">
        <header className="site-header">
          <a className="wordmark" href="#top">NiboNobu’s Art Archive</a>
        </header>

        <section id="top" aria-label="Artwork archive">
          <div className="art-grid">
            {loading ? Array.from({ length: 4 }, (_, index) => (
              <div className="art-card art-skeleton" key={index} aria-hidden="true">
                <div className="art-image" />
                <span className="skeleton-date" />
              </div>
            )) : visible.map((artwork, index) => (
              <button type="button" className="art-card" key={artwork.id} onClick={() => setSelected(artwork)}>
                <div className="art-image"><ArtworkVisual artwork={artwork} index={index} /></div>
                {artwork.artworkDate && <time className="art-date" dateTime={artwork.artworkDate}>{artwork.artworkDate}</time>}
              </button>
            ))}
            {!loading && works.length === 0 && <p className="gallery-empty">No artwork yet.</p>}
          </div>
          {loading && <span className="sr-only" role="status">Loading artwork</span>}
          {!loading && pages > 1 && <nav className="pagination" aria-label="Gallery pages">
            <button className="page-button" disabled={page === 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">←</button>
            {Array.from({ length: pages }, (_, i) => <button className={`page-button ${page === i + 1 ? "active" : ""}`} key={i} onClick={() => setPage(i + 1)}>{i + 1}</button>)}
            <button className="page-button" disabled={page === pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">→</button>
          </nav>}
        </section>

        <footer className="footer">
          <button className="entrance-trigger" type="button" onClick={tryAdminEntrance}>THANKS FOR STOPPING BY.</button>
        </footer>
      </div>

      {selected && <div className="modal" role="dialog" aria-modal="true" aria-label="Artwork details">
        <button className="modal-backdrop" type="button" onClick={() => setSelected(null)} aria-label="Close artwork view" />
        <div className="modal-inner">
          <button className="modal-close" onClick={() => setSelected(null)} aria-label="Close artwork">×</button>
          <div className="modal-art"><ArtworkVisual artwork={selected} index={Math.abs(selected.id) - 1} /></div>
          <div className="modal-info">
            {selected.artworkDate && <time dateTime={selected.artworkDate}>{selected.artworkDate}</time>}
            {selected.description && <p>{selected.description}</p>}
          </div>
        </div>
      </div>}
    </main>
  );
}
