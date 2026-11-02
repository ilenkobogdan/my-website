(function () {
  "use strict";

  const KEY = "orbit:v1";
  const XP_PER_LEVEL = 200;                       
  const XP = { low: 10, mid: 20, high: 40 };     
  const HABIT_XP = 5, GOAL_BONUS = 50;
  const TITLES = ["Новачок", "Дослідник", "Навігатор", "Пілот", "Командор", "Архітектор зірок"];

  const iso = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

  const ago = n => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return iso(d);
  };

  const uid = () => Math.random().toString(36).slice(2, 9);
  const logOf = days => Object.fromEntries(days.map(n => [ago(n), true]));

  function demo() {
    return {
      name: "Пілот", theme: "dark", xp: 260, unlocked: {},

      goals: [
        { id: uid(), title: "Вивчити JavaScript", deadline: ago(-30), priority: "high", progress: 40 },
        { id: uid(), title: "Створити портфоліо", deadline: ago(-60), priority: "mid", progress: 20 },
        { id: uid(), title: "Читати по 20 сторінок щодня", deadline: ago(-14), priority: "low", progress: 70 }
      ],

      tasks: [
        { id: uid(), title: "Пройти урок з DOM", cat: "Навчання", priority: "mid", done: true, doneAt: ago(0) },
        { id: uid(), title: "Зробити зарядку протягом 15 хвилин", cat: "Здоров'я", priority: "low", done: true, doneAt: ago(1) },
        { id: uid(), title: "Написати план проєкту", cat: "Робота", priority: "high", done: true, doneAt: ago(2) },
        { id: uid(), title: "Розібрати вхідні листи", cat: "Робота", priority: "low", done: false },
        { id: uid(), title: "Створити сторінку «Контакти»", cat: "Навчання", priority: "high", done: false },
        { id: uid(), title: "Прогулятися ввечері", cat: "Здоров'я", priority: "mid", done: false }
      ],

      habits: [
        { id: uid(), title: "Зарядка", log: logOf([0, 1, 2, 4, 5, 8, 9, 10, 12]) },
        { id: uid(), title: "Читання", log: logOf([1, 2, 3, 6, 7, 9]) },
        { id: uid(), title: "2 літри води", log: logOf([0, 1, 3, 4, 5, 6, 11, 13]) }
      ]
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
    }
    return demo();
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {

    }
  }

  let state = load();
  const changeFns = [], toastFns = [];
  const toast = (msg, type) => toastFns.forEach(f => f(msg, type));

  const level = s => Math.floor(s.xp / XP_PER_LEVEL) + 1;
  const xpIn = s => s.xp % XP_PER_LEVEL;
  const titleOf = lv => TITLES[Math.min(lv - 1, TITLES.length - 1)];

  function activity(s) {
    const m = {};

    s.tasks.forEach(t => {
      if (t.done && t.doneAt) m[t.doneAt] = (m[t.doneAt] || 0) + 1;
    });

    s.habits.forEach(h => Object.keys(h.log).forEach(d => {
      if (h.log[d]) m[d] = (m[d] || 0) + 1;
    }));

    return m;
  }

  function streak(s) {
    const a = activity(s);
    let n = 0, i = a[ago(0)] ? 0 : 1;

    while (a[ago(i)]) {
      n++;
      i++;
    }

    return n;
  }

  function week(s) {
    const a = activity(s), names = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

    return [6, 5, 4, 3, 2, 1, 0].map(i => {
      const d = new Date();
      d.setDate(d.getDate() - i);

      return {
        date: iso(d),
        label: names[d.getDay()],
        count: a[iso(d)] || 0
      };
    });
  }

  const doneCount = s => s.tasks.filter(t => t.done).length;

  const habitChecks = s => s.habits.reduce(
    (n, h) => n + Object.values(h.log).filter(Boolean).length, 0
  );

  const ACH = [
    { id: "first", title: "Перший запуск", desc: "Виконай перше завдання", progress: s => [doneCount(s), 1] },
    { id: "ten", title: "Десятка", desc: "Виконай 10 завдань", progress: s => [doneCount(s), 10] },
    { id: "lvl3", title: "Третя орбіта", desc: "Досягни 3 рівня", progress: s => [level(s), 3] },
    { id: "lvl5", title: "Далекий рейс", desc: "Досягни 5 рівня", progress: s => [level(s), 5] },
    { id: "st3", title: "Розгін", desc: "Активність 3 дні поспіль", progress: s => [streak(s), 3] },
    { id: "st7", title: "Тиждень у космосі", desc: "Активність 7 днів поспіль", progress: s => [streak(s), 7] },
    { id: "goal", title: "Мету досягнуто", desc: "Доведи будь-яку ціль до 100%", progress: s => [s.goals.some(g => g.progress >= 100) ? 1 : 0, 1] },
    { id: "rhythm", title: "Ритм", desc: "Познач звички 20 разів", progress: s => [habitChecks(s), 20] }
  ];

  function act(fn) {
    const before = level(state);

    fn();

    const now = level(state);

    if (now > before) {
      toast(`Новий рівень: ${now}. Тепер ти — ${titleOf(now)}`, "level");
    }

    ACH.forEach(a => {
      const [cur, need] = a.progress(state);

      if (!state.unlocked[a.id] && cur >= need) {
        state.unlocked[a.id] = iso();
        toast("Досягнення: " + a.title, "ach");
      }
    });

    save();
    changeFns.forEach(f => f());
  }

  const find = (list, id) => list.find(x => x.id === id);

  window.OrbitStore = {
    get state() { return state; },
    XP, XP_PER_LEVEL, ACH, iso, ago, level, xpIn, titleOf, activity, streak, week, doneCount,

    onChange: f => changeFns.push(f),
    onToast: f => toastFns.push(f),

    addTask: ({ title, cat, priority }) => act(() =>
      state.tasks.push({ id: uid(), title, cat, priority, done: false })
    ),

    toggleTask: id => act(() => {
      const t = find(state.tasks, id);
      t.done = !t.done;

      if (t.done) {
        t.doneAt = iso();
        state.xp += XP[t.priority];
        toast(`+${XP[t.priority]} XP: ${t.title}`, "xp");
      } else {
        t.doneAt = null;
        state.xp = Math.max(0, state.xp - XP[t.priority]);
      }
    }),

    deleteTask: id => act(() => {
      state.tasks = state.tasks.filter(t => t.id !== id);
    }),

    /* Цілі */
    saveGoal: ({ id, title, deadline, priority }) => act(() => {
      if (id) {
        Object.assign(find(state.goals, id), { title, deadline, priority });
      } else {
        state.goals.push({ id: uid(), title, deadline, priority, progress: 0 });
      }
    }),

    stepGoal: (id, d) => act(() => {
      const g = find(state.goals, id);

      g.progress = Math.max(0, Math.min(100, g.progress + d));

      if (g.progress === 100 && !g.rewarded) {
        g.rewarded = true;
        state.xp += GOAL_BONUS;
        toast(`Ціль виконано! +${GOAL_BONUS} XP`, "xp");
      }
    }),

    deleteGoal: id => act(() => {
      state.goals = state.goals.filter(g => g.id !== id);
    }),

    addHabit: title => act(() =>
      state.habits.push({ id: uid(), title, log: {} })
    ),

    toggleHabit: (id, date) => act(() => {
      const h = find(state.habits, id);

      if (h.log[date]) {
        delete h.log[date];
        state.xp = Math.max(0, state.xp - HABIT_XP);
      } else {
        h.log[date] = true;
        state.xp += HABIT_XP;
        toast(`+${HABIT_XP} XP: ${h.title}`, "xp");
      }
    }),

    deleteHabit: id => act(() => {
      state.habits = state.habits.filter(h => h.id !== id);
    }),

    setName: n => act(() => {
      state.name = n;
    }),

    setTheme: t => act(() => {
      state.theme = t;
    }),

    reset: () => {
      state = demo();
      save();
      changeFns.forEach(f => f());
    }
  };
})();
