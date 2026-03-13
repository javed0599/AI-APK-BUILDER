import express from "express";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import cors from "cors";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

app.use(cors());
app.use(express.json());

const PORT = 3000;
const ANDROID_PROJECT_PATH = path.join(process.cwd(), "android-project");

// Ensure android-project directory exists
if (!fs.existsSync(ANDROID_PROJECT_PATH)) {
  fs.mkdirSync(ANDROID_PROJECT_PATH, { recursive: true });
}

// Gemini API setup
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// API Routes
app.post("/api/generate", async (req, res) => {
  const { prompt, template } = req.body;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a complete Android app (Java/XML) based on this prompt: "${prompt}". 
      Template type: ${template || "General"}.
      Return the code in a JSON format with the following structure:
      {
        "MainActivity.java": "source code",
        "activity_main.xml": "layout xml",
        "AndroidManifest.xml": "manifest xml",
        "build.gradle": "app level build.gradle",
        "strings.xml": "resource strings"
      }`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            "MainActivity.java": { type: Type.STRING },
            "activity_main.xml": { type: Type.STRING },
            "AndroidManifest.xml": { type: Type.STRING },
            "build.gradle": { type: Type.STRING },
            "strings.xml": { type: Type.STRING },
          },
          required: ["MainActivity.java", "activity_main.xml", "AndroidManifest.xml", "build.gradle", "strings.xml"],
        },
      },
    });

    const code = JSON.parse(response.text);
    res.json(code);
  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: "Failed to generate code" });
  }
});

app.post("/api/build", async (req, res) => {
  const { files } = req.body;
  
  try {
    // 1. Setup Android Project Structure
    setupAndroidProject(files);
    
    // 2. Run Gradle Build
    const buildProcess = exec("gradle assembleDebug", { cwd: ANDROID_PROJECT_PATH });
    
    buildProcess.stdout?.on("data", (data) => {
      io.emit("build-log", data.toString());
    });
    
    buildProcess.stderr?.on("data", (data) => {
      io.emit("build-log", `ERROR: ${data.toString()}`);
    });
    
    buildProcess.on("close", (code) => {
      if (code === 0) {
        const apkPath = path.join(ANDROID_PROJECT_PATH, "app/build/outputs/apk/debug/app-debug.apk");
        if (fs.existsSync(apkPath)) {
          io.emit("build-complete", { success: true, apkUrl: "/api/download-apk" });
        } else {
          io.emit("build-complete", { success: false, error: "APK not found after build" });
        }
      } else {
        io.emit("build-complete", { success: false, error: `Build failed with code ${code}` });
      }
    });

    res.json({ message: "Build started" });
  } catch (error) {
    console.error("Build Error:", error);
    res.status(500).json({ error: "Failed to start build" });
  }
});

app.get("/api/download-apk", (req, res) => {
  const apkPath = path.join(ANDROID_PROJECT_PATH, "app/build/outputs/apk/debug/app-debug.apk");
  if (fs.existsSync(apkPath)) {
    res.download(apkPath, "app-debug.apk");
  } else {
    res.status(404).send("APK not found");
  }
});

function setupAndroidProject(files: any) {
  // Simple structure for a basic Android project
  const appDir = path.join(ANDROID_PROJECT_PATH, "app");
  const srcDir = path.join(appDir, "src/main/java/com/example/myapp");
  const resDir = path.join(appDir, "src/main/res/layout");
  const valuesDir = path.join(appDir, "src/main/res/values");

  fs.mkdirSync(srcDir, { recursive: true });
  fs.mkdirSync(resDir, { recursive: true });
  fs.mkdirSync(valuesDir, { recursive: true });

  fs.writeFileSync(path.join(srcDir, "MainActivity.java"), files["MainActivity.java"]);
  fs.writeFileSync(path.join(resDir, "activity_main.xml"), files["activity_main.xml"]);
  fs.writeFileSync(path.join(appDir, "src/main/AndroidManifest.xml"), files["AndroidManifest.xml"]);
  fs.writeFileSync(path.join(appDir, "build.gradle"), files["build.gradle"]);
  fs.writeFileSync(path.join(valuesDir, "strings.xml"), files["strings.xml"]);

  // Root files
  fs.writeFileSync(path.join(ANDROID_PROJECT_PATH, "settings.gradle"), "include ':app'");
  fs.writeFileSync(path.join(ANDROID_PROJECT_PATH, "build.gradle"), `
    buildscript {
        repositories { google(); mavenCentral() }
        dependencies { classpath 'com.android.tools.build:gradle:8.2.2' }
    }
    allprojects {
        repositories { google(); mavenCentral() }
    }
  `);
}

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
