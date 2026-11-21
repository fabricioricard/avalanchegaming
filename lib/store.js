"use strict";
const crypto = require("crypto");

/* ===== Catálogo (os preços valem aqui, no servidor) ===== */
const PRODUCTS = {
  lobo:   { name: "Mousepad Lobo de Gelo",   price: 99 },
  dragao: { name: "Mousepad Dragão de Gelo", price: 99 }
};
const SHIPPING = 0; // frete grátis (a loja cobre). Mantenha igual ao CONFIG.frete do index.html

/* ===== Redis (Upstash via REST) ===== */
const REDIS_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(...args) {
  if (!REDIS_URL || !REDIS_TOKEN) throw new Error("Redis não configurado");
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args.map(String))
  });
  const j = await r.json();
  if (j.error) throw new Error("Redis: " + j.error);
  return j.result;
}

const ID_RE = /^[a-f0-9]{20}$/;
const newId = () => crypto.randomBytes(10).toString("hex");
const shortId = id => id.slice(0, 6).toUpperCase();

async function getOrder(id) {
  if (!ID_RE.test(String(id || ""))) return null;
  const raw = await redis("GET", "order:" + id);
  return raw ? JSON.parse(raw) : null;
}
async function saveOrder(o) { await redis("SET", "order:" + o.id, JSON.stringify(o)); }
async function addOrder(o) {
  await saveOrder(o);
  await redis("ZADD", "orders", o.createdAt, o.id);
}
async function listOrders(limit = 200) {
  const ids = await redis("ZREVRANGE", "orders", 0, limit - 1);
  if (!ids || !ids.length) return [];
  const raws = await redis("MGET", ...ids.map(i => "order:" + i));
  return raws.filter(Boolean).map(r => JSON.parse(r));
}

/* ===== Pix estático (BR Code), cai direto na chave da loja ===== */
const tlv = (id, val) => id + String(val.length).padStart(2, "0") + val;
const clean = (s, max) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^A-Za-z0-9 ]/g, "").toUpperCase().trim().slice(0, max);

function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/* Chave só com números e símbolos (CPF/CNPJ) vira só dígitos; as demais ficam como estão */
function normalizeKey(k) {
  k = String(k || "").trim();
  return /^[\d.\-\/]+$/.test(k) ? k.replace(/\D/g, "") : k;
}

function pixPayload({ key, name, city, amount, txid }) {
  const p =
    tlv("00", "01") + tlv("01", "11") +
    tlv("26", tlv("00", "br.gov.bcb.pix") + tlv("01", normalizeKey(key))) +
    tlv("52", "0000") + tlv("53", "986") + tlv("54", Number(amount).toFixed(2)) +
    tlv("58", "BR") + tlv("59", clean(name, 25) || "LOJA") + tlv("60", clean(city, 15) || "BRASIL") +
    tlv("62", tlv("05", String(txid || "***").slice(0, 25))) + "6304";
  return p + crc16(p);
}

/* ===== Aviso no Telegram da loja (bot criado no @BotFather) =====
   Nunca derruba o pedido: se falhar, só registra no log. O painel /admin.html continua sendo a fonte da verdade. */
async function tg(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), signal: ctrl.signal
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) console.error("Telegram", method, r.status, JSON.stringify(j).slice(0, 200));
    return j;
  } catch (e) {
    console.error("Telegram falhou", method, e.message);
    return null;
  } finally { clearTimeout(t); }
}

/* Manda o aviso. Com orderId, a mensagem ganha o botão "Confirmar pagamento". */
async function notifyOwner(text, orderId) {
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!process.env.TELEGRAM_BOT_TOKEN || !chat) {
    console.warn("Telegram não configurado: aviso não enviado");
    return false;
  }
  const payload = { chat_id: chat, text, disable_web_page_preview: true };
  if (orderId) payload.reply_markup = { inline_keyboard: [[{ text: "✅ Confirmar pagamento", callback_data: "c:" + orderId }]] };
  const j = await tg("sendMessage", payload);
  return !!(j && j.ok);
}

function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `https://${host}`;
}

/* ===== Util ===== */
function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

module.exports = {
  PRODUCTS, SHIPPING, redis, newId, shortId, ID_RE,
  getOrder, saveOrder, addOrder, listOrders,
  pixPayload, crc16, safeEqual, notifyOwner, tg, siteUrl
};
