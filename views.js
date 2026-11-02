(function () {
  "use strict";
  const S = window.OrbitStore;

  const esc = s => String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  const PR = { low: "Низький", mid: "Середній", high: "Високий" };

  const prOptions = sel => Object.entries(PR)
    .map(([k, v]) => `<option value="${k}"${k === sel ? " selected" : ""}>${v}</option>`)
    .join("");

  const bar = p => `<div class="bar"><i style="width:${p}%"></i></div>`;

  function left(d) {
    const n = Math.ceil((new Date(d + "T00:00") - new Date(S.iso() + "T00:00")) / 864e5);
    return n < 0 ? `Прострочено на ${-n} дн.` : n === 0 ? "Термін: сьогодні" : `Залишилося ${n} дн.`;
  }

  function ring(s) {
    const C = 2 * Math.PI * 54, p = S.xpIn(s) / S.XP_PER_LEVEL;

    return `<div class="ring">
      <svg viewBox="0 0 128 128"><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style="stop-color:var(--a1)"/><stop offset="1" style="stop-color:var(--a2)"/></linearGradient></defs>
        <circle cx="64" cy="64" r="54" class="ring-bg"/>
        <circle cx="64" cy="64" r="54" class="ring-fg" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - p)}" transform="rotate(-90 64 64)"/></svg>
      <div class="ring-n"><b>${S.level(s)}</b><span>рівень</span></div></div>`;
  }

  function taskItem(t) {
    return `<li class="item ${t.done ? "done" : ""}">
      <button class="check" data-action="toggle-task" data-id="${t.id}" aria-label="Позначити виконаним">${t.done ? "✓" : ""}</button>
      <div class="grow"><span class="title">${esc(t.title)}</span>
        <small><span class="tag">${esc(t.cat)}</span><span class="tag p-${t.priority}">${PR[t.priority]}</span><span class="tag xp">+${S.XP[t.priority]} XP</span></small></div>
      <button class="icon" data-action="del-task" data-id="${t.id}" aria-label="Видалити">×</button></li>`;
  }

  const V = {};

  V.home = s => `
    <section class="hero">
      <div class="hero-text">
        <h1>Виведи свої цілі на орбіту</h1>
        <p>ORBIT об'єднує цілі, завдання та звички в одну систему. Виконуй завдання, отримуй XP та спостерігай, як зростає твій рівень.</p>
        <div class="row">
          <a class="btn" href="#/dashboard">Почати</a>
          <a class="btn ghost" href="#features" data-scroll="features">Дізнатися більше</a>
        </div>
      </div>
      <div class="system" aria-hidden="true">
        <div class="sun">${S.level(s)}</div>
        <div class="orb o1"><i></i></div><div class="orb o2"><i></i></div><div class="orb o3"><i></i><i class="m"></i></div>
      </div>
    </section>
    <section id="features" class="features">
      <h2>Одна система замість п'яти застосунків</h2>
      <a class="feat" href="#/goals"><b>Цілі</b><span>Терміни, пріоритети та прогрес. Зараз у системі: ${s.goals.length}.</span></a>
      <a class="feat" href="#/tasks"><b>Завдання</b><span>Кожне виконане завдання приносить XP. Активних: ${s.tasks.filter(t => !t.done).length}.</span></a>
      <a class="feat" href="#/habits"><b>Звички</b><span>Щоденні позначки та календар активності. Звичок: ${s.habits.length}.</span></a>
      <a class="feat" href="#/achievements"><b>Досягнення</b><span>Рівні та нагороди за серії. Відкрито: ${Object.keys(s.unlocked).length} із ${S.ACH.length}.</span></a>
    </section>`;

  V.dashboard = s => {
    const h = new Date().getHours(),
      hi = h < 6 ? "Доброї ночі" : h < 12 ? "Доброго ранку" : h < 18 ? "Добрий день" : "Добрий вечір";

    const wk = S.week(s), max = Math.max(1, ...wk.map(d => d.count));
    const today = S.iso(), doneToday = s.tasks.filter(t => t.doneAt === today).length;

    const goals = s.goals.slice().sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 3);
    const tasks = s.tasks.filter(t => !t.done).slice(0, 4);

    return `
    <header class="page-head"><h1>${hi}, <button class="name" data-action="rename" title="Змінити ім'я">${esc(s.name)}</button></h1>
      <p>${S.titleOf(S.level(s))}. До наступного рівня залишилося ${S.XP_PER_LEVEL - S.xpIn(s)} XP.</p></header>
    <div class="grid dash">
      <section class="card level">${ring(s)}<div><b class="big">${s.xp} XP</b><p class="muted">усього досвіду</p></div></section>
      <section class="card stat"><b class="big">${S.streak(s)}</b><p class="muted">днів поспіль</p></section>
      <section class="card stat"><b class="big">${doneToday}</b><p class="muted">завдань виконано сьогодні</p></section>
      <section class="card stat"><b class="big">${S.doneCount(s)}</b><p class="muted">завдань виконано загалом</p></section>
      <section class="card wide"><h3>Прогрес за тиждень</h3>
        <div class="week">${wk.map(d => `<div class="day"><div class="col"><i style="height:${d.count / max * 100}%"></i></div><b>${d.count}</b><span>${d.label}</span></div>`).join("")}</div></section>
      <section class="card"><h3>Активні цілі</h3>${goals.map(g => `<div class="mini"><span>${esc(g.title)}<b>${g.progress}%</b></span>${bar(g.progress)}</div>`).join("") || '<p class="muted">Цілей поки немає.</p>'}
        <a class="more" href="#/goals">Усі цілі</a></section>
      <section class="card"><h3>Найближчі завдання</h3><ul class="list">${tasks.map(taskItem).join("") || '<li class="muted">Усі завдання виконано.</li>'}</ul>
        <a class="more" href="#/tasks">Усі завдання</a></section>
    </div>`;
  };

  V.goals = (s, ui) => {
    const e = s.goals.find(g => g.id === ui.editGoal) || {};
    const list = s.goals.slice().sort((a, b) => a.deadline.localeCompare(b.deadline));

    return `
    <header class="page-head"><h1>Цілі</h1><p>Великі орієнтири на шляху до успіху. Змінюй прогрес за допомогою кнопок, а за 100% отримуй бонусні XP.</p></header>
    <form class="card form" data-form="goal">
      <input type="hidden" name="id" value="${e.id || ""}">
      <label class="grow">Назва цілі<input name="title" required maxlength="60" value="${esc(e.title || "")}" placeholder="Наприклад: скласти іспит"></label>
      <label>Термін<input name="deadline" type="date" required value="${e.deadline || S.ago(-30)}"></label>
      <label>Пріоритет<select name="priority">${prOptions(e.priority || "mid")}</select></label>
      <button class="btn" type="submit">${e.id ? "Зберегти" : "Додати ціль"}</button>
      ${e.id ? '<button class="btn ghost" type="button" data-action="cancel-edit">Скасувати</button>' : ""}
    </form>
    <ul class="list">${list.map(g => `
      <li class="card goal">
        <div class="grow"><span class="title">${esc(g.title)}</span>
          <small><span class="tag p-${g.priority}">${PR[g.priority]}</span><span class="tag">${left(g.deadline)}</span></small>
          ${bar(g.progress)}</div>
        <b class="pct">${g.progress}%</b>
        <div class="acts">
          <button class="icon" data-action="goal-step" data-id="${g.id}" data-d="-10" aria-label="Зменшити">−</button>
          <button class="icon" data-action="goal-step" data-id="${g.id}" data-d="10" aria-label="Збільшити">+</button>
          <button class="icon" data-action="edit-goal" data-id="${g.id}" aria-label="Редагувати">✎</button>
          <button class="icon" data-action="del-goal" data-id="${g.id}" aria-label="Видалити">×</button>
        </div></li>`).join("") || '<li class="muted">Цілей немає. Додай першу вище.</li>'}</ul>`;
  };

  V.tasks = (s, ui) => {
    const f = ui.filter, w = { high: 0, mid: 1, low: 2 };

    const list = s.tasks.filter(t => f === "all" || (f === "done" ? t.done : !t.done))
      .sort((a, b) => a.done - b.done || w[a.priority] - w[b.priority]);

    const tab = (v, n) => `<button class="tab ${f === v ? "on" : ""}" data-action="filter" data-v="${v}">${n}</button>`;

    return `
    <header class="page-head"><h1>Завдання</h1><p>Виконуй завдання та отримуй XP: низький пріоритет — 10, середній — 20, високий — 40.</p></header>
    <form class="card form" data-form="task">
      <label class="grow">Нове завдання<input name="title" required maxlength="80" placeholder="Що потрібно зробити?"></label>
      <label>Категорія<select name="cat"><option>Навчання</option><option>Робота</option><option>Здоров'я</option><option>Дім</option><option>Інше</option></select></label>
      <label>Пріоритет<select name="priority">${prOptions("mid")}</select></label>
      <button class="btn" type="submit">Додати</button>
    </form>
    <div class="tabs">${tab("all", "Усі")}${tab("active", "Активні")}${tab("done", "Завершені")}</div>
    <ul class="list card">${list.map(taskItem).join("") || '<li class="muted">У цьому списку поки порожньо.</li>'}</ul>`;
  };

  V.habits = s => {
    const days = [6, 5, 4, 3, 2, 1, 0].map(n => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return { date: S.iso(d), l: ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"][d.getDay()] };
    });

    const act = S.activity(s), max = Math.max(1, ...Object.values(act));

    const start = new Date();
    start.setDate(start.getDate() - 34);

    const pad = (start.getDay() + 6) % 7;
    let cells = '<i class="cell empty"></i>'.repeat(pad);

    for (let n = 34; n >= 0; n--) {
      const d = S.ago(n), c = act[d] || 0;
      cells += `<i class="cell" style="--k:${c / max}" title="${d}: ${c}"></i>`;
    }

    return `
    <header class="page-head"><h1>Звички</h1><p>Позначай виконані дні кружечками. Кожна позначка дає 5 XP.</p></header>
    <form class="card form" data-form="habit">
      <label class="grow">Нова звичка<input name="title" required maxlength="40" placeholder="Наприклад: медитація"></label>
      <button class="btn" type="submit">Додати звичку</button>
    </form>
    <ul class="list">${s.habits.map(h => `
      <li class="card habit"><div class="grow"><span class="title">${esc(h.title)}</span>
        <small class="muted">Позначок: ${Object.keys(h.log).length}</small></div>
        <div class="dots">${days.map(d => `<button class="dot ${h.log[d.date] ? "on" : ""}" data-action="toggle-habit" data-id="${h.id}" data-date="${d.date}" aria-label="${d.l}, ${d.date}"><span>${d.l}</span></button>`).join("")}</div>
        <button class="icon" data-action="del-habit" data-id="${h.id}" aria-label="Видалити">×</button></li>`).join("") || '<li class="muted">Звичок немає.</li>'}</ul>
    <section class="card"><h3>Календар активності</h3>
      <div class="cal"><b>Пн</b><b>Вт</b><b>Ср</b><b>Чт</b><b>Пт</b><b>Сб</b><b>Нд</b>${cells}</div>
      <p class="muted">Чим яскравіша клітинка, тим більше дій було виконано за день.</p></section>`;
  };


  V.achievements = s => `
    <header class="page-head"><h1>Досягнення</h1><p>Відкрито ${Object.keys(s.unlocked).length} із ${S.ACH.length}.</p></header>
    <section class="card level">${ring(s)}<div><b class="big">${S.titleOf(S.level(s))}</b><p class="muted">${S.xpIn(s)} / ${S.XP_PER_LEVEL} XP до наступного рівня</p></div></section>
    <div class="grid ach">${S.ACH.map(a => {
      const [cur, need] = a.progress(s), ok = !!s.unlocked[a.id], p = Math.min(100, Math.round(cur / need * 100));

      return `<section class="card badge ${ok ? "ok" : ""}"><div class="medal">${ok ? "★" : "☆"}</div>
        <b>${a.title}</b><p class="muted">${a.desc}</p>${bar(p)}<small>${ok ? "Відкрито " + s.unlocked[a.id] : Math.min(cur, need) + " / " + need}</small></section>`;
    }).join("")}</div>`;

  window.OrbitViews = V;
})();
