"use strict";
const S = require("../lib/store");

const TRACKING_RE = /^[A-Z]{2}\d{9}[A-Z]{2}$/; // padrão dos Correios, ex.: AA123456789BR

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass) return res.status(500).json({ error: "ADMIN_PASSWORD não configurada" });
  if (!S.safeEqual(req.headers["x-admin-password"] || "", pass)) {
    return res.status(401).json({ error: "Senha incorreta" });
  }

  try {
    if (req.method === "GET") {
      const orders = await S.listOrders();
      return res.status(200).json({ orders });
    }

    if (req.method === "POST") {
      const { id, action } = req.body || {};
      const o = await S.getOrder(id);
      if (!o) return res.status(404).json({ error: "Pedido não encontrado" });

      if (action === "confirm") {
        if (!["pending", "cancelled"].includes(o.status)) return res.status(400).json({ error: "Esse pedido já foi confirmado." });
        o.status = "paid";
        o.paidAt = Date.now();
      } else if (action === "cancel") {
        if (o.status !== "pending") return res.status(400).json({ error: "Só pedidos aguardando pagamento podem ser cancelados." });
        o.status = "cancelled";
      } else if (action === "ship") {
        if (!["paid", "shipped"].includes(o.status)) return res.status(400).json({ error: "Confirme o pagamento antes de enviar." });
        const code = String((req.body || {}).tracking || "").trim().toUpperCase();
        if (!TRACKING_RE.test(code)) return res.status(400).json({ error: "Código inválido. Exemplo: AA123456789BR" });
        o.tracking = code;
        if (o.status === "paid") { o.status = "shipped"; o.shippedAt = Date.now(); }
      } else if (action === "deliver") {
        if (o.status !== "shipped") return res.status(400).json({ error: "O pedido precisa estar enviado." });
        o.status = "delivered";
        o.deliveredAt = Date.now();
      } else {
        return res.status(400).json({ error: "Ação inválida" });
      }
      await S.saveOrder(o);
      return res.status(200).json({ order: o });
    }

    return res.status(405).json({ error: "Método não permitido" });
  } catch (e) {
    console.error("admin", e);
    return res.status(500).json({ error: "Erro interno" });
  }
};
