(function () {
  "use strict";
  const S = window.OrbitStore, V = window.OrbitViews, C = window.OrbitCloud;


  const AUTHOR = {
    name: "Автор проєкту",
    role: "Студент · веб-розробка",
    about: "ORBIT — мій навчальний проєкт. Я створив його, щоб навчитися робити повноцінні вебзастосунки: від дизайну й анімацій до збереження даних у хмарі.",
    links: [{ title: "GitHub", url: "https://github.com/ilenkobogdan" }]
  };

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const msg = () => C.msg ? `<p class="pf-msg ${C.msgType}">${esc(C.msg)}</p>` : "";
  const field = (label, name, type, extra = "") =>
    `<label>${label}<input name="${name}" type="${type}" required ${extra}></label>`;

  function account() {
    const head = "<h3>Акаунт</h3>";
    if (!C.keysSet) return head + `<p class="muted">Хмарне збереження ще не налаштоване, тому прогрес зберігається лише в цьому браузері.</p>`;
    if (!C.libLoaded) return head + `<p class="pf-msg err">Не вдалося завантажити бібліотеку Supabase. Перевірте інтернет і оновіть сторінку.</p>`;
    if (!C.ready) return head + `<p class="muted">Перевіряємо вхід…</p>`;

    if (C.user && C.recovery) {                        
      return head + `<p class="muted">Придумайте новий пароль.</p>
        <form class="pf-form" data-auth="recovery">
          ${field("Новий пароль", "password", "password", 'minlength="6" autocomplete="new-password"')}
          ${field("Повторіть пароль", "password2", "password", 'minlength="6" autocomplete="new-password"')}
          <button class="btn" type="submit">Зберегти пароль</button></form>${msg()}`;
    }
    if (C.user) {
      return head + `<p class="pf-email">${esc(C.user.email)}</p>
        <p class="muted" id="pf-sync">${esc(C.statusText())}</p>
        <div class="row"><button class="btn" data-pf="sync">Синхронізувати зараз</button>
        <button class="btn ghost" data-pf="signout">Вийти</button></div>${msg()}`;
    }

    const tab = (m, t) => `<button class="tab ${C.mode === m ? "on" : ""}" data-pf="mode" data-v="${m}" type="button">${t}</button>`;
    let form;
    if (C.mode === "register") {
      form = `<form class="pf-form" data-auth="register">
        ${field("Email", "email", "email", 'autocomplete="email"')}
        ${field("Пароль (від 6 символів)", "password", "password", 'minlength="6" autocomplete="new-password"')}
        ${field("Повторіть пароль", "password2", "password", 'minlength="6" autocomplete="new-password"')}
        <button class="btn" type="submit">Зареєструватися</button></form>`;
    } else if (C.mode === "reset") {
      form = `<p class="muted">Вкажіть email, і ми надішлемо посилання для нового пароля.</p>
        <form class="pf-form" data-auth="reset">${field("Email", "email", "email", 'autocomplete="email"')}
        <button class="btn" type="submit">Надіслати лист</button></form>
        <button class="linkbtn" data-pf="mode" data-v="login" type="button">Назад до входу</button>`;
    } else {
      form = `<form class="pf-form" data-auth="login">
        ${field("Email", "email", "email", 'autocomplete="email"')}
        ${field("Пароль", "password", "password", 'autocomplete="current-password"')}
        <button class="btn" type="submit">Увійти</button></form>
        <button class="linkbtn" data-pf="mode" data-v="reset" type="button">Забули пароль?</button>`;
    }
    const tabs = C.mode === "reset" ? "" : `<div class="tabs">${tab("login", "Вхід")}${tab("register", "Реєстрація")}</div>`;
    return head + `<p class="muted">Увійдіть, щоб зберігати прогрес у хмарі й бачити його на різних пристроях.</p>${tabs}${form}${msg()}`;
  }

  V.profile = s => {
    const lv = S.level(s), unlocked = Object.keys(s.unlocked || {}).length;
    return `
    <header class="page-head"><h1>Профіль</h1><p>Акаунт, ваш прогрес та інформація про проєкт.</p></header>
    <div class="grid pf">
      <section class="card pf-account">${account()}</section>

      <section class="card"><h3>Мій прогрес</h3>
        <p class="muted">${esc(s.name)} · ${S.titleOf(lv)}</p>
        <div class="pf-stats">
          <div><b class="big">${lv}</b><span class="muted">рівень</span></div>
          <div><b class="big">${s.xp}</b><span class="muted">XP</span></div>
          <div><b class="big">${S.streak(s)}</b><span class="muted">днів поспіль</span></div>
          <div><b class="big">${unlocked}/${S.ACH.length}</b><span class="muted">досягнень</span></div>
        </div></section>

      <section class="card"><h3>Про автора</h3>
        <p><b>${esc(AUTHOR.name)}</b><br><span class="muted">${esc(AUTHOR.role)}</span></p>
        <p class="muted">${esc(AUTHOR.about)}</p>
        <p class="muted">Технології: HTML, CSS, JavaScript, Supabase.</p>
        <div class="row">${AUTHOR.links.map(l => `<a class="btn ghost small" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)}</a>`).join("")}</div>
      </section>
    </div>

    <section class="card pf-danger"><h3>Небезпечна зона</h3>
      <p class="muted">Скидання поверне демонстраційні дані. Якщо ви увійшли в акаунт, прогрес у хмарі теж буде замінено.</p>
      <button class="btn danger" data-action="reset">Скинути дані</button></section>`;
  };

  document.addEventListener("click", async e => {
    const el = e.target.closest("[data-pf]"); if (!el) return;
    const a = el.dataset.pf;
    if (a === "mode") { C.mode = el.dataset.v; C.msg = null; C.refresh(); }
    else if (a === "signout") { try { await C.signOut(); } catch (err) { C.notify(C.friendly(err), "err"); } }
    else if (a === "sync") { try { await C.syncNow(); } catch (err) { C.notify(C.friendly(err), "err"); } }
  });

  document.addEventListener("submit", async e => {
    const f = e.target.closest("form[data-auth]"); if (!f) return;
    e.preventDefault();
    const kind = f.dataset.auth, d = Object.fromEntries(new FormData(f)), email = (d.email || "").trim();
    const btn = f.querySelector("button[type=submit]"), label = btn.textContent;
    btn.disabled = true; btn.textContent = "Зачекайте…";
    const say = (text, type) => { C.msg = text; C.msgType = type; C.refresh(); };
    try {
      if (kind === "login") { C.msg = null; await C.signIn(email, d.password); }
      else if (kind === "register") {
        if (d.password !== d.password2) return say("Паролі не збігаються.", "err");
        const r = await C.signUp(email, d.password);
        C.mode = "login";
        say(r.needsConfirm ? `Ми надіслали лист на ${email}. Підтвердіть пошту й увійдіть.` : "Акаунт створено.", "ok");
      } else if (kind === "reset") {
        await C.resetPassword(email);
        say(`Якщо акаунт ${email} існує, лист із посиланням уже в дорозі.`, "ok");
      } else if (kind === "recovery") {
        if (d.password !== d.password2) return say("Паролі не збігаються.", "err");
        await C.setPassword(d.password);
        say("Пароль змінено.", "ok");
      }
    } catch (err) {
      say(C.friendly(err), "err");
    } finally { btn.disabled = false; btn.textContent = label; }
  });


  const nav = document.querySelector(".nav");
  if (nav && !nav.querySelector('[data-route="profile"]')) {
    const a = document.createElement("a");
    a.dataset.route = "profile"; a.href = "#/profile"; a.textContent = "Профіль"; nav.appendChild(a);
  }
  const chip = document.getElementById("chip");
  if (chip) chip.addEventListener("click", () => { location.hash = "#/profile"; });

  document.querySelectorAll('.foot [data-action="reset"], .foot > span').forEach(el => el.remove());
})();
