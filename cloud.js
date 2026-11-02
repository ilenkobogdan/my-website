(function () {
  "use strict";

  const SUPABASE_URL = "PASTE_YOUR_PROJECT_URL";
  const SUPABASE_KEY = "PASTE_YOUR_ANON_OR_PUBLISHABLE_KEY";

  const S = window.OrbitStore;
  const keysSet = !/^PASTE/.test(SUPABASE_URL) && !/^PASTE/.test(SUPABASE_KEY);
  const libLoaded = typeof window.supabase !== "undefined";

  const LS = {
    dirty: "orbit:cloud-dirty",     
    at: "orbit:cloud-synced-at",   
    uid: "orbit:cloud-uid"           
  };

  const Cloud = window.OrbitCloud = {
    keysSet, libLoaded, configured: keysSet && libLoaded,
    user: null, ready: false, recovery: false,
    mode: "login", msg: null, msgType: "",
    status: "idle", lastSync: null
  };

  let client = null, timer = null, pushing = false, applying = false, handledUid = null;
  const redirectTo = location.origin + location.pathname;

  function notify(msg, type) {                      
    const box = document.getElementById("toasts"); if (!box) return;
    const t = document.createElement("div");
    t.className = "toast " + (type || ""); t.textContent = msg; box.appendChild(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 400); }, 3200);
  }

  function friendly(err) {
    const m = String((err && err.message) || err || "").toLowerCase();
    if (m.includes("invalid login")) return "Невірний email або пароль.";
    if (m.includes("already registered")) return "Цей email уже зареєстровано. Спробуйте увійти.";
    if (m.includes("not confirmed")) return "Спочатку підтвердіть пошту: перейдіть за посиланням у листі.";
    if (m.includes("at least")) return "Пароль має містити щонайменше 6 символів.";
    if (m.includes("rate limit") || m.includes("too many")) return "Забагато спроб. Зачекайте хвилину й спробуйте ще раз.";
    if (m.includes("failed to fetch") || m.includes("network")) return "Немає з’єднання з інтернетом.";
    if (m.includes("valid email") || m.includes("invalid email")) return "Введіть коректну адресу email.";
    if (m.includes("different from the old")) return "Новий пароль має відрізнятися від старого.";
    return "Сталася помилка: " + ((err && err.message) || "спробуйте пізніше") + ".";
  }

  Cloud.statusText = () => ({
    idle: "", synced: "Прогрес збережено в хмарі",
    syncing: "Синхронізація…", pending: "Зміни скоро буде відправлено",
    offline: "Немає інтернету: зміни збережено на пристрої й відправляться пізніше",
    error: "Не вдалося синхронізувати. Спробуємо ще раз"
  }[Cloud.status] || "");

  function refresh() {
    applying = true;
    try { S.setName(S.state.name); } finally { applying = false; }
  }
  Cloud.refresh = refresh;

  function showStatus() {                             
    const el = document.getElementById("pf-sync");
    if (el) el.textContent = Cloud.statusText();
  }


  function backup() {
    try {
      localStorage.setItem("orbit:backup-" + Date.now(), JSON.stringify(S.state));
      Object.keys(localStorage).filter(k => k.startsWith("orbit:backup-")).sort().slice(0, -3)
        .forEach(k => localStorage.removeItem(k));
    } catch (e) { /* нет места — не страшно */ }
  }

 
  function pick(d) {
    const o = {};
    if (d && typeof d === "object") {
      if (typeof d.name === "string") o.name = d.name.slice(0, 20);
      if (["dark", "nebula", "light"].includes(d.theme)) o.theme = d.theme;
      if (Number.isFinite(d.xp) && d.xp >= 0) o.xp = Math.floor(d.xp);
      ["goals", "tasks", "habits"].forEach(k => { if (Array.isArray(d[k])) o[k] = d[k]; });
      if (d.unlocked && typeof d.unlocked === "object") o.unlocked = d.unlocked;
    }
    return o;
  }


  async function push() {
    if (!client || !Cloud.user || pushing) return;
    if (!navigator.onLine) { Cloud.status = "offline"; showStatus(); return; }
    pushing = true; Cloud.status = "syncing"; showStatus();
    const snapshot = JSON.parse(JSON.stringify(S.state));
    try {
      const { data, error } = await client.from("user_state")
        .upsert({ user_id: Cloud.user.id, data: snapshot }, { onConflict: "user_id" })
        .select("updated_at").single();
      if (error) throw error;
      localStorage.setItem(LS.uid, Cloud.user.id);
      localStorage.setItem(LS.at, data.updated_at);
      Cloud.lastSync = data.updated_at; Cloud.status = "synced";
   
      if (JSON.stringify(S.state) === JSON.stringify(snapshot)) localStorage.setItem(LS.dirty, "0");
      else timer = setTimeout(push, 300);
    } catch (e) {
      Cloud.status = navigator.onLine ? "error" : "offline";
    } finally { pushing = false; showStatus(); }
  }

  function apply(row) {
    backup();
    Object.assign(S.state, pick(row.data));        
    localStorage.setItem(LS.at, row.updated_at);
    localStorage.setItem(LS.dirty, "0");
    Cloud.lastSync = row.updated_at; Cloud.status = "synced";
    refresh();                                        
  }

  async function pullIfNewer() {
    if (!client || !Cloud.user || pushing || !navigator.onLine) return false;
    if (localStorage.getItem(LS.dirty) === "1") return false;   
    const { data: row, error } = await client.from("user_state").select("data,updated_at").maybeSingle();
    if (error || !row || row.updated_at === localStorage.getItem(LS.at)) return false;
    apply(row); notify("Дані оновлено з хмари"); return true;
  }


  async function afterLogin() {
    const uid = Cloud.user.id;
    const { data: row, error } = await client.from("user_state").select("data,updated_at").maybeSingle();
    if (error) { Cloud.status = navigator.onLine ? "error" : "offline"; return; }
    const linked = localStorage.getItem(LS.uid) === uid;  

    if (!row) {                                           
      if (confirm("Перенести прогрес із цього пристрою у ваш акаунт?\n\nОК: перенести.\nСкасувати: почати з чистих демо-даних (поточні дані збережуться в резервній копії).")) {
        localStorage.setItem(LS.dirty, "1"); await push();
        if (Cloud.status === "synced") notify("Прогрес перенесено в хмару", "level");
      } else {
        backup(); applying = true; S.reset(); applying = false;
        localStorage.setItem(LS.dirty, "1"); await push();
      }
    } else if (linked) {                                   
      if (localStorage.getItem(LS.dirty) === "1") await push();     
      else if (row.updated_at !== localStorage.getItem(LS.at)) { apply(row); notify("Дані оновлено з хмари"); }
      else Cloud.status = "synced";
    } else {                                              
      apply(row); localStorage.setItem(LS.uid, uid);
      notify("Завантажено ваш прогрес з акаунта");
    }
  }

  
  function onSession(session) {
    Cloud.ready = true;
    if (!session) { Cloud.user = null; handledUid = null; Cloud.status = "idle"; refresh(); return; }
    Cloud.user = session.user;
    if (handledUid === session.user.id) return;     
    handledUid = session.user.id;
    afterLogin().then(refresh, refresh);
  }


  Cloud.signUp = async (email, password) => {
    const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
    if (error) throw error;

    if (data.user && data.user.identities && data.user.identities.length === 0) throw new Error("already registered");
    return { needsConfirm: !data.session };
  };
  Cloud.signIn = async (email, password) => {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };
  Cloud.signOut = async () => {
    if (localStorage.getItem(LS.dirty) === "1") await push();   
    await client.auth.signOut();
  };
  Cloud.resetPassword = async email => {
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  };
  Cloud.setPassword = async password => {
    const { error } = await client.auth.updateUser({ password });
    if (error) throw error;
    Cloud.recovery = false; Cloud.mode = "login";
  };
  Cloud.syncNow = async () => {
    if (!navigator.onLine) { notify("Немає інтернету", "err"); return; }
    if (localStorage.getItem(LS.dirty) === "1") await push();
    else if (!(await pullIfNewer())) { Cloud.status = "synced"; notify("Усе актуально"); }
    showStatus();
  };
  Cloud.friendly = friendly; Cloud.notify = notify;

  if (!Cloud.configured) { Cloud.ready = true; return; }

  client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }  
  });

 
  S.onChange(() => {
    if (applying || !Cloud.user) return;
    localStorage.setItem(LS.dirty, "1");
    Cloud.status = navigator.onLine ? "pending" : "offline"; showStatus();
    clearTimeout(timer); timer = setTimeout(push, 800);
  });

  client.auth.onAuthStateChange((event, session) => {
    setTimeout(() => {
      if (event === "PASSWORD_RECOVERY") { Cloud.recovery = true; Cloud.mode = "recovery"; location.hash = "#/profile"; }
      onSession(event === "SIGNED_OUT" ? null : session);
    }, 0);
  });

  document.addEventListener("visibilitychange", () => { if (!document.hidden) pullIfNewer(); });
  window.addEventListener("online", () => { localStorage.getItem(LS.dirty) === "1" ? push() : pullIfNewer(); });
  setInterval(() => { if (Cloud.user && localStorage.getItem(LS.dirty) === "1") push(); }, 30000);  // повтор после сбоя
})();