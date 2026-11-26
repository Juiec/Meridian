"use client";

import {
  ArrowDownToLine,
  ImagePlus,
  LoaderCircle,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";

import { readJson } from "@/components/client-api";
import { useAppState } from "@/components/app-state";
import { SidebarToggle } from "@/components/sidebar";
import { useOpenSidebar } from "@/components/shell-context";
import { batchFileStamp, batchImageBaseName } from "@/lib/image-names";
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

const MAX_INPUT_IMAGES = 16;
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

type ReferenceImage = {
  id: string;
  file: File;
  preview: string;
};

type GeneratedImage = {
  b64_json?: string;
  url?: string;
  revised_prompt?: string;
  fileName?: string | null;
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
  const openSidebar = useOpenSidebar();
  const { settings } = useAppState();
  const fileInput = useRef<HTMLInputElement>(null);
  const referenceInput = useRef<HTMLInputElement>(null);
  const previewUrl = useRef<string | null>(null);
  const referenceUrls = useRef<string[]>([]);
  const referenceSeq = useRef(0);
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [count, setCount] = useState(1);
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [endpointId, setEndpointId] = useState("");
  const [imageDefaultId, setImageDefaultId] = useState("");
  const [modelDraft, setModelDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [batchStamp, setBatchStamp] = useState("");
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
    for (const url of referenceUrls.current) URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await readJson<{ endpointId: string; model: string; error?: string }>(await fetch("/api/image-settings"));
        if (cancelled) return;
        if (data.endpointId) {
          setEndpointId(data.endpointId);
          setImageDefaultId(data.endpointId);
        }
        if (data.model) setModelDraft(data.model);
        if (data.error) setError(data.error);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the image endpoint.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const endpoints = settings?.endpoints ?? [];
  const selectedEndpoint = endpoints.find((endpoint) => endpoint.id === endpointId);
  const imageModels = selectedEndpoint
    ? [...new Set([selectedEndpoint.model, ...selectedEndpoint.models].map((model) => model.trim()).filter(Boolean))]
    : [];
  const model = imageModels.includes(modelDraft) ? modelDraft : selectedEndpoint?.model || imageModels[0] || "";

  async function rememberImageDefault(nextEndpointId: string, nextModel: string) {
    try {
      const data = await readJson<{ endpointId: string; model: string }>(
        await fetch("/api/image-settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpointId: nextEndpointId, model: nextModel }),
        }),
      );
      setImageDefaultId(data.endpointId);
      setModelDraft(data.model);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the image default.");
    }
  }

  function imageProblem(file: File): string | null {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return "Use a PNG, JPEG, or WebP image.";
    if (file.size > MAX_UPLOAD_BYTES) return "Each image must be 20 MB or smaller.";
    return null;
  }

  function selectEditImage(file: File | null) {
    if (file) {
      const problem = imageProblem(file);
      if (problem) {
        setError(problem);
        return;
      }
      if (references.length >= MAX_INPUT_IMAGES) {
        setError("Remove a reference image first. One request holds 16 pictures.");
        return;
      }
    }
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = file ? URL.createObjectURL(file) : null;
    setEditImage(file);
    setEditPreview(previewUrl.current);
    if (file) setError(null);
  }

  function addReferences(list: FileList | null) {
    if (!list || list.length === 0) return;
    const room = MAX_INPUT_IMAGES - (editImage ? 1 : 0) - references.length;
    if (room <= 0) {
      setError("One request holds 16 pictures. Remove one before adding another.");
      return;
    }
    const accepted: ReferenceImage[] = [];
    let problem: string | null = null;
    for (const file of Array.from(list)) {
      if (accepted.length >= room) {
        problem = "One request holds 16 pictures. The extra files were left out.";
        break;
      }
      const invalid = imageProblem(file);
      if (invalid) {
        problem = invalid;
        continue;
      }
      const preview = URL.createObjectURL(file);
      referenceUrls.current.push(preview);
      referenceSeq.current += 1;
      accepted.push({ id: `ref-${referenceSeq.current}`, file, preview });
    }
    if (accepted.length > 0) setReferences((current) => [...current, ...accepted]);
    setError(problem);
  }

  function removeReference(id: string) {
    setReferences((current) => {
      const target = current.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.preview);
        referenceUrls.current = referenceUrls.current.filter((url) => url !== target.preview);
      }
      return current.filter((item) => item.id !== id);
    });
  }

  function clearReferences() {
    for (const item of references) URL.revokeObjectURL(item.preview);
    referenceUrls.current = [];
    setReferences([]);
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
    if (editImage || references.length > 0) {
      const form = new FormData();
      form.set("endpointId", selectedEndpoint.id);
      form.set("model", model);
      form.set("prompt", prompt.trim());
      form.set("size", selectedSize);
      form.set("n", String(count));
      if (editImage) form.set("image", editImage, editImage.name);
      for (const item of references) form.append("reference", item.file, item.file.name);
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
      setBatchStamp(batchFileStamp());
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
  const referenceLimit = MAX_INPUT_IMAGES - (editImage ? 1 : 0);
  const noun = count === 1 ? "image" : `${count} images`;
  const actionLabel = editImage && references.length
    ? `Edit ${noun} with references`
    : editImage
      ? `Edit ${noun}`
      : references.length
        ? `Generate ${noun} from references`
        : `Generate ${noun}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-6">
        <SidebarToggle onOpen={openSidebar} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xl leading-none">Image Studio</p>
        </div>
        <Link href="/settings" className="shrink-0 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Manage endpoints
        </Link>
      </header>

      <div className="@container/studio min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid min-h-full max-w-[1600px] grid-cols-1 @min-[760px]/studio:grid-cols-[minmax(19rem,24rem)_minmax(0,1fr)]">
          <section aria-label="Image settings" className="border-b border-border p-5 md:p-7 @min-[760px]/studio:border-r @min-[760px]/studio:border-b-0">
                <label htmlFor="image-prompt-v3" className="mb-2 block text-sm font-medium">Prompt</label>
                <Textarea id="image-prompt-v3" value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} maxLength={32_000} placeholder="Describe the picture." className="min-h-28 resize-y rounded-xl border-border bg-card p-3 leading-6 shadow-none" />
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <label className="block text-sm font-medium">Canvas size<select value={size} onChange={(event) => setSize(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-input bg-card px-2.5 text-sm font-normal outline-none">{IMAGE_SIZES.map((item) => <option key={item.value} value={item.value}>{item.label} · {item.dimensions}</option>)}</select></label>
                  <label className="block text-sm font-medium">Batch<select value={count} onChange={(event) => setCount(Number(event.target.value))} className="mt-2 h-10 w-full rounded-lg border border-input bg-card px-2.5 text-sm font-normal outline-none">{[1, 2, 3, 4, 5, 6, 8, 10].map((amount) => <option key={amount} value={amount}>{amount} image{amount === 1 ? "" : "s"}</option>)}</select></label>
                </div>
                {size === "custom" ? (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="text-xs text-muted-foreground">Width<Input type="number" min={256} max={4096} step={16} value={width} onChange={(event) => setWidth(Number(event.target.value))} className="mt-1.5 h-9 bg-card" /></label>
                    <label className="text-xs text-muted-foreground">Height<Input type="number" min={256} max={4096} step={16} value={height} onChange={(event) => setHeight(Number(event.target.value))} className="mt-1.5 h-9 bg-card" /></label>
                  </div>
                ) : null}
                <div className="mt-4">
                  <label htmlFor="edit-image-v3" className="text-sm font-medium">Picture to change</label>
                  <input id="edit-image-v3" ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { selectEditImage(event.target.files?.[0] ?? null); event.target.value = ""; }} />
                  <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className="mt-2 flex min-h-14 w-full items-center gap-3 rounded-xl border border-dashed border-copper/40 p-2 text-left hover:border-copper disabled:opacity-50">
                    {editImage && editPreview ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={editPreview} alt="" className="studio-edit-preview shrink-0 rounded-lg object-cover" />
                        <span className="min-w-0 truncate text-sm">{editImage.name}</span>
                      </>
                    ) : (
                      <span className="flex items-center gap-3 px-1 text-sm"><ImagePlus className="size-4 text-copper" />Choose the picture to change</span>
                    )}
                  </button>
                </div>
                <div className="mt-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-medium">Pictures to look at</h2>
                    <span className="text-xs text-muted-foreground">{references.length} of {referenceLimit}</span>
                  </div>
                  <div>
                    <input id="reference-images-v3" ref={referenceInput} type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={(event) => { addReferences(event.target.files); event.target.value = ""; }} />
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <button type="button" disabled={busy} onClick={() => referenceInput.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-sage/50 px-3 py-2 text-sm text-sage hover:bg-sage/10 disabled:opacity-50"><Plus className="size-4" /> Add pictures</button>
                      {references.length > 0 ? <button type="button" disabled={busy} onClick={clearReferences} className="text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50">Clear</button> : null}
                    </div>
                    {references.length > 0 ? (
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {references.map((item) => (
                          <li key={item.id} className="relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.preview} alt={`Reference: ${item.file.name}`} className="size-16 rounded-lg object-cover" />
                            <button type="button" disabled={busy} onClick={() => removeReference(item.id)} aria-label={`Remove reference ${item.file.name}`} className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full border border-border bg-background disabled:opacity-50"><X className="size-3" /></button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
                <div className="mt-6 space-y-3">
                  <label className="block text-sm font-medium">Generation endpoint<select aria-label="Image generation endpoint" className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm font-normal outline-none" value={selectedEndpoint?.id ?? ""} disabled={endpoints.length === 0} onChange={(event) => { const next = endpoints.find((item) => item.id === event.target.value); const nextModel = next?.model ?? next?.models[0] ?? ""; setEndpointId(event.target.value); setModelDraft(nextModel); setError(null); void rememberImageDefault(event.target.value, nextModel); }}>{endpoints.map((endpoint) => <option key={endpoint.id} value={endpoint.id}>{endpoint.name}{endpoint.id === imageDefaultId ? " · image default" : ""}</option>)}</select></label>
                  <label className="block text-sm font-medium">Image model{imageModels.length > 0 ? <select aria-label="Image model" className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm font-normal outline-none" value={model} onChange={(event) => { setModelDraft(event.target.value); if (selectedEndpoint) void rememberImageDefault(selectedEndpoint.id, event.target.value); }}>{imageModels.map((imageModel) => <option key={imageModel} value={imageModel}>{imageModel}</option>)}</select> : <p className="mt-2 text-sm text-muted-foreground">No model saved for this endpoint. Add one in Settings.</p>}</label>
                </div>
                {error ? <p role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}
                {status ? <p role="status" className="mt-4 text-sm text-sage">{status}</p> : null}
                <Button type="button" size="lg" className="mt-5 h-11 w-full rounded-xl" disabled={busy || !selectedEndpoint || !selectedEndpoint.baseUrl || !model || !prompt.trim()} onClick={() => void generate()}>{busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}{busy ? "Making your image…" : actionLabel}</Button>
          </section>

          <section aria-label="Image results" className="flex min-h-[32rem] flex-col p-5 md:p-8 @min-[760px]/studio:min-h-0">
            {images.length > 0 ? (
              <>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-2xl leading-none">Results</h2>
                <p className="text-xs text-muted-foreground">{sizeValue}</p>
              </div>
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {images.map((image, index) => {
                  const source = image.b64_json ? `data:image/png;base64,${image.b64_json}` : image.url!;
                  return (
                    <article key={`${index}-${source.slice(0, 40)}`} className="group relative overflow-hidden rounded-xl border border-border bg-card">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={source} alt={image.revised_prompt || `Generated image ${index + 1}`} className="aspect-square w-full object-contain" />
                      <a
                        href={source}
                        download={image.fileName || `${batchImageBaseName(batchStamp || batchFileStamp(), index)}.png`}
                        className="absolute right-2 bottom-2 inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background text-foreground opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                        aria-label={`Download image ${index + 1}`}
                      >
                        <ArrowDownToLine className="size-4" />
                      </a>
                    </article>
                  );
                })}
              </div>
              </>
            ) : null}

            <div className={images.length > 0 ? "mt-10 border-t border-border pt-6" : ""}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-xl">Saved images</h3>
                <button
                  type="button"
                  onClick={() => void loadHistory()}
                  className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Refresh
                </button>
              </div>
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
                        <p className="truncate text-xs text-muted-foreground">
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
