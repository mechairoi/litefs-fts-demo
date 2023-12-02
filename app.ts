import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { Database } from "bun:sqlite";
import { array, Input, object, string } from "valibot";
import { vValidator } from "@hono/valibot-validator";
import { bearerAuth } from "hono/bearer-auth";

if (process.env.CUSTOM_SQLITE_PATH) {
  Database.setCustomSQLite(process.env.CUSTOM_SQLITE_PATH);
}

const $document = object({
  title: string(),
  content: string(),
});
const $documentWithId = object({
  id: string(),
  title: string(),
  content: string(),
});
const $documents = array($documentWithId);
type DocumentWithId = Input<typeof $documentWithId>;
type Documents = Input<typeof $documents>;

type AppConfig = Readonly<{
  apiKey: string;
  dbPath: string;
}>;

export function createApp({ apiKey, dbPath }: AppConfig): Hono {
  const app = new Hono();
  app.use("/", serveStatic({ path: "./index.html" }));

  const db = new Database(dbPath, { create: true });
  db.loadExtension("./lib/libsignal_tokenizer", "signal_fts5_tokenizer_init");
  db.exec("pragma journal_mode = WAL");
  db.exec("pragma synchronous = normal");
  db.exec("pragma temp_store = memory");
  db.exec("pragma mmap_size = 30000000000");
  db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts
    USING fts5(id UNINDEXED, title, content, tokenize="signal_tokenizer");
  `);
  db.exec("CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY);");

  const putDocumentsTxn = db.transaction((documents: Documents) => {
    const chunkSize = 200;
    for (let i = 0; i < documents.length; i += chunkSize) {
      const chunk = documents.slice(i, i + chunkSize);
      db.prepare(
        `INSERT OR IGNORE INTO documents (id) VALUES ${chunk
          .map(() => "(?)")
          .join(",")}`,
      ).run(...chunk.map((d) => d.id));
      const idToRowId = new Map(
        db
          .prepare(
            `SELECT id, rowid FROM documents WHERE id IN (${Array.from(
              { length: chunk.length },
              () => "?",
            ).join(", ")})`,
          )
          .values(...chunk.map((d) => d.id)) as [string, number][],
      );
      if (chunk.length !== idToRowId.size) {
        throw new Error("Unexpected error");
      }
      db.prepare(
        `DELETE FROM documents_fts WHERE rowid IN (${Array.from(
          { length: chunk.length },
          () => "?",
        ).join(", ")})`,
      ).run(...idToRowId.values());
      db.prepare(
        `INSERT INTO documents_fts (rowid, id, title, content) VALUES ${chunk
          .map(() => "(?, ?, ?, ?)")
          .join(",")}`,
      ).run(
        ...chunk.flatMap((d) => {
          const rowid = idToRowId.get(d.id);
          return rowid ? [rowid, d.id, d.title, d.content] : [];
        }),
      );
    }
  });
  app.put(
    "/documents/:documentId",
    bearerAuth({ token: apiKey }),
    vValidator("json", $document),
    async (c) => {
      const document = c.req.valid("json");
      putDocumentsTxn([{ id: c.req.param("documentId"), ...document }]);
      return c.body(null, 204);
    },
  );
  app.post(
    "/documents",
    bearerAuth({ token: apiKey }),
    vValidator("json", $documents),
    async (c) => {
      const documents = c.req.valid("json");
      if (documents.length === 0) return c.body(null, 204);
      if (new Set(documents.map((d) => d.id)).size !== documents.length) {
        throw new Error("Documents should have unique id.");
      }
      putDocumentsTxn(documents);
      return c.body(null, 204);
    },
  );

  const findRowIdStmt = db.prepare("SELECT rowid FROM documents WHERE id = ?");
  const deleteStmt = db.prepare("DELETE FROM documents WHERE rowid = ?");
  const deleteFtsStmt = db.prepare("DELETE FROM documents_fts WHERE rowid = ?");
  const deleteTxn = db.transaction((rowId) => {
    deleteStmt.run(rowId);
    deleteFtsStmt.run(rowId);
  });
  app.delete("/documents/:documentId", bearerAuth({ token: apiKey }), (c) => {
    const documentId = c.req.param("documentId");
    const rowId = findRowIdStmt.values(documentId)[0]?.[0];
    if (rowId === undefined) return c.body(null, 404);
    deleteTxn(rowId);
    return c.body(null, 204);
  });

  const getStmt = db.prepare(
    "SELECT id, title, content from documents_fts where rowid = (SELECT rowId FROM documents WHERE id = ?)",
  );
  app.get("/documents/:documentId", (c) => {
    const documentId = c.req.param("documentId");
    const document = getStmt.get(documentId) as DocumentWithId | null;
    if (!document) return c.body(null, 404);
    return c.json(document);
  });

  const searchStmt = db.prepare(
    "SELECT id, title, content FROM documents_fts WHERE content MATCH ? ORDER BY bm25(documents_fts) ASC LIMIT 100",
  );
  app.get("/search", (c) => {
    const query = c.req.query("q");
    if (!query) {
      return c.json(
        {
          errors: [
            "query parameter `q` should contains 1 ore more characters.",
          ],
        },
        400,
      );
    }
    const documents = searchStmt.all(
      query
        .split(/\s+/)
        .map((q) => JSON.stringify(q))
        .join(" "),
    ) as readonly DocumentWithId[];
    return c.json(documents);
  });
  return app;
}
