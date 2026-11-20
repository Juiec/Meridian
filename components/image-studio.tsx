"use client";

import {
  ArrowDownToLine,
  ImagePlus,
  LoaderCircle,
  Paintbrush,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";

import { readJson } from "@/components/client-api";
import { useAppState } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";

const IMAGE_SIZES = [
  { value: "1024x1024", label: "Square", dimensions: "1024 × 1024" },
  { value: "1536x1024", label: "Landscape", dimensions: "1536 × 1024" },
  { value: "1024x1536", label: "Portrait", dimensions: "1024 × 1536" },
  { value: "auto", label: "Auto", dimensions: "Let the model decide" },
  { value: "custom", label: "Custom", dimensions: "Choose your own dimensions" },
] as const;

type GeneratedImage = {
  b64_json?: string;
  url?: string;
  revised_prompt?: string;
};

type StoredImage = {
  id: string;
  url: string;
  prompt: string;
  model: string;
  sessionTitle: string | null;
  mediaType: string;
  createdAt: number;
};

async function fetchSavedImages(): Promise<StoredImage[]> {
  const data = await readJson<{ images: StoredImage[] }>(
    await fetch("/api/images?limit=24", { cache: "no-store" }),
  );
  return data.images ?? [];
}

export function ImageStudio() {
  const { settings } = useAppState();
  const fileInput = useRef<HTMLInputElement>(null);
  const previewUrl = useRef<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [count, setCount] = useState(1);
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const [endpointId, setEndpointId] = useState("");
  const [modelDraft, setModelDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [savedImages, setSavedImages] = useState<StoredImage[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      setSavedImages(await fetchSavedImages());
      setHistoryError(null);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Could not load saved images.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await fetchSavedImages();
        if (cancelled) return;
        setSavedImages(loaded);
        setHistoryError(null);
      } catch (err) {
        if (cancelled) return;
        setHistoryError(err instanceof Error ? err.message : "Could not load saved images.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);

  const endpoints = settings?.endpoints ?? [];
  const selectedEndpoint =
    endpoints.find((endpoint) => endpoint.id === endpointId) ??
    endpoints.find((endpoint) => endpoint.id === settings?.endpointId) ??
    endpoints[0];
  const imageModels = selectedEndpoint
    ? [...new Set([selectedEndpoint.model, ...selectedEndpoint.models].map((model) => model.trim()).filter(Boolean))]
    : [];
  const model = imageModels.includes(modelDraft) ? modelDraft : selectedEndpoint?.model || imageModels[0] || "";

  function selectEditImage(file: File | null) {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = file ? URL.createObjectURL(file) : null;
    setEditImage(file);
    setEditPreview(previewUrl.current);
  }

  async function generate() {
    if (!selectedEndpoint) {
      setError("Add an endpoint in Settings before generating images.");
      return;
    }
    if (!selectedEndpoint.baseUrl) {
      setError(`Add a base URL for ${selectedEndpoint.name} in Settings first.`);
      return;
    }
    if (!model) {
      setError("Choose an image model for this endpoint.");
      return;
    }
    if (!prompt.trim()) {
      setError("Write a prompt before generating.");
      return;
    }

    setBusy(true);
    setError(null);
    setStatus(null);
    setImages([]);

    const selectedSize = size === "custom" ? `${width}x${height}` : size;
    const headers = new Headers();
    let body: BodyInit;
    if (editImage) {
      const form = new FormData();
      form.set("endpointId", selectedEndpoint.id);
      form.set("model", model);
      form.set("prompt", prompt.trim());
      form.set("size", selectedSize);
      form.set("n", String(count));
      form.set("image", editImage, editImage.name);
      body = form;
    } else {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify({ endpointId: selectedEndpoint.id, model, prompt: prompt.trim(), size: selectedSize, n: count });
    }

    try {
      const result = await readJson<{ data?: GeneratedImage[] }>(
        await fetch("/api/images", {
          method: "POST",
          headers,
          body,
          credentials: "omit",
          cache: "no-store",
        }),
      );
      const received = result.data?.filter((image) => image.b64_json || image.url) ?? [];
      if (received.length === 0) throw new Error("OpenAI returned no images.");
      setImages(received);
      setStatus(`${received.length} image${received.length === 1 ? "" : "s"} ready. Saved to the backend image log.`);
      void loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image generation failed.");
    } finally {
      setBusy(false);
    }
  }

  const sizeValue = size === "custom" ? `${width} × ${height}` : IMAGE_SIZES.find((item) => item.value === size)?.dimensions;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-6">
        <div className="min-w-0">
          <p className="font-display text-2xl leading-none">Image Studio</p>
          <p className="mt-1 text-xs text-muted-foreground">Choose a saved endpoint and image model.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link href="/" className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Chats
          </Link>
          <Link href="/settings" className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Manage endpoints
          </Link>
        </div>
      </header>

      <div className="@container/studio min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid min-h-full max-w-[1600px] grid-cols-1 @min-[760px]/studio:grid-cols-[minmax(19rem,24rem)_minmax(0,1fr)]">
          <section aria-label="Image settings" className="border-b border-border p-5 md:p-7 @min-[760px]/studio:border-r @min-[760px]/studio:border-b-0">
            <div className="mb-6">
              <p className="text-[10px] tracking-[0.2em] text-copper uppercase">Prompt desk</p>
              <h1 className="mt-2 font-display text-3xl leading-tight">What do you see?</h1>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Describe the image in your head. The more specific the details, the closer the first frame.
              </p>
            </div>

            <label htmlFor="image-prompt" className="mb-2 block text-sm font-medium">Your prompt</label>
            <Textarea
              id="image-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={5}
              maxLength={32_000}
              placeholder="A tiny greenhouse on the moon, its glass glowing at blue hour…"
              className="min-h-36 resize-y rounded-xl border-border bg-card/70 p-3 leading-6 shadow-none"
            />
            <p className="mt-1.5 text-right font-mono text-[10px] text-muted-foreground">{prompt.length.toLocaleString()} / 32,000</p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">
                Canvas size
                <select
                  value={size}
                  onChange={(event) => setSize(event.target.value)}
                  className="mt-2 h-10 w-full rounded-lg border border-input bg-card px-2.5 text-sm font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {IMAGE_SIZES.map((item) => <option key={item.value} value={item.value}>{item.label} · {item.dimensions}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Batch
                <select
                  value={count}
                  onChange={(event) => setCount(Number(event.target.value))}
                  className="mt-2 h-10 w-full rounded-lg border border-input bg-card px-2.5 text-sm font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {[1, 2, 3, 4, 5, 6, 8, 10].map((amount) => (
                    <option key={amount} value={amount}>{amount} image{amount === 1 ? "" : "s"}</option>
                  ))}
                </select>
              </label>
            </div>

            {size === "custom" ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="text-xs text-muted-foreground">
                  Width
                  <Input type="number" min={256} max={4096} step={16} value={width} onChange={(event) => setWidth(Number(event.target.value))} className="mt-1.5 h-9 bg-card" />
                </label>
                <label className="text-xs text-muted-foreground">
                  Height
                  <Input type="number" min={256} max={4096} step={16} value={height} onChange={(event) => setHeight(Number(event.target.value))} className="mt-1.5 h-9 bg-card" />
                </label>
                <p className="col-span-2 text-[11px] leading-5 text-muted-foreground">Use dimensions from 256–4096 px in steps of 16.</p>
              </div>
            ) : null}

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="edit-image" className="text-sm font-medium">Edit an image <span className="font-normal text-muted-foreground">· optional</span></label>
                {editImage ? (
                  <button type="button" className="inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => selectEditImage(null)}>
                    <X className="size-3" /> Remove
                  </button>
                ) : null}
              </div>
              <input
                id="edit-image"
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(event) => selectEditImage(event.target.files?.[0] ?? null)}
              />
              {editImage && editPreview ? (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={editPreview} alt={`Preview of ${editImage.name}`} className="size-12 rounded-lg object-cover" />
                  <div className="min-w-0">
                    <p className="truncate text-sm">{editImage.name}</p>
                    <p className="text-xs text-muted-foreground">{(editImage.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="flex min-h-20 w-full items-center gap-3 rounded-xl border border-dashed border-border bg-card/40 px-3 text-left transition-colors hover:border-copper/70 hover:bg-card"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-copper"><ImagePlus className="size-4" /></span>
                  <span>
                    <span className="block text-sm">Choose an image to edit</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">PNG, JPEG or WebP · up to 20 MB</span>
                  </span>
                </button>
              )}
            </div>

            <div className="mt-6 space-y-3 rounded-xl border border-border bg-muted/40 p-3.5">
              <label className="block text-sm font-medium">
                Generation endpoint
                <select
                  aria-label="Image generation endpoint"
                  className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={selectedEndpoint?.id ?? ""}
                  disabled={endpoints.length === 0}
                  onChange={(event) => {
                    const next = endpoints.find((item) => item.id === event.target.value);
                    setEndpointId(event.target.value);
                    setModelDraft(next?.model ?? next?.models[0] ?? "");
                    setError(null);
                  }}
                >
                  {endpoints.map((endpoint) => (
                    <option key={endpoint.id} value={endpoint.id}>
                      {endpoint.name}{endpoint.id === settings?.endpointId ? " · default" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Image model
                {imageModels.length > 0 ? (
                  <select
                    aria-label="Image model"
                    className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={model}
                    onChange={(event) => setModelDraft(event.target.value)}
                  >
                    {imageModels.map((imageModel) => <option key={imageModel} value={imageModel}>{imageModel}</option>)}
                  </select>
                ) : (
                  <p className="mt-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal text-muted-foreground">
                    No model saved for this endpoint. Add one in Settings.
                  </p>
                )}
              </label>
              {selectedEndpoint ? (
                <p className="text-[11px] leading-5 text-muted-foreground">
                  {selectedEndpoint.apiKeySet
                    ? `Uses the saved endpoint key (${selectedEndpoint.apiKeyHint ?? "hidden"}).`
                    : "No key is saved for this endpoint; use it only if the service does not require one."}{" "}
                  The key stays on this machine and is never sent to the browser.
                </p>
              ) : (
                <p className="text-[11px] leading-5 text-muted-foreground">
                  Add and configure an endpoint in Settings before generating images.
                </p>
              )}
              <p className="text-[11px] leading-5 text-muted-foreground">
                Choose an endpoint that supports the OpenAI-compatible Images API and the selected image model.
              </p>
            </div>

            {error ? <p role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}
            {status ? <p role="status" className="mt-4 text-sm text-sage">{status}</p> : null}

            <Button type="button" size="lg" className="mt-5 h-11 w-full rounded-xl" disabled={busy || !selectedEndpoint || !selectedEndpoint.baseUrl || !model || !prompt.trim()} onClick={() => void generate()}>
              {busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
              {busy ? "Making your image…" : `Generate ${count === 1 ? "image" : `${count} images`}`}
            </Button>
          </section>

          <section aria-label="Image results" className="flex min-h-[32rem] flex-col p-5 md:p-8 @min-[760px]/studio:min-h-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">The canvas</p>
                <h2 className="mt-1 font-display text-2xl leading-none">{images.length ? "Fresh from the studio" : "Room for an idea"}</h2>
              </div>
              <p className="font-mono text-[10px] tracking-wider text-muted-foreground">{sizeValue}</p>
            </div>

            {images.length > 0 ? (
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {images.map((image, index) => {
                  const source = image.b64_json ? `data:image/png;base64,${image.b64_json}` : image.url!;
                  return (
                    <article key={`${index}-${source.slice(0, 40)}`} className="group relative overflow-hidden rounded-xl border border-border bg-card">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={source} alt={image.revised_prompt || `Generated image ${index + 1}`} className="aspect-square w-full object-contain" />
                      <a
                        href={source}
                        download={`meridian-image-${index + 1}.png`}
                        className="absolute right-2 bottom-2 inline-flex size-9 items-center justify-center rounded-lg border border-white/20 bg-black/70 text-white opacity-100 backdrop-blur transition-opacity sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                        aria-label={`Download image ${index + 1}`}
                      >
                        <ArrowDownToLine className="size-4" />
                      </a>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="relative mt-6 flex min-h-80 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-border bg-[#17191b] p-5">
                <div aria-hidden className="absolute inset-0 opacity-80">
                  <svg viewBox="0 0 960 720" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
                    <defs>
                      <linearGradient id="studio-sky" x1="0" x2="1" y1="0" y2="1">
                        <stop stopColor="#283a43" />
                        <stop offset=".58" stopColor="#855d53" />
                        <stop offset="1" stopColor="#e4a77b" />
                      </linearGradient>
                      <radialGradient id="studio-light">
                        <stop stopColor="#f8d7a5" stopOpacity=".95" />
                        <stop offset="1" stopColor="#f8d7a5" stopOpacity="0" />
                      </radialGradient>
                    </defs>
                    <rect width="960" height="720" fill="#17191b" />
                    <rect x="95" y="58" width="770" height="560" rx="8" fill="url(#studio-sky)" />
                    <circle cx="658" cy="298" r="205" fill="url(#studio-light)" />
                    <circle cx="658" cy="298" r="56" fill="#f3d09d" />
                    <path d="M95 435 285 260l166 163 139-119 275 219v95H95Z" fill="#5c5b54" />
                    <path d="m95 520 227-155 173 121 130-83 240 182v33H95Z" fill="#35464a" />
                    <path d="M95 560 298 465l180 104 177-94 210 89v54H95Z" fill="#242d30" />
                    <path d="M170 112h620M170 572h620M170 112v460M790 112v460" stroke="#f4ead7" strokeOpacity=".17" strokeWidth="2" />
                    <circle cx="213" cy="196" r="3" fill="#f3d09d" />
                    <circle cx="744" cy="183" r="2" fill="#f3d09d" />
                    <circle cx="275" cy="298" r="2" fill="#f3d09d" />
                  </svg>
                </div>
                <div className="relative z-10 max-w-sm rounded-2xl border border-white/15 bg-[#151719]/75 px-6 py-5 text-center text-white backdrop-blur-sm">
                  <div className="mx-auto flex size-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-[#e8b78d]"><Paintbrush className="size-4" /></div>
                  <p className="mt-3 font-display text-2xl">A frame waiting for you.</p>
                  <p className="mt-2 text-sm leading-6 text-white/65">
                    Start with a prompt, or bring a picture to reimagine. Your results will land here.
                  </p>
                </div>
                <div className="absolute bottom-4 left-4 font-mono text-[9px] tracking-[0.16em] text-white/50 uppercase">Meridian · Studio canvas</div>
                <div className="absolute right-4 bottom-4 font-mono text-[9px] tracking-[0.16em] text-white/50 uppercase">01 / awaiting input</div>
              </div>
            )}

            <div className="mt-10 border-t border-border pt-6">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Backend log</p>
                  <h3 className="mt-1 font-display text-xl">Saved images</h3>
                </div>
                <button
                  type="button"
                  onClick={() => void loadHistory()}
                  className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Refresh
                </button>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Stored with prompt, model, and chat — like the message log. Images from /image in chat land here too.
              </p>
              {historyError ? (
                <p role="alert" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {historyError}
                </p>
              ) : null}
              {savedImages.length > 0 ? (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
                  {savedImages.map((image) => (
                    <article key={image.id} className="overflow-hidden rounded-xl border border-border bg-card">
                      <a href={image.url} target="_blank" rel="noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.url}
                          alt={image.prompt}
                          loading="lazy"
                          className="aspect-square w-full object-contain"
                        />
                      </a>
                      <div className="space-y-1 px-2.5 py-2">
                        <p className="line-clamp-2 text-xs leading-4" title={image.prompt}>{image.prompt}</p>
                        <p className="truncate font-mono text-[10px] text-muted-foreground">
                          {image.sessionTitle || "Studio"} · {image.model.slice(0, 28)}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  No saved images yet. Generate one here, or type <span className="font-mono text-foreground">/image</span> in a chat.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
