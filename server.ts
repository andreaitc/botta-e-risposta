import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as geminiServer from "./src/lib/gemini.server.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON parsing with a large limit so we can receive large base64 audio and PDF uploads.
  app.use(express.json({ limit: "150mb" }));
  app.use(express.urlencoded({ limit: "150mb", extended: true }));

  // API Route for Gemini
  app.post("/api/gemini", async (req, res) => {
    const { functionName, args } = req.body;
    
    if (!functionName) {
      return res.status(400).send("Missing functionName");
    }
    
    const fn = (geminiServer as any)[functionName];
    if (typeof fn !== "function") {
      return res.status(404).send(`Function ${functionName} not found`);
    }
    
    try {
      const result = await fn(...(args || []));
      
      // Check if it's a Blob, or looks like a Blob (has arrayBuffer or buffer)
      if (result && typeof result === "object" && (typeof result.arrayBuffer === "function" || result.constructor?.name === "Blob")) {
        const arrayBuffer = typeof result.arrayBuffer === "function" 
          ? await result.arrayBuffer() 
          : (await result.buffer());
        const buffer = Buffer.from(arrayBuffer);
        res.set("Content-Type", result.type || "application/octet-stream");
        return res.send(buffer);
      }
      
      return res.json(result);
    } catch (err: any) {
      console.error(`Error in server-side ${functionName}:`, err);
      return res.status(500).send(err instanceof Error ? err.message : String(err));
    }
  });

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
