"use strict";
/* Diagnóstico da configuração, sem mostrar nenhum valor secreto.
   Abra: https://SEU-SITE/api/health?p=SUA_ADMIN_PASSWORD */
const S = require("../lib/store");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const pass = process.env.ADMIN_PASSWORD;
  const given = String((req.query && req.query.p) || "");
  if (!pass || !S.safeEqual(given, pass)) return res.status(401).json({ error: "Senha incorreta" });

  const e = process.env;
  const has = k => !!(e[k] && String(e[k]).trim());
  const out = { variaveis: {}, problemas: [] };

  for (const k of ["PIX_KEY", "ADMIN_PASSWORD", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "TELEGRAM_WEBHOOK_SECRET"])
    if (!(out.variaveis[k] = has(k) ? "ok" : "FALTA")) out.problemas.push(k + " não está configurada");
  for (const k of ["PIX_NAME", "PIX_CITY", "SITE_URL", "STORE_WHATSAPP"]) out.variaveis[k] = has(k) ? "ok" : "não definida (opcional)";
  for (const k of Object.keys(out.variaveis)) if (out.variaveis[k] === "FALTA") out.problemas.push(k + " não está configurada");
  out.problemas = [...new Set(out.problemas)];

  if (has("TELEGRAM_WEBHOOK_SECRET") && !/^[A-Za-z0-9_-]{1,256}$/.test(e.TELEGRAM_WEBHOOK_SECRET))
    out.problemas.push("TELEGRAM_WEBHOOK_SECRET tem caractere inválido (só letras, números, _ e -)");

  /* Pix */
  try {
    if (has("PIX_KEY")) {
      const code = S.pixPayload({ key: e.PIX_KEY, name: e.PIX_NAME || "AVALANCHE GAMING", city: e.PIX_CITY || "SALVADOR", amount: 1, txid: "TESTE" });
      out.pix = { gera_codigo: true, chave_tipo: /^\d{11}$|^\d{14}$/.test(String(e.PIX_KEY).replace(/\D/g, "")) && !/[@a-z]/i.test(e.PIX_KEY) ? "CPF/CNPJ (só dígitos)" : "outra (e-mail, telefone ou aleatória)", tamanho: code.length };
    }
  } catch (err) { out.pix = { gera_codigo: false, erro: err.message }; out.problemas.push("Pix: " + err.message); }

  /* Redis */
  try {
    const k = "health:" + Date.now();
    await S.redis("SET", k, "1", "EX", "30");
    out.redis = (await S.redis("GET", k)) === "1" ? "ok (gravou e leu)" : "responde, mas não leu o que gravou";
  } catch (err) { out.redis = "ERRO: " + err.message; out.problemas.push("Redis: " + err.message); }

  /* Telegram */
  if (has("TELEGRAM_BOT_TOKEN")) {
    const me = await S.tg("getMe", {});
    if (me && me.ok) {
      out.telegram = { token: "ok", bot: "@" + me.result.username };
      const wh = await S.tg("getWebhookInfo", {});
      const url = wh && wh.result && wh.result.url;
      out.telegram.webhook = url || "NÃO ATIVADO";
      if (!url) out.problemas.push("Webhook do Telegram não está ativado (falta abrir o setWebhook)");
      else if (!/\/api\/telegram$/.test(url)) out.problemas.push("Webhook aponta para outra URL: " + url);
      if (wh && wh.result && wh.result.last_error_message) {
        out.telegram.ultimo_erro = wh.result.last_error_message;
        out.problemas.push("Telegram não conseguiu entregar: " + wh.result.last_error_message);
      }
      if (has("TELEGRAM_CHAT_ID")) {
        const ok = await S.notifyOwner("✅ Teste da Avalanche Gaming: o aviso no Telegram está funcionando.");
        out.telegram.mensagem_de_teste = ok ? "enviada, confira no Telegram" : "FALHOU (chat id errado ou você não iniciou o bot)";
        if (!ok) out.problemas.push("Não consegui mandar mensagem para o TELEGRAM_CHAT_ID");
      }
    } else {
      out.telegram = { token: "INVÁLIDO (o Telegram não reconhece)" };
      out.problemas.push("TELEGRAM_BOT_TOKEN inválido");
    }
  }

  out.resultado = out.problemas.length ? "TEM PROBLEMAS" : "TUDO CERTO";
  return res.status(200).json(out);
};
