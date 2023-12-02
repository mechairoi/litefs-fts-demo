import { createApp } from "./app";

const API_KEY = process.env.API_KEY ?? "";
const DB_PATH = process.env.DB_PATH ?? "./tmp/sqlite.db";
const PORT = (() => {
  const p = Number.parseInt(process.env.PORT ?? "8080", 10);
  return Number.isNaN(p) ? 8080 : p;
})();

const app = createApp({ apiKey: API_KEY, dbPath: DB_PATH });

export default {
  port: PORT,
  fetch: app.fetch,
  maxRequestBodySize: 1024 * 1024 * 1024,
};
