(function () {
  "use strict";
  const S = window.OrbitStore, V = window.OrbitViews;
  const view = document.getElementById("view");
  const THEMES = ["dark", "nebula", "light"];
  const THEME_NAMES = { dark: "Темна", nebula: "Небула", light: "Світла" };

  const ui = { filter: "all", editGoal: null };

  const routeName = () => { const r = location.hash.replace("#/", ""); return V[r] && r !== "home" || r === "home" ? r : "home"; };

  function render(animate) {
    const r = routeName() || "home", s = S.state;
    document.documentElement.dataset.theme = s.theme;
    document.getElementById("theme-name").textContent = THEME_NAMES[s.theme];
    document.getElementById("chip").innerHTML = `Рів. <b>${S.level(s)}</b> · ${s.xp} XP`;
    document.querySelectorAll("[data-route]").forEach(a => a.classList.toggle("on", a.dataset.route === r));
    view.innerHTML = V[r](s, ui);
    if (animate) {
      view.classList.remove("enter"); void view.offsetWidth; view.classList.add("enter");
      window.scrollTo(0, 0);
    }
  }
  window.addEventListener("hashchange", () => render(true));
  S.onChange(() => render(false));

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-action]");
    if (el) {
      const { action, id } = el.dataset;
      if (action === "toggle-task") S.toggleTask(id);
      else if (action === "del-task") S.deleteTask(id);
      else if (action === "filter") { ui.filter = el.dataset.v; render(false); }
      else if (action === "goal-step") S.stepGoal(id, Number(el.dataset.d));
      else if (action === "edit-goal") { ui.editGoal = id; render(false); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else if (action === "cancel-edit") { ui.editGoal = null; render(false); }
      else if (action === "del-goal") { if (confirm("Видалити ціль?")) S.deleteGoal(id); }
      else if (action === "toggle-habit") S.toggleHabit(id, el.dataset.date);
      else if (action === "del-habit") { if (confirm("Видалити звичку?")) S.deleteHabit(id); }
      else if (action === "rename") { const n = prompt("Як тебе називати?", S.state.name); if (n && n.trim()) S.setName(n.trim().slice(0, 20)); }
      else if (action === "theme") S.setTheme(THEMES[(THEMES.indexOf(S.state.theme) + 1) % THEMES.length]);
      else if (action === "reset") { if (confirm("Скинути всі дані та повернути демо?")) S.reset(); }
      return;
    }
    const sc = e.target.closest("[data-scroll]");
    if (sc) { e.preventDefault(); document.getElementById(sc.dataset.scroll).scrollIntoView({ behavior: "smooth" }); }
  });

  document.addEventListener("submit", e => {
    const f = e.target.closest("form[data-form]"); if (!f) return;
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f)); d.title = (d.title || "").trim();
    if (!d.title) return;
    const kind = f.dataset.form;
    if (kind === "goal") { S.saveGoal({ ...d, id: d.id || null }); ui.editGoal = null; }
    else if (kind === "task") S.addTask(d);
    else if (kind === "habit") S.addHabit(d.title);
  });

  S.onToast((msg, type) => {
    const box = document.getElementById("toasts"), t = document.createElement("div");
    t.className = "toast " + (type || ""); t.textContent = msg; box.appendChild(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 400); }, 3000);
  });

  render(true);
  const loader = document.getElementById("loader");
  setTimeout(() => { loader.classList.add("hide"); setTimeout(() => loader.remove(), 600); }, 1400);
})();
