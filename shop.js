/* Utilidades compartilhadas das páginas de produtos */
const $ = s => document.querySelector(s);
const brl = v => Number(v).toLocaleString("pt-BR", {style:"currency", currency:"BRL"});
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function getCart(){ try{ return JSON.parse(localStorage.getItem("cart") || "{}") || {}; }catch(_){ return {}; } }
function setCart(c){ try{ localStorage.setItem("cart", JSON.stringify(c)); }catch(_){} showCount(); }
function showCount(){ const n = Object.values(getCart()).reduce((a,b)=>a+(Number(b)||0),0); const el = $("#count"); if(el) el.textContent = n; }
function addToCart(id, qty){ const c = getCart(); c[id] = Math.min(10, (c[id]||0) + (qty||1)); setCart(c); }
function toast(t){ const el = $("#toast"); if(!el) return; el.textContent = t; el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(()=>el.classList.remove("on"), 2400); }

(function init(){
  const y = $("#year"); if(y) y.textContent = new Date().getFullYear();
  showCount();
  let id = null; try{ id = localStorage.getItem("lastOrder"); }catch(_){}
  const a = $("#myOrder");
  if(id && a){ a.href = "/order?id=" + encodeURIComponent(id); a.style.display = ""; }
  const t = $("#top");
  if(t){ addEventListener("scroll", () => t.classList.toggle("on", scrollY > 500), {passive:true}); t.onclick = () => scrollTo({top:0, behavior:"smooth"}); }
})();
