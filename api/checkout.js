"use strict";
const S = require("../lib/store");

const digits = s => String(s || "").replace(/\D/g, "");
const str = (s, max = 100) => String(s || "").trim().slice(0, max);
const fail = (res, code, error) => res.status(code).json({ error });

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return fail(res, 405, "Método não permitido");

  try {
    const pixKey = process.env.PIX_KEY;
    if (!pixKey) return fail(res, 500, "Pix não configurado na loja.");

    /* limite simples por IP: 10 pedidos a cada 10 minutos */
    const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
    const n = Number(await S.redis("INCR", "rl:" + ip));
    if (n === 1) await S.redis("EXPIRE", "rl:" + ip, 600);
    if (n > 10) return fail(res, 429, "Muitas tentativas. Aguarde alguns minutos.");

    const b = req.body || {};

    /* itens */
    const merged = {};
    for (const it of Array.isArray(b.items) ? b.items : []) {
      if (!S.PRODUCTS[it.id]) return fail(res, 400, "Produto inválido.");
      const q = Number(it.qty);
      if (!Number.isInteger(q) || q < 1 || q > 10) return fail(res, 400, "Quantidade inválida.");
      merged[it.id] = (merged[it.id] || 0) + q;
    }
    const items = Object.keys(merged).map(id => ({
      id, name: S.PRODUCTS[id].name, qty: merged[id], price: S.PRODUCTS[id].price
    }));
    const totalQty = items.reduce((a, i) => a + i.qty, 0);
    if (!items.length || totalQty > 20) return fail(res, 400, "Carrinho inválido.");

    /* cliente */
    const c = b.customer || {};
    const customer = { name: str(c.name, 80), email: str(c.email, 120).toLowerCase(), phone: digits(c.phone) };
    if (customer.name.length < 2) return fail(res, 400, "Informe seu nome.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) return fail(res, 400, "E-mail inválido.");
    if (customer.phone.length < 10 || customer.phone.length > 11) return fail(res, 400, "WhatsApp inválido.");

    /* endereço */
    const a = b.address || {};
    const address = {
      cep: digits(a.cep), street: str(a.street), number: str(a.number, 20), complement: str(a.complement, 60),
      district: str(a.district), city: str(a.city), state: str(a.state, 2).toUpperCase()
    };
    if (address.cep.length !== 8 || !address.street || !address.number || !address.district || !address.city ||
        !/^[A-Z]{2}$/.test(address.state)) return fail(res, 400, "Endereço incompleto.");

    /* pedido */
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const total = Math.round((subtotal + S.SHIPPING) * 100) / 100;
    const id = S.newId();
    const txid = "AV" + id.slice(0, 12).toUpperCase();
    const code = S.pixPayload({
      key: pixKey,
      name: process.env.PIX_NAME || "AVALANCHE MOUSEPADS",
      city: process.env.PIX_CITY || "SALVADOR",
      amount: total,
      txid
    });
    const order = {
      id, short: S.shortId(id), txid, status: "pending", createdAt: Date.now(),
      items, subtotal, shipping: S.SHIPPING, total, customer, address, qr: { code }
    };
    await S.addOrder(order);

    return res.status(200).json({ id, short: order.short, total, qrCode: code });
  } catch (e) {
    console.error("checkout", e);
    return fail(res, 500, "Erro interno. Tente novamente.");
  }
};
