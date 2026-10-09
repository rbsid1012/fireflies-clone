import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "./api";

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

afterEach(() => vi.unstubAllGlobals());

describe("api client", () => {
  it("builds query strings, skipping empty values", async () => {
    let seen = "";
    mockFetch(async (url) => {
      seen = url;
      return Response.json({ ok: true });
    });
    await api.get("/api/meetings", { q: "kafka", page: 2, tag: "", participant_id: undefined, flag: false });
    const params = new URL(seen).searchParams;
    expect(params.get("q")).toBe("kafka");
    expect(params.get("page")).toBe("2");
    expect(params.get("flag")).toBe("false");
    expect(params.has("tag")).toBe(false);
    expect(params.has("participant_id")).toBe(false);
  });

  it("turns the backend's {detail, code} body into an ApiError", async () => {
    mockFetch(async () => Response.json({ detail: "Meeting not found", code: "not_found" }, { status: 404 }));
    const err = await api.get("/api/meetings/9").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 404, code: "not_found", message: "Meeting not found" });
  });

  it("copes with non-JSON error bodies", async () => {
    mockFetch(async () => new Response("<html>bad gateway</html>", { status: 502, statusText: "Bad Gateway" }));
    await expect(api.get("/x")).rejects.toMatchObject({ status: 502, message: "Bad Gateway" });
  });

  it("reports network failures with status 0", async () => {
    mockFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(api.get("/x")).rejects.toMatchObject({ status: 0, code: "network_error" });
  });

  it("sends JSON bodies with a content type and returns undefined for 204", async () => {
    let init: RequestInit | undefined;
    mockFetch(async (_url, i) => {
      init = i;
      return new Response(null, { status: 204 });
    });
    await expect(api.post("/x", { a: 1 })).resolves.toBeUndefined();
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe('{"a":1}');
    expect(init?.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("lets the browser set the multipart boundary for FormData", async () => {
    let init: RequestInit | undefined;
    mockFetch(async (_url, i) => {
      init = i;
      return Response.json({});
    });
    const form = new FormData();
    form.set("title", "x");
    await api.post("/x", form);
    expect(init?.body).toBe(form);
    expect(init?.headers).toBeUndefined();
  });
});
