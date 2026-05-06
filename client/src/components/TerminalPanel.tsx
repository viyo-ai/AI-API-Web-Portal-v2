import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

type TerminalMessage =
  | { type: "ready"; sessionKey: string; tmuxSessionName: string; tmuxEnabled: boolean; cwd: string }
  | { type: "output"; data: string }
  | { type: "status"; status: string }
  | { type: "error"; message: string };

function createTerminalSocketUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/terminal`;
}

export default function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const tmuxEnabledRef = useRef(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [sessionLabel, setSessionLabel] = useState("Starting secure terminal...");
  const [tmuxEnabled, setTmuxEnabled] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.35,
      theme: {
        background: "#070A12",
        foreground: "#E6EDF7",
        cursor: "#8BE9FD",
        black: "#111827",
        red: "#FF6B6B",
        green: "#7BD88F",
        yellow: "#FFD166",
        blue: "#6EA8FE",
        magenta: "#C084FC",
        cyan: "#67E8F9",
        white: "#F8FAFC",
        brightBlack: "#475569",
        brightRed: "#F87171",
        brightGreen: "#86EFAC",
        brightYellow: "#FDE68A",
        brightBlue: "#93C5FD",
        brightMagenta: "#D8B4FE",
        brightCyan: "#A5F3FC",
        brightWhite: "#FFFFFF",
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    terminal.writeln("\x1b[36mAI Coding Workshop terminal booting...\x1b[0m");
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const fitAndResize = () => {
      try {
        fitAddon.fit();
        const socket = socketRef.current;
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "resize", cols: terminal.cols, rows: terminal.rows }));
        }
      } catch {
        // xterm can throw if fit runs before dimensions settle; next resize/connect will repair it.
      }
    };

    const connect = () => {
      setConnectionState("connecting");
      const socket = new WebSocket(createTerminalSocketUrl());
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        setConnectionState("connected");
        terminal.writeln("\r\n\x1b[32mConnected. Type a command or use the guided task panel.\x1b[0m");
        fitAndResize();
      });

      socket.addEventListener("message", event => {
        try {
          const message = JSON.parse(event.data) as TerminalMessage;
          if (message.type === "output") terminal.write(message.data);
          if (message.type === "ready") {
            tmuxEnabledRef.current = message.tmuxEnabled;
            setTmuxEnabled(message.tmuxEnabled);
            setSessionLabel(`${message.tmuxEnabled ? "tmux" : "shell fallback"} · ${message.tmuxSessionName} · ${message.cwd}`);
          }
          if (message.type === "status") terminal.writeln(`\r\n\x1b[90m${message.status}\x1b[0m`);
          if (message.type === "error") {
            setConnectionState("error");
            terminal.writeln(`\r\n\x1b[31m${message.message}\x1b[0m`);
          }
        } catch {
          terminal.write(String(event.data));
        }
      });

      socket.addEventListener("close", () => {
        setConnectionState("disconnected");
        terminal.writeln(`\r\n\x1b[33mTerminal disconnected. Reconnecting shortly; ${tmuxEnabledRef.current ? "tmux session is preserved" : "fallback shell state may not persist"}.\x1b[0m`);
        reconnectTimerRef.current = window.setTimeout(connect, 2500);
      });

      socket.addEventListener("error", () => {
        setConnectionState("error");
      });
    };

    const inputDisposable = terminal.onData(data => {
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "input", data }));
      }
    });

    const resizeObserver = new ResizeObserver(fitAndResize);
    resizeObserver.observe(containerRef.current);
    window.setTimeout(fitAndResize, 100);
    connect();

    return () => {
      inputDisposable.dispose();
      resizeObserver.disconnect();
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      socketRef.current?.close();
      terminal.dispose();
    };
  }, []);

  const stateStyles: Record<ConnectionState, string> = {
    connecting: "bg-amber-400/15 text-amber-200 ring-amber-400/30",
    connected: "bg-emerald-400/15 text-emerald-200 ring-emerald-400/30",
    disconnected: "bg-slate-400/15 text-slate-200 ring-slate-400/30",
    error: "bg-rose-400/15 text-rose-200 ring-rose-400/30",
  };

  return (
    <section className="flex min-h-[520px] flex-col overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#070A12] shadow-2xl shadow-black/40">
      <header className="flex items-center justify-between border-b border-white/10 bg-white/[0.035] px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/80">{tmuxEnabled ? "tmux PTY terminal" : "PTY shell terminal"}</p>
          <p className="truncate text-sm text-slate-400">{sessionLabel}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ring-1 ${stateStyles[connectionState]}`}>
          {connectionState}
        </span>
      </header>
      <div ref={containerRef} className="min-h-0 flex-1 p-3" aria-label="Authenticated tmux-backed terminal" />
    </section>
  );
}
