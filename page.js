// Custom Dental aligner page: the teeth the visitor can move, reveals, picture cards, the form, and what the visitor did.
(() => {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  // ---- what the visitor did. Nothing typed is ever sent, only that something was reached. ----
  const q = new URLSearchParams(location.search), sid = Math.random().toString(36).slice(2, 10);
  const API = document.documentElement.dataset.api || "";      // where sign-ups and clicks are posted; empty = this same server
  const send = (e, more = {}) => navigator.sendBeacon?.(API + "/t", JSON.stringify({ e, sid, page: document.body.dataset.page, d: q.get("d") || "", variant: q.get("v") || "", w: innerWidth, ...more }));
  send("view");

  // ---- the teeth: three renders of one arch from one camera; the slider fades through them ----
  const viewer = document.querySelector(".viewer");
  if (viewer) {
    const frames = [...viewer.querySelectorAll(".frames img")], range = viewer.querySelector("input"), label = viewer.querySelector("[data-step]");
    const show = p => {
      frames[1].style.opacity = clamp(p / .5).toFixed(3); frames[2].style.opacity = clamp((p - .5) / .5).toFixed(3);
      range.style.setProperty("--p", (p * 100).toFixed(1) + "%"); label.textContent = "Step " + (1 + Math.round(p * 9));
    };
    let touched = false, playing = false, furthest = 0;
    const play = () => {                     // plays through once when first seen, until the visitor takes over
      if (playing || touched || still) return; playing = true; const t0 = performance.now(), D = 3600;
      const tick = t => { if (touched) return; const k = clamp((t - t0) / D), p = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; range.value = p * 100; show(p); if (k < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    };
    range.addEventListener("input", () => { touched = true; const p = range.value / 100; show(p); furthest = Math.max(furthest, p); });
    range.addEventListener("change", () => send("teeth", { v: Math.round(furthest * 100) }));
    new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { play(); o.disconnect(); } }), { threshold: .5 }).observe(viewer);
    show(still ? 1 : 0); if (still) range.value = 100;
  }

  // ---- things rise in once ----
  const seen = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); seen.unobserve(e.target); } }), { threshold: .12 });
  document.querySelectorAll(".reveal").forEach(n => seen.observe(n));

  // ---- the form. Posts to /lead (tools/leads.py files it in the CRM), then shows what happens next and asks which scanner (/scanner). ----
  const form = document.querySelector(".form");
  document.querySelectorAll("[data-interest]").forEach(a => a.addEventListener("click", () => { form.elements.interest.value = a.dataset.interest; }));
  document.querySelectorAll('a[href="#start"]').forEach(a => a.addEventListener("click", () => setTimeout(() => form.elements.name.focus({ preventScroll: true }), 700)));
  form?.addEventListener("submit", e => {
    e.preventDefault();
    let first;
    form.querySelectorAll("[required]").forEach(f => { const bad = !f.value.trim(); f.classList.toggle("bad", bad); if (bad) first ??= f; });
    send(first ? "form_incomplete" : "form_sent", { el: form.elements.interest.value });
    if (first) return first.focus();
    const v = n => form.elements[n].value.trim(), q = new URLSearchParams(location.search);
    const who = { name: v("name"), practice: v("practice"), phone: v("phone"), email: v("email"), page: document.body.dataset.page, d: q.get("d") || "" };
    fetch(API + "/lead", { method: "POST", mode: "no-cors", keepalive: true, body: JSON.stringify({ ...who, interest: v("interest"), text_ok: form.elements.text_ok.checked, email_ok: form.elements.email_ok.checked }) }).catch(() => {});
    // what happens next, in place of the form: who will call, and how to send a first case from their scanner
    form.replaceChildren(document.getElementById("next").content.cloneNode(true)); form.classList.add("done");
    form.querySelector("[data-phone]").textContent = who.phone;
    const how = form.querySelector(".how");
    form.querySelectorAll("[data-scanner]").forEach(b => b.addEventListener("click", () => {
      form.querySelectorAll("[data-scanner]").forEach(x => x.classList.toggle("on", x === b));
      const s = b.dataset.scanner;
      const steps = s === "No scanner" ? ["Take your impression as usual", "We pick it up from your office", "Or ship FedEx with our label"]
        : s === "Medit" ? ["Open Medit Link", "Search Ceramics Dental Lab and add us", "Choose us when you send the scan"]
        : [`Open the lab list on your ${s}`, "Search Ceramics Dental Lab and add us", "Choose us when you send the scan"];
      how.replaceChildren(...steps.map(t => Object.assign(document.createElement("li"), { textContent: t }))); how.hidden = false;
      send("scanner", { el: s });
      fetch(API + "/scanner", { method: "POST", mode: "no-cors", keepalive: true, body: JSON.stringify({ ...who, scanner: s }) }).catch(() => {});
    }));
  });
  form?.querySelectorAll("input:not([type=hidden]):not([type=checkbox])").forEach(f => f.addEventListener("focus", () => send("field", { el: f.name }), { once: true }));

  addEventListener("click", ev => { const t = ev.target.closest("a, button"); if (t) send("tap", { el: (t.dataset.interest || t.textContent.trim() || t.className).slice(0, 40) }); });
  const marks = [25, 50, 75, 100];
  addEventListener("scroll", () => { const pct = (scrollY + innerHeight) / document.documentElement.scrollHeight * 100; while (marks.length && pct >= marks[0]) send("scroll", { v: marks.shift() }); }, { passive: true });
  const since = new Map(), dwell = new IntersectionObserver(es => es.forEach(en => {          // seconds each section was on screen
    const name = en.target.className.split(" ")[0];
    if (en.isIntersecting) since.set(name, performance.now());
    else if (since.has(name)) { const sec = Math.round((performance.now() - since.get(name)) / 1000); since.delete(name); if (sec >= 2) send("section", { el: name, sec }); }
  }), { threshold: .4 });
  document.querySelectorAll("main > section").forEach(s => dwell.observe(s));
  addEventListener("pagehide", () => since.forEach((t0, name) => send("section", { el: name, sec: Math.round((performance.now() - t0) / 1000) })));
})();
