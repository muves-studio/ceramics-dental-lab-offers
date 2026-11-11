// Ceramics Dental Lab offer pages: the teeth the visitor can move, reveals, picture cards, the form, and what the visitor did.
(() => {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  // ---- what the visitor did. Nothing typed is ever sent, only that something was reached. ----
  const q = new URLSearchParams(location.search), sid = Math.random().toString(36).slice(2, 10), t0 = performance.now();
  // vid: a random id kept in this browser so a second visit is known to be the same browser. It holds nothing about the person.
  let vid = ""; try { vid = localStorage.getItem("cdl_vid") || ""; if (!vid) { vid = Math.random().toString(36).slice(2, 12); localStorage.setItem("cdl_vid", vid); } } catch {}
  let ref = ""; try { ref = document.referrer ? new URL(document.referrer).hostname.slice(0, 60) : ""; } catch {}
  const bot = navigator.webdriver ? 1 : 0, src = (q.get("utm_source") || q.get("s") || "").slice(0, 40);                      // automated browsers (including our own page captures) mark themselves
  const API = document.documentElement.dataset.api || "";      // where sign-ups and clicks are posted; empty = this same server
  // data-api-query="k": post to <API>?k=<name> (the PHP queue, godaddy/offers/q.php) instead of <API>/<name> (the Netlify queue). Unset = the old way.
  const QS = document.documentElement.dataset.apiQuery || "";
  const ep = n => QS ? `${API}?${encodeURIComponent(QS)}=${n}` : `${API}/${n}`;
  const send = (e, more = {}) => navigator.sendBeacon?.(ep("t"), JSON.stringify({ e, sid, vid, bot, page: document.body.dataset.page, d: q.get("d") || "", variant: (q.get("v") || "").slice(0, 40) + "~" + vid + "~" + bot, src, w: innerWidth, ...more }));
  // The queue function deployed on 2026-11-10 keeps only its original fields, and the host is refusing new deploys until its
  // monthly credits reset. So the visitor id and bot flag ride inside `variant`, and the view details inside `el`;
  // tools/pull.py unpacks them. The plain fields are sent too and will be kept once the function can be redeployed.
  send("view", { ref, vh: innerHeight, el: `ref=${ref};vh=${innerHeight};src=${src}` });
  addEventListener("load", () => setTimeout(() => { const n = performance.getEntriesByType("navigation")[0]; if (n) send("load", { v: Math.round(n.loadEventEnd || n.domContentLoadedEventEnd || 0) }); }, 0));

  // ---- the teeth: three renders of one arch from one camera; the slider fades through them ----
  const viewer = document.querySelector(".viewer");
  if (viewer) {
    const frames = [...viewer.querySelectorAll(".frames img")], range = viewer.querySelector("input"), label = viewer.querySelector("[data-step]");
    const show = p => {
      frames[1].style.opacity = clamp(p / .5).toFixed(3); frames[2].style.opacity = clamp((p - .5) / .5).toFixed(3);
      range.style.setProperty("--p", (p * 100).toFixed(1) + "%"); label.textContent = "Step " + (1 + Math.round(p * 9)) + " of 10";
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
  form?.addEventListener("submit", async e => {
    e.preventDefault();
    let first;
    form.querySelectorAll("[required]").forEach(f => { const bad = !f.value.trim(); f.classList.toggle("bad", bad); if (bad) first ??= f; });
    send(first ? "form_incomplete" : "form_sent", { el: form.elements.interest.value });
    if (first) return first.focus();
    const v = n => form.elements[n].value.trim(), q = new URLSearchParams(location.search);
    const who = { name: v("name"), practice: v("practice"), phone: v("phone"), email: v("email"), page: document.body.dataset.page, d: q.get("d") || "", sid };   // the browser id (vid) is NOT sent with a sign-up: tying it to a named person waits for the lawyer (review, 2026-11-11)
    submitted = true;
    // Only say "You're in" when the sign-up really arrived. If it did not, say so and give the phone number.
    const btn = form.querySelector("button[type=submit]"), done = form.querySelector(".form-done");
    btn.disabled = true; done.hidden = true;
    let ok = false;
    try { ok = (await fetch(ep("lead"), { method: "POST", keepalive: true, body: JSON.stringify({ ...who, interest: v("interest"), text_ok: form.elements.text_ok.checked, email_ok: form.elements.email_ok.checked }) })).ok; } catch { ok = false; }
    if (!ok) {
      btn.disabled = false; submitted = false; send("form_failed", { el: who.page });
      done.textContent = "That did not go through. Please call (786) 355-5727."; done.hidden = false;
      return;
    }
    // what happens next, in place of the form: who will call, and how to send a first case from their scanner
    form.replaceChildren(document.getElementById("next").content.cloneNode(true)); form.classList.add("done");
    form.querySelector("[data-phone]").textContent = who.phone;
    const how = form.querySelector(".how");
    form.querySelectorAll("[data-scanner]").forEach(b => b.addEventListener("click", () => {
      form.querySelectorAll("[data-scanner]").forEach(x => x.classList.toggle("on", x === b));
      const s = b.dataset.scanner;
      const steps = s === "No scanner" ? ["Take your impression as usual", "Carlos sets up a pickup or a shipping label", "We start when it arrives"]
        : s === "Medit" ? ["Open Medit Link", "Search Ceramics Dental Lab and add us", "Choose us when you send the scan"]
        : [`Open the lab list on your ${s}`, "Search Ceramics Dental Lab and add us", "Choose us when you send the scan"];
      how.replaceChildren(...steps.map(t => Object.assign(document.createElement("li"), { textContent: t }))); how.hidden = false;
      send("scanner", { el: s });
      pick = s; clearTimeout(pickTimer); pickTimer = setTimeout(sendPick, 4000);      // the doctor may change their mind: send the last pick once they settle, or on leaving
    }));
    let pick = "", pickTimer;
    const sendPick = () => { clearTimeout(pickTimer); if (!pick) return; const scanner = pick; pick = ""; fetch(ep("scanner"), { method: "POST", keepalive: true, body: JSON.stringify({ ...who, scanner }) }).catch(() => {}); };
    addEventListener("pagehide", sendPick);
    document.addEventListener("visibilitychange", () => { if (document.hidden) sendPick(); });
  });
  // form behaviour: when the first field was reached, which field was last touched if they leave, and the ticks. Never what was typed.
  let lastField = "", submitted = false, firstFocus = false;
  form?.querySelectorAll("input:not([type=hidden]):not([type=checkbox])").forEach(f => {
    f.addEventListener("focus", () => { lastField = f.name; if (!firstFocus) { firstFocus = true; send("first_focus", { el: f.name, v: Math.round(performance.now() - t0) }); } });
    f.addEventListener("focus", () => send("field", { el: f.name }), { once: true });
  });
  form?.querySelectorAll("input[type=checkbox]").forEach(c => c.addEventListener("change", () => send("tick", { el: c.name, v: c.checked ? 1 : 0 })));
  addEventListener("pagehide", () => { if (firstFocus && !submitted) send("abandon", { el: lastField }); });

  addEventListener("click", ev => { const t = ev.target.closest("a, button"); if (t) send("tap", { el: (t.dataset.interest || t.textContent.trim() || t.className).slice(0, 40) }); });
  const marks = [25, 50, 75, 100];
  addEventListener("scroll", () => { const pct = (scrollY + innerHeight) / document.documentElement.scrollHeight * 100; while (marks.length && pct >= marks[0]) send("scroll", { v: marks.shift() }); }, { passive: true });
  const since = new Map(), dwell = new IntersectionObserver(es => es.forEach(en => {          // seconds each section was on screen
    const name = en.target.className.split(" ")[0];
    if (en.isIntersecting) since.set(name, performance.now());
    else if (since.has(name)) { const sec = Math.round((performance.now() - since.get(name)) / 1000); since.delete(name); if (sec >= 2) send("section", { el: name, sec }); }
  }), { threshold: .4 });
  document.querySelectorAll("main > section").forEach(s => dwell.observe(s));
  // a hidden tab is not reading: close every running section timer when the tab is hidden, restart nothing until it is seen again
  document.addEventListener("visibilitychange", () => { if (document.hidden) { since.forEach((t, name) => { const sec = Math.round((performance.now() - t) / 1000); if (sec >= 2) send("section", { el: name, sec }); }); since.clear(); } });
  addEventListener("pagehide", () => since.forEach((t0, name) => send("section", { el: name, sec: Math.round((performance.now() - t0) / 1000) })));
})();
