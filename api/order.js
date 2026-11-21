"use strict";
const S = require("../lib/store");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    /* Cliente avisa que já pagou (a loja ainda precisa confirmar no painel) */
    if (req.method === "POST") {
      const { id, action } = req.body || {};
      if (action !== "claim") return res.status(400).json({ error: "Ação inválida" });
      const o = await S.getOrder(id);
      if (!o) return res.status(404).json({ error: "Pedido não encontrado" });
      if (o.status !== "pending") return res.status(200).json({ ok: true });
      if (!o.claimedAt) {
        o.claimedAt = Date.now();
        await S.saveOrder(o);
        const brl = v => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        const itens = o.items.map(i => `${i.qty}x ${i.name.replace(/^Mousepad /, "")}`).join(", ");
        await S.notifyOwner(
          `💰 Pedido #${o.short}: ${o.customer.name} avisou que pagou ${brl(o.total)}.\n` +
          `${itens}\n` +
          `Confira o Pix no app do Banco do Brasil. Se entrou, toque em Confirmar abaixo.\n` +
          `Painel: ${S.siteUrl(req)}/admin.html`,
          o.id
        );
      }
      return res.status(200).json({ ok: true });
    }

    if (req.method !== "GET") return res.status(405).json({ error: "Método não permitido" });

    const o = await S.getOrder(req.query.id);
    if (!o) return res.status(404).json({ error: "Pedido não encontrado" });

    const out = {
      id: o.id, short: o.short, status: o.status,
      createdAt: o.createdAt, claimedAt: o.claimedAt || null,
      paidAt: o.paidAt || null, shippedAt: o.shippedAt || null, deliveredAt: o.deliveredAt || null,
      tracking: o.tracking || null,
      items: o.items, subtotal: o.subtotal, shipping: o.shipping, total: o.total,
      firstName: String(o.customer.name).split(/\s+/)[0],
      city: o.address.city, state: o.address.state,
      whatsapp: process.env.STORE_WHATSAPP || ""
    };
    if (o.status === "pending" && o.qr) out.qr = { code: o.qr.code };
    return res.status(200).json(out);
  } catch (e) {
    console.error("order", e);
    return res.status(500).json({ error: "Erro interno" });
  }
};
