"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileAudio, FileText, ImageIcon, Loader2, Upload, Wand2, X } from "lucide-react";
import { useAuthConfig } from "@/hooks/useAuthConfig";
import { useInvalidateLibrary } from "@/hooks/useMeeting";
import { api, ApiError, uploadForm } from "@/lib/api";
import { formatMeetingDateTime } from "@/lib/dates";
import type { MeetingDetail, MeetingListItem, Page } from "@/lib/types";
import {
  MEDIA_EXTENSIONS, SAMPLE_TRANSCRIPT, TRANSCRIPT_EXTENSIONS, formatBytes, nowLocalInput, titleFromFilename, validateMediaFile, validateTranscriptFile,
} from "@/lib/upload";
import { cn } from "@/lib/utils";

export type Mode = "file" | "paste";

const isMedia = (name: string) => (MEDIA_EXTENSIONS as readonly string[]).includes(name.slice(name.lastIndexOf(".")).toLowerCase());

const field = "h-9 w-full rounded-md border border-input bg-card px-3 text-[14px] text-foreground outline-none transition-colors placeholder:text-fg4 focus-visible:border-iris";

/** The Uploads page: a notice, one big drop zone, recent uploads, and a floating "Uploading N files" card once something is chosen. */
export function UploadForm({ initialMode = "file" }: { initialMode?: Mode }) {
  const router = useRouter();
  const invalidateLibrary = useInvalidateLibrary();
  const pick = useRef<HTMLInputElement>(null);
  const pickMedia = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [over, setOver] = useState(false);
  const [notice, setNotice] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [transcript, setTranscript] = useState<File | null>(null);
  const [media, setMedia] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [when, setWhen] = useState(() => nowLocalInput());
  const [progress, setProgress] = useState<number | null>(null);

  const canTranscribe = useAuthConfig().data?.can_transcribe ?? false;
  const recent = useQuery({ queryKey: ["meetings", "uploads"], queryFn: () => api.get<Page<MeetingListItem>>("/api/meetings", { source: "upload", limit: 5 }) });

  const transcriptError = transcript ? validateTranscriptFile(transcript) : null;
  const mediaError = media ? validateMediaFile(media) : null;
  const needsTranscript = mode === "file" && !!media && !transcript && !canTranscribe;
  const ready = !transcriptError && !mediaError && !needsTranscript && (mode === "file" ? !!transcript || !!media : text.trim().length > 0);
  const hasSomething = mode === "file" ? !!transcript || !!media : text.trim().length > 0;
  const fileCount = (mode === "file" ? (transcript ? 1 : 0) : 0) + (media ? 1 : 0) || 1;

  const takeTranscript = (file: File | null) => {
    setTranscript(file);
    setPanelOpen(true);
    if (file && !titleTouched) setTitle(titleFromFilename(file.name));
  };
  /** The big drop zone takes either kind: a transcript, or a recording that gets transcribed. */
  const takeAny = (file: File | null) => {
    if (!file) return;
    setMode("file");
    if (isMedia(file.name)) { setMedia(file); setPanelOpen(true); if (!titleTouched && !transcript) setTitle(titleFromFilename(file.name)); } else takeTranscript(file);
  };

  const create = useMutation({
    mutationFn: () => {
      const form = new FormData();
      if (title.trim()) form.set("title", title.trim());
      if (when) form.set("started_at", new Date(when).toISOString());
      if (mode === "file" && transcript) form.set("file", transcript);
      if (mode === "paste") form.set("transcript_text", text);
      if (media) form.set("media", media);
      setProgress(0);
      return uploadForm<MeetingDetail>("/api/meetings", form, setProgress);
    },
    onSuccess: (meeting) => {
      invalidateLibrary();
      toast.success(`“${meeting.title}” is ready`, { description: `${meeting.action_items.length} action item${meeting.action_items.length === 1 ? "" : "s"} found` });
      router.push(`/meetings/${meeting.id}`);
    },
    onError: (e) => {
      setProgress(null);
      toast.error(e instanceof ApiError ? e.message : "The upload failed. Please try again.");
    },
  });

  const sending = create.isPending;
  const uploading = sending && progress !== null && progress < 1;
  const serverError = create.error instanceof ApiError ? create.error.message : null;
  const submit = () => { if (ready && !sending) create.mutate(); };

  return (
    <div className="mx-auto w-full max-w-[994px] px-4 pb-24 pt-[22px] lg:px-0">
      {notice && (
        <div className="relative flex h-10 items-center justify-center rounded-lg bg-amber-500/15 px-10 text-[14px] text-foreground">
          <span><span className="font-medium">Add a meeting</span> — it shows up on the Meetings page as soon as it is processed.</span>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice(false)} className="absolute right-3 top-1/2 grid size-6 -translate-y-1/2 place-items-center text-muted-foreground hover:text-foreground"><X className="size-4" strokeWidth={1.5} /></button>
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; takeAny(f ?? null); }}
        className={cn("mt-[47px] flex h-[262px] flex-col items-center justify-center rounded border border-dashed px-6 text-center transition-colors", over ? "border-iris bg-iris-chip" : "border-[#4d41c9]")}
        aria-label="Add a meeting"
      >
        {mode === "file" ? (
          <>
            <Upload className="size-7 text-muted-foreground" strokeWidth={1.4} />
            <p className="mt-3.5 text-[15px] font-medium text-foreground">{transcript?.name ?? media?.name ?? "Upload a file to generate a transcript"}</p>
            <p className="mt-2 max-w-[560px] text-[12px] text-fg3">Browse or drag and drop MP3, M4A, WAV, AAC, OGG, OPUS, FLAC, MP4, MOV, WEBM, MKV or AVI recordings (max 25 MB to transcribe), or a .txt, .vtt, .srt or .json transcript.</p>
            <button type="button" onClick={() => pick.current?.click()} className="mt-5 h-9 rounded-md bg-primary px-4 text-[14px] text-white transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/60">Browse Files</button>
            <button type="button" onClick={() => setMode("paste")} className="mt-3 text-[13px] text-fg3 underline-offset-4 hover:text-foreground hover:underline">or paste the text</button>
            <input ref={pick} type="file" accept={`audio/*,video/*,${[...MEDIA_EXTENSIONS, ...TRANSCRIPT_EXTENSIONS].join(",")}`} hidden aria-label="Choose a recording or transcript" onChange={(e) => { takeAny(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          </>
        ) : (
          <div className="flex h-full w-full flex-col py-5 text-left">
            <div className="mb-2 flex items-center justify-between text-[14px]">
              <label htmlFor="paste-text" className="text-fg2">Paste a transcript</label>
              <span className="flex items-center gap-4 text-[13px] text-fg3">
                <button type="button" onClick={() => { setText(SAMPLE_TRANSCRIPT); if (!titleTouched) setTitle("Launch date planning"); setPanelOpen(true); }} className="inline-flex items-center gap-1.5 hover:text-foreground"><Wand2 className="size-3.5" /> Use an example</button>
                <button type="button" onClick={() => setMode("file")} className="hover:text-foreground">Upload a file instead</button>
              </span>
            </div>
            <textarea
              id="paste-text" value={text} onChange={(e) => { setText(e.target.value); setPanelOpen(true); }} spellCheck={false} disabled={sending}
              placeholder={"[00:00:05] Alice: Let's start with the roadmap.\n[00:00:12] Bob: I'll send the draft tomorrow."}
              className="min-h-0 w-full flex-1 resize-none rounded-md border border-input bg-card p-3 font-mono text-[13px] leading-6 outline-none placeholder:text-fg4 focus-visible:border-iris"
            />
          </div>
        )}
      </div>
      {transcriptError && <p role="alert" className="mt-2 text-[13px] text-destructive">{transcriptError}</p>}

      <section className="mt-12" aria-label="Recent uploads">
        {recent.data && recent.data.items.length > 0 ? (
          <>
            <h2 className="mb-3 text-[14px] text-muted-foreground">Recent uploads</h2>
            <ul className="space-y-3">
              {recent.data.items.map((m) => (
                <li key={m.id}>
                  <Link href={`/meetings/${m.id}`} className="flex items-center gap-4 rounded-xl border border-border px-5 py-3.5 transition-colors hover:bg-surface/60">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand text-[16px] text-white">{m.title.charAt(0).toUpperCase()}</span>
                    <span className="min-w-0"><span className="block truncate text-[14px] text-foreground">{m.title}</span><span className="block text-[13px] text-fg3">{formatMeetingDateTime(m.started_at)}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="flex flex-col items-center pt-8 text-center">
            <span className="grid size-[50px] place-items-center rounded-md bg-[#e9e9ee]/90 text-fg3"><ImageIcon className="size-7" strokeWidth={1.3} /></span>
            <p className="mt-6 text-[18px] font-medium text-foreground">You have no recent uploads!</p>
          </div>
        )}
      </section>

      {hasSomething && panelOpen && (
        <form
          onSubmit={(e) => { e.preventDefault(); submit(); }} aria-label="Uploading"
          className="fixed bottom-6 right-6 z-40 w-[min(92vw,376px)] rounded-xl border border-border bg-surface shadow-2xl"
        >
          <div className="flex h-[54px] items-center justify-between border-b border-border px-5">
            <p className="text-[15px] text-foreground">Uploading {fileCount} File{fileCount === 1 ? "" : "s"}</p>
            <button type="button" aria-label="Close" onClick={() => setPanelOpen(false)} className="grid size-6 place-items-center text-muted-foreground hover:text-foreground"><X className="size-4" strokeWidth={1.5} /></button>
          </div>
          <div className="space-y-4 p-5">
            {(transcript || mode === "paste") && (
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#3b74e6] text-white"><FileText className="size-4" strokeWidth={1.6} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] text-foreground">{transcript ? transcript.name : "Pasted transcript"}</p>
                  <p className="text-[12px] text-fg3">{transcript ? formatBytes(transcript.size) : `${text.trim().length.toLocaleString()} characters`}</p>
                </div>
              </div>
            )}
            {mode === "file" && media && !transcript && (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#3b74e6] text-white"><FileAudio className="size-4" strokeWidth={1.6} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] text-foreground">{media.name}</p>
                    <p className="text-[12px] text-fg3">{formatBytes(media.size)}</p>
                  </div>
                  <button type="button" aria-label={`Remove ${media.name}`} onClick={() => setMedia(null)} className="text-muted-foreground hover:text-foreground"><X className="size-4" strokeWidth={1.5} /></button>
                </div>
                <p className={cn("rounded-md px-3 py-2 text-[12px] leading-5", canTranscribe ? "bg-muted/60 text-fg3" : "bg-destructive/10 text-destructive")} role={canTranscribe ? undefined : "alert"}>
                  {canTranscribe ? "This recording will be transcribed automatically. Speakers aren't told apart, so every line is labelled Speaker." : "Transcribing a recording needs a speech-to-text provider on the server. Add a transcript file with it, or set one up (see the README)."}
                </p>
                <button type="button" onClick={() => pick.current?.click()} className="text-[12px] text-fg3 underline underline-offset-4 hover:text-foreground">Add a transcript too</button>
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="meeting-title" className="text-[13px] text-muted-foreground">Title (optional)</label>
              <input id="meeting-title" className={field} value={title} maxLength={255} disabled={sending} placeholder="Untitled meeting" onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="meeting-when" className="text-[13px] text-muted-foreground">When it happened</label>
              <input id="meeting-when" type="datetime-local" className={field} value={when} disabled={sending} onChange={(e) => setWhen(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              {!(mode === "file" && media && !transcript) && (
                <>
              <p className="text-[13px] text-muted-foreground">Recording (optional)</p>
              {media ? (
                <div className="flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-[13px]">
                  <FileAudio className="size-4 shrink-0 text-iris-soft" strokeWidth={1.5} />
                  <span className="min-w-0 flex-1 truncate">{media.name} <span className="text-fg3">· {formatBytes(media.size)}</span></span>
                  <button type="button" aria-label={`Remove ${media.name}`} onClick={() => setMedia(null)} className="text-muted-foreground hover:text-foreground"><X className="size-4" strokeWidth={1.5} /></button>
                </div>
              ) : (
                <button type="button" onClick={() => pickMedia.current?.click()} className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-dashed border-input text-[13px] text-muted-foreground transition-colors hover:text-foreground"><Upload className="size-4" strokeWidth={1.5} /> Attach audio or video</button>
              )}
                </>
              )}
              <input ref={pickMedia} type="file" accept={`audio/*,video/*,${MEDIA_EXTENSIONS.join(",")}`} hidden aria-label="Choose a recording" onChange={(e) => { setMedia(e.target.files?.[0] ?? null); e.target.value = ""; }} />
              {mediaError && <p role="alert" className="text-[12px] text-destructive">{mediaError}</p>}
            </div>
            {serverError && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-[13px] text-destructive">{serverError}</p>}
            {sending && (
              <div className="h-1 overflow-hidden rounded-full bg-accent" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((progress ?? 0) * 100)} aria-label="Upload progress">
                <div className={cn("h-full bg-primary transition-[width]", !uploading && "animate-pulse")} style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
              </div>
            )}
          </div>
          <div className="flex justify-end px-5 pb-5">
            <button type="submit" disabled={!ready || sending} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-[14px] text-white transition-colors hover:bg-primary/90 disabled:opacity-60">
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" strokeWidth={1.5} />}
              {uploading ? `Uploading ${Math.round((progress ?? 0) * 100)}%` : sending ? "Processing…" : "Upload"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
