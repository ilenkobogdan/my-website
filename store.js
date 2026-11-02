/* ==========================================================
   store.js — «мозг» данных ORBIT.
   Здесь: состояние (state), сохранение в localStorage, правила XP,
   уровни, достижения, серия дней (streak) и демо-данные.
   Интерфейс (views.js, app.js) данные НЕ меняет напрямую,
   а вызывает методы OrbitStore. Для будущего backend
   заменишь только функции load() и save().
   ========================================================== */
(function () {
  "use strict";

  const KEY = "orbit:v1";
  const XP_PER_LEVEL = 200;                       // сколько XP нужно на один уровень
  const XP = { low: 10, mid: 20, high: 40 };      // награда за задачу по приоритету
  const HABIT_XP = 5, GOAL_BONUS = 50;
  const TITLES = ["Новичок", "Исследователь", "Навигатор", "Пилот", "Командор", "Архитектор звёзд"];

  /* ---------- Помощники ---------- */
  const iso = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };  // ago(-5) = через 5 дней
  const uid = () => Math.random().toString(36).slice(2, 9);
  const logOf = days => Object.fromEntries(days.map(n => [ago(n), true]));

  /* ---------- Демо-данные (первый запуск) ---------- */
  function demo() {
    return {
      name: "Пилот", theme: "dark", xp: 260, unlocked: {},
      goals: [
        { id: uid(), title: "Выучить JavaScript", deadline: ago(-30), priority: "high", progress: 40 },
        { id: uid(), title: "Собрать портфолио", deadline: ago(-60), priority: "mid", progress: 20 },
        { id: uid(), title: "Читать по 20 страниц в день", deadline: ago(-14), priority: "low", progress: 70 }
      ],
      tasks: [
        { id: uid(), title: "Пройти урок по DOM", cat: "Учёба", priority: "mid", done: true, doneAt: ago(0) },
        { id: uid(), title: "Сделать зарядку 15 минут", cat: "Здоровье", priority: "low", done: true, doneAt: ago(1) },
        { id: uid(), title: "Написать план проекта", cat: "Работа", priority: "high", done: true, doneAt: ago(2) },
        { id: uid(), title: "Разобрать входящие письма", cat: "Работа", priority: "low", done: false },
        { id: uid(), title: "Сверстать страницу «Контакты»", cat: "Учёба", priority: "high", done: false },
        { id: uid(), title: "Прогуляться вечером", cat: "Здоровье", priority: "mid", done: false }
      ],
      habits: [
        { id: uid(), title: "Зарядка", log: logOf([0, 1, 2, 4, 5, 8, 9, 10, 12]) },
        { id: uid(), title: "Чтение", log: logOf([1, 2, 3, 6, 7, 9]) },
        { id: uid(), title: "Вода 2 литра", log: logOf([0, 1, 3, 4, 5, 6, 11, 13]) }
      ]
    };
  }

  /* ---------- Сохранение (localStorage) ---------- */
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch (e) { /* повреждённые данные — берём демо */ }
    return demo();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* хранилище недоступно */ } }

  let state = load();
  const changeFns = [], toastFns = [];
  const toast = (msg, type) => toastFns.forEach(f => f(msg, type));

  /* ---------- Вычисляемые значения ---------- */
  const level = s => Math.floor(s.xp / XP_PER_LEVEL) + 1;
  const xpIn = s => s.xp % XP_PER_LEVEL;
  const titleOf = lv => TITLES[Math.min(lv - 1, TITLES.length - 1)];

  /* «Активность» = задачи, выполненные в день, + отметки привычек */
  function activity(s) {
    const m = {};
    s.tasks.forEach(t => { if (t.done && t.doneAt) m[t.doneAt] = (m[t.doneAt] || 0) + 1; });
    s.habits.forEach(h => Object.keys(h.log).forEach(d => { if (h.log[d]) m[d] = (m[d] || 0) + 1; }));
    return m;
  }
  /* Серия: сколько дней подряд была активность (если сегодня ещё пусто, считаем со вчера) */
  function streak(s) {
    const a = activity(s); let n = 0, i = a[ago(0)] ? 0 : 1;
    while (a[ago(i)]) { n++; i++; }
    return n;
  }
  function week(s) {
    const a = activity(s), names = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
    return [6, 5, 4, 3, 2, 1, 0].map(i => {
      const d = new Date(); d.setDate(d.getDate() - i);
      return { date: iso(d), label: names[d.getDay()], count: a[iso(d)] || 0 };
    });
  }
  const doneCount = s => s.tasks.filter(t => t.done).length;
  const habitChecks = s => s.habits.reduce((n, h) => n + Object.values(h.log).filter(Boolean).length, 0);

  /* ---------- Достижения: progress() возвращает [сейчас, нужно] ---------- */
  const ACH = [
    { id: "first", title: "Первый запуск", desc: "Выполни первую задачу", progress: s => [doneCount(s), 1] },
    { id: "ten", title: "Десятка", desc: "Выполни 10 задач", progress: s => [doneCount(s), 10] },
    { id: "lvl3", title: "Третья орбита", desc: "Достигни 3 уровня", progress: s => [level(s), 3] },
    { id: "lvl5", title: "Дальний рейс", desc: "Достигни 5 уровня", progress: s => [level(s), 5] },
    { id: "st3", title: "Разгон", desc: "Серия 3 дня подряд", progress: s => [streak(s), 3] },
    { id: "st7", title: "Неделя в космосе", desc: "Серия 7 дней подряд", progress: s => [streak(s), 7] },
    { id: "goal", title: "Цель достигнута", desc: "Доведи любую цель до 100%", progress: s => [s.goals.some(g => g.progress >= 100) ? 1 : 0, 1] },
    { id: "rhythm", title: "Ритм", desc: "Отметь привычки 20 раз", progress: s => [habitChecks(s), 20] }
  ];

  /* ---------- Любое изменение идёт через act(): уровень, достижения, сохранение, обновление экрана ---------- */
  function act(fn) {
    const before = level(state);
    fn();
    const now = level(state);
    if (now > before) toast(`Новый уровень: ${now}. Ты теперь ${titleOf(now)}`, "level");
    ACH.forEach(a => {
      const [cur, need] = a.progress(state);
      if (!state.unlocked[a.id] && cur >= need) { state.unlocked[a.id] = iso(); toast("Достижение: " + a.title, "ach"); }
    });
    save(); changeFns.forEach(f => f());
  }
  const find = (list, id) => list.find(x => x.id === id);

  window.OrbitStore = {
    get state() { return state; },
    XP, XP_PER_LEVEL, ACH, iso, ago, level, xpIn, titleOf, activity, streak, week, doneCount,
    onChange: f => changeFns.push(f), onToast: f => toastFns.push(f),

    /* Задачи */
    addTask: ({ title, cat, priority }) => act(() => state.tasks.push({ id: uid(), title, cat, priority, done: false })),
    toggleTask: id => act(() => {
      const t = find(state.tasks, id); t.done = !t.done;
      if (t.done) { t.doneAt = iso(); state.xp += XP[t.priority]; toast(`+${XP[t.priority]} XP: ${t.title}`, "xp"); }
      else { t.doneAt = null; state.xp = Math.max(0, state.xp - XP[t.priority]); }
    }),
    deleteTask: id => act(() => { state.tasks = state.tasks.filter(t => t.id !== id); }),

    /* Цели */
    saveGoal: ({ id, title, deadline, priority }) => act(() => {
      if (id) Object.assign(find(state.goals, id), { title, deadline, priority });
      else state.goals.push({ id: uid(), title, deadline, priority, progress: 0 });
    }),
    stepGoal: (id, d) => act(() => {
      const g = find(state.goals, id);
      g.progress = Math.max(0, Math.min(100, g.progress + d));
      if (g.progress === 100 && !g.rewarded) { g.rewarded = true; state.xp += GOAL_BONUS; toast(`Цель выполнена! +${GOAL_BONUS} XP`, "xp"); }
    }),
    deleteGoal: id => act(() => { state.goals = state.goals.filter(g => g.id !== id); }),

    /* Привычки */
    addHabit: title => act(() => state.habits.push({ id: uid(), title, log: {} })),
    toggleHabit: (id, date) => act(() => {
      const h = find(state.habits, id);
      if (h.log[date]) { delete h.log[date]; state.xp = Math.max(0, state.xp - HABIT_XP); }
      else { h.log[date] = true; state.xp += HABIT_XP; toast(`+${HABIT_XP} XP: ${h.title}`, "xp"); }
    }),
    deleteHabit: id => act(() => { state.habits = state.habits.filter(h => h.id !== id); }),

    /* Профиль и настройки */
    setName: n => act(() => { state.name = n; }),
    setTheme: t => act(() => { state.theme = t; }),
    reset: () => { state = demo(); save(); changeFns.forEach(f => f()); }
  };
})();
