import { describe, expect, it } from "vitest";
import {
  MAX_MEDIA_BYTES, MAX_TRANSCRIPT_BYTES, formatBytes, nowLocalInput, titleFromFilename, validateMediaFile, validateTranscriptFile,
} from "./upload";

describe("validateTranscriptFile", () => {
  it("accepts supported formats in any case", () => {
    for (const name of ["a.txt", "A.VTT", "talk.srt", "data.json"]) expect(validateTranscriptFile({ name, size: 100 })).toBeNull();
  });
  it("rejects other types, empty files and oversized files with a useful message", () => {
    expect(validateTranscriptFile({ name: "deck.pdf", size: 100 })).toMatch(/Unsupported file type '.pdf'/);
    expect(validateTranscriptFile({ name: "noextension", size: 100 })).toMatch(/Unsupported file type 'noextension'/);
    expect(validateTranscriptFile({ name: "a.txt", size: 0 })).toBe("That file is empty.");
    expect(validateTranscriptFile({ name: "a.txt", size: MAX_TRANSCRIPT_BYTES + 1 })).toMatch(/too large/);
    expect(validateTranscriptFile({ name: "a.txt", size: MAX_TRANSCRIPT_BYTES })).toBeNull();
  });
});

describe("validateMediaFile", () => {
  it("accepts audio and video, rejects the rest", () => {
    expect(validateMediaFile({ name: "call.MP3", size: 1000 })).toBeNull();
    expect(validateMediaFile({ name: "call.mp4", size: 1000 })).toBeNull();
    expect(validateMediaFile({ name: "call.exe", size: 1000 })).toMatch(/Unsupported recording type/);
    expect(validateMediaFile({ name: "call.mp3", size: MAX_MEDIA_BYTES + 1 })).toMatch(/too large/);
    expect(validateMediaFile({ name: "call.mp3", size: 0 })).toMatch(/empty/);
  });
});

describe("titleFromFilename", () => {
  it("turns file names into readable titles", () => {
    expect(titleFromFilename("q4_launch-planning.vtt")).toBe("q4 launch planning");
    expect(titleFromFilename("notes")).toBe("notes");
    expect(titleFromFilename(".hidden")).toBe(".hidden");
    expect(titleFromFilename("a.b.c.txt")).toBe("a.b.c");
  });
});

describe("formatBytes / nowLocalInput", () => {
  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(150 * 1024)).toBe("150 KB");
    expect(formatBytes(3.5 * 1024 * 1024)).toBe("3.5 MB");
    expect(formatBytes(100 * 1024 * 1024)).toBe("100 MB");
  });
  it("formats a local date-time for the input", () => {
    expect(nowLocalInput(new Date(2026, 0, 5, 9, 7))).toBe("2026-01-05T09:07");
  });
});
