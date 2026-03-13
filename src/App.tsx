import React, { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { io, Socket } from "socket.io-client";
import { 
  Smartphone, 
  Code, 
  Play, 
  Download, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Terminal,
  Layout,
  Calculator,
  CheckSquare,
  CloudSun,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const TEMPLATES = [
  { id: "calculator", name: "Calculator", icon: Calculator, description: "A simple calculator app with basic arithmetic." },
  { id: "todo", name: "To-Do List", icon: CheckSquare, description: "Manage tasks with a clean list interface." },
  { id: "weather", name: "Weather App", icon: CloudSun, description: "Display weather information for a location." },
  { id: "general", name: "Custom App", icon: Layout, description: "Generate any app based on your prompt." },
];

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("general");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [generatedFiles, setGeneratedFiles] = useState<Record<string, string> | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>("MainActivity.java");
  const [buildStatus, setBuildStatus] = useState<"idle" | "building" | "success" | "error">("idle");
  const [apkUrl, setApkUrl] = useState<string | null>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    socketRef.current = io();
    
    socketRef.current.on("build-log", (log: string) => {
      setBuildLogs((prev) => [...prev, log]);
    });
    
    socketRef.current.on("build-complete", (data: { success: boolean; apkUrl?: string; error?: string }) => {
      setIsBuilding(false);
      if (data.success) {
        setBuildStatus("success");
        setApkUrl(data.apkUrl || null);
      } else {
        setBuildStatus("error");
        setBuildLogs((prev) => [...prev, `BUILD FAILED: ${data.error}`]);
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [buildLogs]);

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    setGeneratedFiles(null);
    setBuildStatus("idle");
    setApkUrl(null);
    setBuildLogs([]);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, template: selectedTemplate }),
      });
      const data = await response.json();
      setGeneratedFiles(data);
      setSelectedFile("MainActivity.java");
    } catch (error) {
      console.error("Generation failed", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBuild = async () => {
    if (!generatedFiles) return;
    setIsBuilding(true);
    setBuildStatus("building");
    setBuildLogs(["Starting build process..."]);
    
    try {
      await fetch("/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: generatedFiles }),
      });
    } catch (error) {
      console.error("Build failed", error);
      setIsBuilding(false);
      setBuildStatus("error");
    }
  };

  const handleFileChange = (value: string | undefined) => {
    if (value && generatedFiles) {
      setGeneratedFiles({ ...generatedFiles, [selectedFile]: value });
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Smartphone className="text-black w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Gemini APK Builder</h1>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">Real-time Android Compiler</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {apkUrl && (
              <a 
                href={apkUrl} 
                download 
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2 rounded-lg font-bold transition-all shadow-lg shadow-emerald-500/20"
              >
                <Download className="w-4 h-4" />
                Download APK
              </a>
            )}
            <button 
              onClick={handleBuild}
              disabled={!generatedFiles || isBuilding}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 px-4 py-2 rounded-lg font-bold transition-all border border-white/10"
            >
              {isBuilding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Build APK
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input & Templates */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <Sparkles className="w-4 h-4" />
              <h2 className="text-sm font-bold uppercase tracking-wider">AI Generation</h2>
            </div>
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your Android app... (e.g., 'A simple calculator with a dark theme')"
              className="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none transition-all"
            />
            <button 
              onClick={handleGenerate}
              disabled={isGenerating || !prompt}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              Generate App Code
            </button>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-white/60">
              <Layout className="w-4 h-4" />
              <h2 className="text-sm font-bold uppercase tracking-wider">Templates</h2>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => setSelectedTemplate(tmpl.id)}
                  className={`flex items-start gap-4 p-4 rounded-xl border transition-all text-left ${
                    selectedTemplate === tmpl.id 
                    ? "bg-emerald-500/10 border-emerald-500/50" 
                    : "bg-black/20 border-white/5 hover:border-white/20"
                  }`}
                >
                  <div className={`p-2 rounded-lg ${selectedTemplate === tmpl.id ? "bg-emerald-500 text-black" : "bg-white/10 text-white/60"}`}>
                    <tmpl.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">{tmpl.name}</h3>
                    <p className="text-xs text-white/40 mt-1">{tmpl.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Editor & Logs */}
        <div className="lg:col-span-8 space-y-6">
          <section className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden flex flex-col h-[600px]">
            <div className="bg-black/40 border-b border-white/10 p-2 flex items-center justify-between">
              <div className="flex gap-1 overflow-x-auto no-scrollbar">
                {generatedFiles && Object.keys(generatedFiles).map((fileName) => (
                  <button
                    key={fileName}
                    onClick={() => setSelectedFile(fileName)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                      selectedFile === fileName 
                      ? "bg-white/10 text-white border border-white/10" 
                      : "text-white/40 hover:text-white/60"
                    }`}
                  >
                    {fileName}
                  </button>
                ))}
                {!generatedFiles && <div className="px-4 py-1.5 text-xs text-white/20 italic">No files generated yet</div>}
              </div>
              <div className="flex items-center gap-2 px-4">
                <Code className="w-4 h-4 text-white/20" />
              </div>
            </div>
            <div className="flex-1 relative">
              {generatedFiles ? (
                <Editor
                  height="100%"
                  defaultLanguage={selectedFile.endsWith(".java") ? "java" : "xml"}
                  theme="vs-dark"
                  value={generatedFiles[selectedFile]}
                  onChange={handleFileChange}
                  options={{
                    fontSize: 13,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    padding: { top: 20 },
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20 space-y-4">
                  <Code className="w-12 h-12 opacity-20" />
                  <p className="text-sm font-medium">Generate code to start editing</p>
                </div>
              )}
            </div>
          </section>

          {/* Build Logs */}
          <section className="bg-black border border-white/10 rounded-2xl overflow-hidden flex flex-col h-[300px]">
            <div className="bg-white/5 border-b border-white/10 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider">Build Console</h2>
              </div>
              <div className="flex items-center gap-3">
                {buildStatus === "building" && (
                  <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-bold uppercase animate-pulse">
                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                    Compiling...
                  </div>
                )}
                {buildStatus === "success" && (
                  <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-bold uppercase">
                    <CheckCircle2 className="w-3 h-3" />
                    Build Success
                  </div>
                )}
                {buildStatus === "error" && (
                  <div className="flex items-center gap-2 text-red-400 text-[10px] font-bold uppercase">
                    <XCircle className="w-3 h-3" />
                    Build Failed
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 p-6 font-mono text-xs overflow-y-auto space-y-1 bg-black/80">
              {buildLogs.length > 0 ? (
                buildLogs.map((log, i) => (
                  <div key={i} className={`${log.startsWith("ERROR") ? "text-red-400" : "text-white/60"}`}>
                    <span className="text-white/20 mr-2">[{i + 1}]</span>
                    {log}
                  </div>
                ))
              ) : (
                <div className="text-white/10 italic">Waiting for build...</div>
              )}
              <div ref={logEndRef} />
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto p-6 border-t border-white/5 text-center">
        <p className="text-xs text-white/20">Powered by Gemini AI & Gradle Build System</p>
      </footer>
    </div>
  );
}
