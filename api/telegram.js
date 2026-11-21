"use strict";
const S = require("../lib/store");

/* Recebe o toque no botão "Confirmar pagamento" do Telegram (webhook do bot).
   Só aceita chamadas do Telegram (segredo) e só do seu chat. */
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || !S.safeEqual(req.headers["x-telegram-bot-api-secret-token"] || "", secret)) {
    return res.status(401).end();
  }

  try {
    const cq = (req.body || {}).callback_query;
    if (!cq) return res.status(200).json({ ok: true });

    const owner = String(process.env.TELEGRAM_CHAT_ID || "");
    const chatId = cq.message && cq.message.chat && String(cq.message.chat.id);
    if (!owner || chatId !== owner || String(cq.from && cq.from.id) !== owner) {
      await S.tg("answerCallbackQuery", { callback_query_id: cq.id });
      return res.status(200).json({ ok: true });
    }

    const m = /^c:([a-f0-9]{20})$/.exec(cq.data || "");
    if (!m) {
      await S.tg("answerCallbackQuery", { callback_query_id: cq.id });
      return res.status(200).json({ ok: true });
    }

    const o = await S.getOrder(m[1]);
    let answer, confirmed = false;
    if (!o) {
      answer = "Pedido não encontrado.";
    } else if (o.status === "pending" || o.status === "cancelled") {
      o.status = "paid";
      o.paidAt = Date.now();
      await S.saveOrder(o);
      answer = "Pagamento confirmado!";
      confirmed = true;
    } else {
      answer = "Esse pedido já estava confirmado.";
    }

    await S.tg("answerCallbackQuery", { callback_query_id: cq.id, text: answer });
    if (confirmed || (o && o.status !== "pending")) {
      const hora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
      await S.tg("editMessageText", {
        chat_id: cq.message.chat.id,
        message_id: cq.message.message_id,
        text: (cq.message.text || "") + `\n\n✅ Pagamento confirmado (${hora}). Falta enviar e lançar o rastreio no painel.`,
        disable_web_page_preview: true
      });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("telegram", e);
    return res.status(500).end();
  }
};
