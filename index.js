import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// ✅ ESM odpowiednik __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// ✅ serwowanie plików z folderu public
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Serwer działa: http://localhost:${PORT}`);
});
