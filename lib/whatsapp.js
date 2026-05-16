import fs from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";

const AUTH_DIR = path.join(process.env.WA_SENDER_DATA_DIR || process.cwd(), "auth_session");
const FALLBACK_WA_VERSION = [2, 3000, 1035194821];
let autoConnectStarted = false;

function getState() {
  if (!globalThis.__waState) {
    globalThis.__waState = {
      sock: null,
      status: "disconnected",
      qrDataUrl: null,
      me: null,
      lastError: null,
      connectingPromise: null,
      reconnecting: false,
      campaign: null,
    };
  }
  return globalThis.__waState;
}

export function getWhatsAppState() {
  const state = getState();
  if (state.sock?.user && state.status !== "connected") {
    markConnected(state, state.sock);
  }
  return {
    status: state.status,
    qrDataUrl: state.qrDataUrl,
    me: state.me,
    lastError: state.lastError,
  };
}

export function getSocket() {
  return getState().sock;
}

export function isConnected() {
  const state = getState();
  if (state.sock?.user && state.status !== "connected") {
    markConnected(state, state.sock);
  }
  return state.status === "connected" && Boolean(state.sock);
}

export async function ensureConnected(timeoutMs = 15000) {
  if (isConnected()) return true;

  connect().catch(() => {});

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (isConnected()) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return isConnected();
}

export async function hasSavedSession() {
  try {
    const entries = await fs.readdir(AUTH_DIR);
    return entries.length > 0;
  } catch {
    return false;
  }
}

export async function autoConnectFromSession() {
  const state = getState();
  if (isConnected() || state.connectingPromise || autoConnectStarted) return;
  if (!(await hasSavedSession())) return;

  autoConnectStarted = true;
  connect()
    .catch(() => {})
    .finally(() => {
      autoConnectStarted = false;
    });
}

function markConnected(state, sock) {
  const id = sock.user?.id || "";
  state.status = "connected";
  state.qrDataUrl = null;
  state.me = {
    id,
    name: sock.user?.name || sock.user?.verifiedName || "Linked device",
    number: id.split(":")[0].replace(/\D/g, ""),
  };
  state.lastError = null;
}

export async function connect() {
  const state = getState();
  if (state.status === "connected" && state.sock) return;
  if (state.connectingPromise) return state.connectingPromise;

  state.status = "connecting";
  state.lastError = null;

  state.connectingPromise = (async () => {
    try {
      const baileys = await import("@whiskeysockets/baileys");
      const makeWASocket = baileys.default;
      const { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } = baileys;
      const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      let version = FALLBACK_WA_VERSION;

      try {
        const latest = await fetchLatestBaileysVersion();
        if (Array.isArray(latest?.version)) version = latest.version;
      } catch (versionError) {
        state.lastError = `Could not fetch latest WhatsApp Web version, using bundled fallback. ${versionError.message}`;
      }

      const sock = makeWASocket({
        version,
        auth: authState,
        printQRInTerminal: false,
        browser: ["WA Sender", "Chrome", "1.0.0"],
      });

      state.sock = sock;

      sock.ev.on("creds.update", saveCreds);
      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          state.qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 280 });
          state.status = "qr";
        }

        if (connection === "open") {
          markConnected(state, sock);
        }

        if (connection === "close") {
          const code = lastDisconnect?.error?.output?.statusCode;
          state.sock = null;
          state.me = null;

          if (code === DisconnectReason.loggedOut) {
            await wipeSession();
            state.status = "disconnected";
            state.lastError = "Logged out. Scan a fresh QR to reconnect.";
            return;
          }

          state.status = "disconnected";
          state.lastError = lastDisconnect?.error?.message || "Connection closed. Reconnecting...";
          if (!state.reconnecting) {
            state.reconnecting = true;
            setTimeout(async () => {
              state.reconnecting = false;
              await connect();
            }, 2000);
          }
        }
      });
    } catch (error) {
      state.status = "disconnected";
      state.lastError = describeError(error);
      throw error;
    } finally {
      state.connectingPromise = null;
    }
  })();

  return state.connectingPromise;
}

function describeError(error) {
  if (error?.cause?.code) return `${error.message} (${error.cause.code})`;
  return error?.message || "Unknown WhatsApp connection error";
}

export async function logout() {
  const state = getState();
  try {
    await state.sock?.logout?.();
    state.sock?.end?.();
  } catch {
  }
  state.sock = null;
  state.status = "disconnected";
  state.qrDataUrl = null;
  state.me = null;
  await wipeSession();
}

async function wipeSession() {
  await fs.rm(AUTH_DIR, { recursive: true, force: true });
}
