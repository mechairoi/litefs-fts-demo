import { describe, expect, test } from "bun:test";
import { createApp } from "./app.ts";

const app = createApp({ apiKey: "test", dbPath: ":memory:" });

describe("GET /", () => {
  test("GET /", async () => {
    const res = await app.fetch(new Request("http://localhost/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
  });
});

describe("PUT document", () => {
  test("204", async () => {
    const res = await app.fetch(
      new Request("http://localhost/documents/1", {
        method: "PUT",
        headers: {
          authorization: "Bearer test",
          "content-type": "application/json",
        },
        body: JSON.stringify({ title: "Hello", content: "World" }),
      }),
    );
    expect(res.status).toBe(204);
  });
  test("401 if no authorization header", async () => {
    const res = await app.fetch(
      new Request("http://localhost/documents/2", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Hello", content: "World" }),
      }),
    );
    expect(res.status).toBe(401);
  });
  test("401 if authorization header is not valid", async () => {
    const res = await app.fetch(
      new Request("http://localhost/documents/2", {
        method: "PUT",
        headers: {
          authorization: "Bearer foo",
          "content-type": "application/json",
        },
        body: JSON.stringify({ title: "Hello", content: "World" }),
      }),
    );
    expect(res.status).toBe(401);
  });
  test("PUT document 400 when body json is malformed", async () => {
    const res = await app.fetch(
      new Request("http://localhost/documents/1", {
        method: "PUT",
        headers: {
          authorization: "Bearer test",
          "content-type": "application/json",
        },
        body: "{",
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json<unknown>()).toEqual({
      message: "Malformed JSON in request body",
      success: false,
    });
  });

  test("400 when invalid body parameters", async () => {
    const res = await app.fetch(
      new Request("http://localhost/documents/1", {
        method: "PUT",
        headers: {
          authorization: "Bearer test",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Hello",
          content: "World",
        }),
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json<unknown>()).toEqual({
      success: false,
      issues: expect.anything(),
      error: expect.anything(),
    });
  });
});

describe("POST documents", () => {
  test("204", async () => {
    const res = await app.fetch(
      new Request("http://localhost/documents", {
        method: "POST",
        headers: {
          authorization: "Bearer test",
          "content-type": "application/json",
        },
        body: JSON.stringify([
          {
            id: "1",
            title: "Hello",
            content: "World",
          },
        ]),
      }),
    );
    expect(res.status).toBe(204);
  });
  test("401 if no authorization header", async () => {
    const res = await app.fetch(
      new Request("http://localhost/documents", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify([
          {
            id: "1",
            title: "Hello",
            content: "World",
          },
        ]),
      }),
    );
    expect(res.status).toBe(401);
  });
  test("401 if authorization header is not valid", async () => {
    const res = await app.fetch(
      new Request("http://localhost/documents", {
        method: "POST",
        headers: {
          authorization: "Bearer foo",
          "content-type": "application/json",
        },
        body: JSON.stringify([
          {
            id: "1",
            title: "Hello",
            content: "World",
          },
        ]),
      }),
    );
    expect(res.status).toBe(401);
  });
  test("400 if json body is malformed", async () => {
    const res = await app.fetch(
      new Request("http://localhost/documents/1", {
        method: "PUT",
        headers: {
          authorization: "Bearer test",
          "content-type": "application/json",
        },
        body: "{",
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json<unknown>()).toEqual({
      message: "Malformed JSON in request body",
      success: false,
    });
  });
  test("400 when invalid body parameters", async () => {
    const res = await app.fetch(
      new Request("http://localhost/documents", {
        method: "POST",
        headers: {
          authorization: "Bearer test",
          "content-type": "application/json",
        },
        body: JSON.stringify([
          {
            id: 1,
            title: "Hello",
            content: "World",
          },
        ]),
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json<unknown>()).toEqual({
      success: false,
      issues: expect.anything(),
      error: expect.anything(),
    });
  });
});

describe("GET document", () => {
  test("200", async () => {
    const res = await app.fetch(
      new Request("http://localhost/documents/100", {
        method: "PUT",
        headers: {
          authorization: "Bearer test",
          "content-type": "application/json",
        },
        body: JSON.stringify({ title: "Hello", content: "World" }),
      }),
    );
    expect(res.status).toBe(204);

    const res2 = await app.fetch(new Request("http://localhost/documents/100"));
    expect(res2.status).toBe(200);
    expect(await res2.json<unknown>()).toEqual({
      id: "100",
      title: "Hello",
      content: "World",
    });
  });
  test("404", async () => {
    const res = await app.fetch(
      new Request("http://localhost/documents/not-found"),
    );
    expect(res.status).toBe(404);
  });
});

describe("GET search", async () => {
  const app = createApp({ apiKey: "test", dbPath: ":memory:" });

  test("200", async () => {
    const res = await app.fetch(
      new Request("http://localhost/documents/1", {
        method: "PUT",
        headers: {
          authorization: "Bearer test",
          "content-type": "application/json",
        },
        body: JSON.stringify({ title: "Hello", content: "World" }),
      }),
    );
    expect(res.status).toBe(204);

    const res2 = await app.fetch(
      new Request(`http://localhost/search?q=${encodeURIComponent("World")}`),
    );
    expect(res2.status).toBe(200);
    expect(await res2.json<unknown>()).toEqual([
      {
        id: "1",
        title: "Hello",
        content: "World",
      },
    ]);
  });
  test("200 japanese", async () => {
    const res = await app.fetch(
      new Request("http://localhost/documents/3", {
        method: "PUT",
        headers: {
          authorization: "Bearer test",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "こんにちは",
          content: "今日は走ります",
        }),
      }),
    );
    expect(res.status).toBe(204);

    const res2 = await app.fetch(
      new Request(`http://localhost/search?q=${encodeURIComponent("走る")}`),
    );
    expect(res2.status).toBe(200);
    expect(await res2.json<unknown>()).toEqual([
      {
        id: "3",
        title: "こんにちは",
        content: "今日は走ります",
      },
    ]);
  });
  test("200 empty result", async () => {
    const res = await app.fetch(
      new Request(`http://localhost/search?q=${encodeURIComponent("unknown")}`),
    );
    expect(res.status).toBe(200);
    expect(await res.json<unknown>()).toEqual([]);
  });
  test("400 if no query parameters", async () => {
    const res = await app.fetch(new Request("http://localhost/search"));
    expect(res.status).toBe(400);
    expect(await res.json<unknown>()).toEqual({
      errors: ["query parameter `q` should contains 1 ore more characters."],
    });
  });
  test("400 if query parameter is empty string", async () => {
    const res = await app.fetch(new Request("http://localhost/search?q="));
    expect(res.status).toBe(400);
    expect(await res.json<unknown>()).toEqual({
      errors: ["query parameter `q` should contains 1 ore more characters."],
    });
  });
});

describe("DELETE document", () => {
  test("204", async () => {
    const app = createApp({ apiKey: "test", dbPath: ":memory:" });
    const res = await app.fetch(
      new Request("http://localhost/documents/1", {
        method: "PUT",
        headers: {
          authorization: "Bearer test",
          "content-type": "application/json",
        },
        body: JSON.stringify({ title: "Hello", content: "World" }),
      }),
    );
    expect(res.status).toBe(204);
    const res2 = await app.fetch(new Request("http://localhost/documents/1"));
    expect(res2.status).toBe(200);

    const res3 = await app.fetch(
      new Request("http://localhost/documents/1", {
        method: "DELETE",
        headers: {
          authorization: "Bearer test",
          "content-type": "application/json",
        },
      }),
    );
    expect(res3.status).toBe(204);

    const res4 = await app.fetch(new Request("http://localhost/documents/1"));
    expect(res4.status).toBe(404);
    const res5 = await app.fetch(
      new Request(`http://localhost/search?q=${encodeURIComponent("World")}`),
    );
    expect(res5.status).toBe(200);
    expect(await res5.json<unknown>()).toEqual([]);
  });
});
