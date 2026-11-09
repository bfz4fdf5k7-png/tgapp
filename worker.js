// P2P Радар: прокси к Bybit и сервер заявок.
// Работает как Cloudflare Worker вместе с файлом wrangler.jsonc.
// Секрет BOT_TOKEN (токен бота) задаётся в настройках воркера, в коде его нет.

const ALLOWED_ORIGIN = "https://bfz4fdf5k7-png.github.io";
const BYBIT = "https://api2.bybit.com/fiat/otc/item/online";
const APP_URL = "https://bfz4fdf5k7-png.github.io/tgapp/";
const DEFAULT_ADMINS = [8408658346];

const OPEN_TTL = 30 * 60 * 1000; // заявка живёт 30 минут
const MAX_OPEN = 3; // открытых заявок от одного пользователя
const MAX_TAKEN = 5; // заявок в работе у одного исполнителя
const COOLDOWN = 20 * 1000; // пауза между созданием заявок
const DAY = 24 * 3600 * 1000;

class UserError extends Error {}

function out(obj) {
  return new Response(JSON.stringify(obj), { headers: { "Content-Type": "application/json" } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    // Сервер заявок
    if (url.pathname.startsWith("/api/")) {
      if (request.method !== "POST") return new Response("ok", { headers: cors });
      if (!env.HUB) {
        return new Response(JSON.stringify({ ok: false, error: "Сервер заявок не настроен." }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const stub = env.HUB.get(env.HUB.idFromName("main"));
      const res = await stub.fetch(request);
      const text = await res.text();
      return new Response(text, {
        status: res.status,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Прокси к Bybit
    if (request.method !== "POST") {
      return new Response("P2P proxy работает", { headers: cors });
    }
    const body = await request.text();
    const upstream = await fetch(BYBIT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        "Origin": "https://www.bybit.com",
        "Referer": "https://www.bybit.com/",
      },
      body: body,
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
};

const ORDER_SELECT =
  "SELECT o.*, m.name AS mname, m.username AS musername, t.name AS tname, t.username AS tusername, " +
  "EXISTS(SELECT 1 FROM regs r WHERE lower(r.handle) = lower(m.username)) AS mreg, " +
  "EXISTS(SELECT 1 FROM regs r WHERE lower(r.handle) = lower(t.username)) AS treg, " +
  "EXISTS(SELECT 1 FROM scam z WHERE lower(z.handle) = lower(m.username)) AS mscam, " +
  "EXISTS(SELECT 1 FROM scam z WHERE lower(z.handle) = lower(t.username)) AS tscam " +
  "FROM orders o JOIN users m ON m.id = o.merchant_id LEFT JOIN users t ON t.id = o.taker_id";

function firstName(name) {
  return String(name || "").split(" ")[0] || "Без имени";
}
function label(username, name) {
  return username ? "@" + username : firstName(name);
}
function money(n) {
  return Number(n).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

export class Hub {
  constructor(state, env) {
    this.env = env;
    this.sql = state.storage.sql;
    [
      "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, username TEXT, online INTEGER DEFAULT 0, last_seen INTEGER DEFAULT 0, created_at INTEGER)",
      "CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, merchant_id INTEGER, amount REAL, rate REAL, note TEXT, status TEXT, taker_id INTEGER, created_at INTEGER, taken_at INTEGER, done_at INTEGER, ok_m INTEGER DEFAULT 0, ok_t INTEGER DEFAULT 0)",
      "CREATE INDEX IF NOT EXISTS orders_status ON orders (status, created_at)",
      "CREATE TABLE IF NOT EXISTS msgs (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, sender_id INTEGER, kind TEXT, text TEXT, created_at INTEGER)",
      "CREATE INDEX IF NOT EXISTS msgs_order ON msgs (order_id, id)",
      "CREATE TABLE IF NOT EXISTS regs (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, handle TEXT, rate_from REAL, rate_to REAL, note TEXT)",
      "CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v INTEGER)",
      "CREATE TABLE IF NOT EXISTS scam (id INTEGER PRIMARY KEY AUTOINCREMENT, handle TEXT, reason TEXT, created_at INTEGER)",
      "CREATE TABLE IF NOT EXISTS bans (order_id INTEGER, user_id INTEGER, PRIMARY KEY (order_id, user_id))",
      "INSERT OR IGNORE INTO meta (k, v) VALUES ('rev', 1)",
    ].forEach((q) => this.sql.exec(q));

    ["min_amount", "max_amount"].forEach((c) => {
      try { this.sql.exec("ALTER TABLE users ADD COLUMN " + c + " REAL"); } catch (e) {}
    });
    ["pinned", "verified", "clean"].forEach((c) => {
      try { this.sql.exec("ALTER TABLE regs ADD COLUMN " + c + " INTEGER DEFAULT 0"); } catch (e) {}
    });

    if (!this.get("SELECT v FROM meta WHERE k = 'regs_seeded'")) {
      const note = "Постоянный клиент. Курс 85–90 ₽.";
      ["tracckker", "bakinskiiy77"].forEach((h) => {
        this.sql.exec("INSERT INTO regs (kind, handle, rate_from, rate_to, note) VALUES ('buy', ?, 85, 90, ?)", h, note);
      });
      this.sql.exec("INSERT INTO meta (k, v) VALUES ('regs_seeded', 1)");
    }
    if (!this.get("SELECT v FROM meta WHERE k = 'regs_seed2'")) {
      this.sql.exec("UPDATE regs SET verified = 1 WHERE kind = 'buy' AND lower(handle) IN ('tracckker', 'bakinskiiy77')");
      if (!this.get("SELECT id FROM regs WHERE lower(handle) = 'zz024z'")) {
        this.sql.exec("INSERT INTO regs (kind, handle, rate_from, rate_to, note, pinned, verified, clean) VALUES ('sell', 'zz024z', 88, 90, 'Проверенный · Чистый трафик', 1, 1, 1)");
      }
      this.sql.exec("INSERT INTO meta (k, v) VALUES ('regs_seed2', 1)");
    }
  }

  /* ---------- вспомогательное ---------- */
  all(q, ...b) {
    return this.sql.exec(q, ...b).toArray();
  }
  get(q, ...b) {
    return this.all(q, ...b)[0] || null;
  }
  rev() {
    return this.get("SELECT v FROM meta WHERE k = 'rev'").v;
  }
  bump() {
    this.sql.exec("UPDATE meta SET v = v + 1 WHERE k = 'rev'");
  }
  isAdmin(id) {
    const list = this.env.ADMIN_IDS
      ? String(this.env.ADMIN_IDS).split(",").map((x) => Number(x.trim()))
      : DEFAULT_ADMINS;
    return list.indexOf(id) !== -1;
  }
  expire(now) {
    const r = this.sql.exec("UPDATE orders SET status = 'expired', done_at = ? WHERE status = 'open' AND created_at < ?", now, now - OPEN_TTL);
    if (r.rowsWritten > 0) this.bump();
  }
  mapOrder(r, me) {
    const isM = r.merchant_id === me;
    return {
      id: r.id,
      amount: r.amount,
      rate: r.rate,
      note: r.note || "",
      status: r.status,
      role: isM ? "merchant" : "taker",
      created_at: r.created_at,
      taken_at: r.taken_at,
      done_at: r.done_at,
      expires_at: r.created_at + OPEN_TTL,
      other: isM
        ? r.taker_id ? { name: r.tname, username: r.tusername || "", label: label(r.tusername, r.tname), reg: !!r.treg, scam: !!r.tscam } : null
        : { name: r.mname, username: r.musername || "", label: label(r.musername, r.mname), reg: !!r.mreg, scam: !!r.mscam },
      ok_me: isM ? !!r.ok_m : !!r.ok_t,
      ok_other: isM ? !!r.ok_t : !!r.ok_m,
    };
  }
  orderFor(id, uid) {
    const r = this.get(ORDER_SELECT + " WHERE o.id = ?", id);
    if (!r) throw new UserError("Заявка не найдена.");
    if (r.merchant_id !== uid && r.taker_id !== uid) throw new UserError("Это не ваша заявка.");
    return r;
  }
  addMsg(orderId, senderId, kind, text) {
    this.sql.exec("INSERT INTO msgs (order_id, sender_id, kind, text, created_at) VALUES (?, ?, ?, ?, ?)", orderId, senderId, kind, text, Date.now());
  }

  /* ---------- Telegram ---------- */
  async auth(initData) {
    const token = this.env.BOT_TOKEN;
    if (!token) throw new UserError("Сервер не настроен: нет BOT_TOKEN.");
    if (!initData || typeof initData !== "string" || initData.length > 4096) {
      throw new UserError("Откройте приложение из Telegram через кнопку в боте.");
    }
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) throw new UserError("Откройте приложение из Telegram через кнопку в боте.");
    params.delete("hash");
    const pairs = [];
    for (const [k, v] of params) pairs.push(k + "=" + v);
    pairs.sort();
    const enc = new TextEncoder();
    const k1 = await crypto.subtle.importKey("raw", enc.encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const secret = await crypto.subtle.sign("HMAC", k1, enc.encode(token));
    const k2 = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", k2, enc.encode(pairs.join("\n")));
    const hex = Array.from(new Uint8Array(sig)).map((x) => x.toString(16).padStart(2, "0")).join("");
    let diff = hex.length ^ hash.length;
    for (let i = 0; i < hex.length && i < hash.length; i++) diff |= hex.charCodeAt(i) ^ hash.charCodeAt(i);
    if (diff !== 0) throw new UserError("Не удалось проверить Telegram. Закройте и откройте приложение заново.");
    const authDate = parseInt(params.get("auth_date") || "0", 10);
    if (!authDate || Date.now() / 1000 - authDate > 3 * 24 * 3600) {
      throw new UserError("Сессия устарела. Закройте и откройте приложение заново.");
    }
    let u = null;
    try { u = JSON.parse(params.get("user") || "null"); } catch (e) {}
    if (!u || !u.id) throw new UserError("Не удалось определить пользователя.");
    return {
      id: u.id,
      name: ((u.first_name || "") + " " + (u.last_name || "")).trim() || "Без имени",
      username: u.username || "",
    };
  }
  async tg(method, payload) {
    const t = this.env.BOT_TOKEN;
    if (!t) return;
    try {
      await fetch("https://api.telegram.org/bot" + t + "/" + method, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (e) {}
  }
  async notify(ids, text) {
    const kb = { inline_keyboard: [[{ text: "Открыть приложение", web_app: { url: APP_URL } }]] };
    for (let i = 0; i < ids.length; i += 10) {
      await Promise.all(ids.slice(i, i + 10).map((id) => this.tg("sendMessage", { chat_id: id, text: text, reply_markup: kb })));
    }
  }
  touch(u) {
    const now = Date.now();
    const row = this.get("SELECT name, username, last_seen FROM users WHERE id = ?", u.id);
    if (!row) {
      this.sql.exec("INSERT INTO users (id, name, username, online, last_seen, created_at) VALUES (?, ?, ?, 0, ?, ?)", u.id, u.name, u.username, now, now);
    } else if (row.name !== u.name || row.username !== u.username || row.last_seen < now - 60000) {
      this.sql.exec("UPDATE users SET name = ?, username = ?, last_seen = ? WHERE id = ?", u.name, u.username, now, u.id);
    }
  }

  /* ---------- вход ---------- */
  async fetch(request) {
    let body;
    try { body = await request.json(); } catch (e) { return out({ ok: false, error: "Неверный запрос." }); }
    const path = new URL(request.url).pathname.replace(/^\/api\//, "");
    try {
      const u = await this.auth(body.initData);
      this.touch(u);
      switch (path) {
        case "list": return out(this.list(u, body));
        case "online": return out(this.setOnline(u, body));
        case "range": return out(this.setRange(u, body));
        case "create": return out(await this.create(u, body));
        case "take": return out(await this.take(u, body));
        case "cancel": return out(this.cancel(u, body));
        case "msgs": return out(this.msgs(u, body));
        case "send": return out(await this.send(u, body));
        case "confirm": return out(this.confirm(u, body));
        case "regs": return out(this.regsList(u));
        case "reg_save": return out(this.regSave(u, body));
        case "reg_delete": return out(this.regDelete(u, body));
        case "reg_pin": return out(this.regPin(u, body));
        case "scam": return out(this.scamList(u));
        case "scam_save": return out(this.scamSave(u, body));
        case "scam_delete": return out(this.scamDelete(u, body));
        default: return out({ ok: false, error: "Неизвестный запрос." });
      }
    } catch (e) {
      if (e instanceof UserError) return out({ ok: false, error: e.message });
      console.log("hub error", e && e.stack ? e.stack : e);
      return out({ ok: false, error: "Ошибка сервера. Повторите позже." });
    }
  }

  /* ---------- заявки ---------- */
  list(u, b) {
    const now = Date.now();
    this.expire(now);
    const rev = this.rev();
    if (!b.force && b.rev === rev) return { ok: true, same: true, rev: rev, now: now };

    const me = this.get("SELECT online, min_amount, max_amount FROM users WHERE id = ?", u.id);
    const online = !!(me && me.online);
    const lo = me && me.min_amount != null ? me.min_amount : null;
    const hi = me && me.max_amount != null ? me.max_amount : null;
    let free = [];
    if (online) {
      free = this.all(
        "SELECT o.id, o.amount, o.rate, o.note, o.created_at, m.name AS mname, m.username AS musername, " +
        "EXISTS(SELECT 1 FROM regs r WHERE lower(r.handle) = lower(m.username)) AS mreg, " +
        "EXISTS(SELECT 1 FROM scam z WHERE lower(z.handle) = lower(m.username)) AS mscam " +
        "FROM orders o JOIN users m ON m.id = o.merchant_id " +
        "WHERE o.status = 'open' AND o.merchant_id <> ? " +
        "AND NOT EXISTS (SELECT 1 FROM bans b WHERE b.order_id = o.id AND b.user_id = ?) " +
        "AND (? IS NULL OR o.amount >= ?) AND (? IS NULL OR o.amount <= ?) " +
        "ORDER BY o.created_at DESC LIMIT 50", u.id, u.id, lo, lo, hi, hi
      ).map((r) => ({
        id: r.id, amount: r.amount, rate: r.rate, note: r.note || "",
        created_at: r.created_at, expires_at: r.created_at + OPEN_TTL,
        merchant: label(r.musername, r.mname), reg: !!r.mreg, scam: !!r.mscam,
      }));
    }
    const active = this.all(
      ORDER_SELECT + " WHERE o.status IN ('open', 'taken') AND (o.merchant_id = ? OR o.taker_id = ?) ORDER BY o.created_at DESC LIMIT 50",
      u.id, u.id
    ).map((r) => this.mapOrder(r, u.id));
    const done = this.all(
      ORDER_SELECT + " WHERE o.status IN ('done', 'cancelled', 'expired') AND (o.merchant_id = ? OR o.taker_id = ?) " +
      "ORDER BY COALESCE(o.done_at, o.taken_at, o.created_at) DESC LIMIT 30",
      u.id, u.id
    ).map((r) => this.mapOrder(r, u.id));
    const st = this.get(
      "SELECT COUNT(*) AS c, COALESCE(SUM(amount), 0) AS s FROM orders WHERE status = 'done' AND done_at > ? AND (merchant_id = ? OR taker_id = ?)",
      now - DAY, u.id, u.id
    );
    const tot = this.get(
      "SELECT COUNT(*) AS c, COALESCE(SUM(amount), 0) AS s FROM orders WHERE status = 'done' AND (merchant_id = ? OR taker_id = ?)", u.id, u.id
    );
    return {
      ok: true, rev: rev, now: now, online: online, range: { min: lo, max: hi },
      me: { id: u.id, name: u.name, admin: this.isAdmin(u.id) },
      free: free, active: active, done: done, stats: { count: st.c, sum: st.s, total: tot.c, total_sum: tot.s },
    };
  }

  setOnline(u, b) {
    this.sql.exec("UPDATE users SET online = ? WHERE id = ?", b.online ? 1 : 0, u.id);
    return { ok: true, online: !!b.online };
  }

  setRange(u, b) {
    const conv = (v) => {
      if (v === null || v === undefined || v === "") return null;
      const n = Math.round(Number(v) * 100) / 100;
      if (!isFinite(n) || n < 0 || n > 100000000) throw new UserError("Сумма диапазона: от 0 до 100 000 000 ₽.");
      return n;
    };
    let lo = conv(b.min), hi = conv(b.max);
    if (lo !== null && lo < 100) lo = 100;
    if (lo !== null && hi !== null && lo > hi) throw new UserError("«От» не может быть больше «До».");
    this.sql.exec("UPDATE users SET min_amount = ?, max_amount = ? WHERE id = ?", lo, hi, u.id);
    return { ok: true, range: { min: lo, max: hi } };
  }

  async create(u, b) {
    const now = Date.now();
    const amount = Math.round(Number(b.amount) * 100) / 100;
    const rate = Math.round(Number(b.rate) * 100) / 100;
    if (!(amount >= 100 && amount <= 10000000)) throw new UserError("Сумма: от 100 до 10 000 000 ₽.");
    if (!(rate >= 1 && rate <= 1000)) throw new UserError("Курс: от 1 до 1000 ₽ за USDT.");
    const note = String(b.note || "").trim().slice(0, 300);
    this.expire(now);
    const open = this.get("SELECT COUNT(*) AS c FROM orders WHERE merchant_id = ? AND status = 'open'", u.id).c;
    if (open >= MAX_OPEN) throw new UserError("Уже есть " + MAX_OPEN + " открытые заявки. Дождитесь исполнителя или отмените лишнюю.");
    const last = this.get("SELECT MAX(created_at) AS t FROM orders WHERE merchant_id = ?", u.id);
    if (last && last.t && now - last.t < COOLDOWN) throw new UserError("Подождите несколько секунд перед следующей заявкой.");
    const id = this.sql.exec(
      "INSERT INTO orders (merchant_id, amount, rate, note, status, created_at) VALUES (?, ?, ?, ?, 'open', ?) RETURNING id",
      u.id, amount, rate, note, now
    ).one().id;
    this.bump();

    const ids = this.all(
      "SELECT id FROM users WHERE online = 1 AND id <> ? AND last_seen > ? " +
      "AND (min_amount IS NULL OR min_amount <= ?) AND (max_amount IS NULL OR max_amount >= ?) LIMIT 100", u.id, now - DAY, amount, amount
    ).map((r) => r.id);
    const usdt = money(amount / rate);
    const me = this.get("SELECT EXISTS(SELECT 1 FROM regs r WHERE lower(r.handle) = lower(?)) AS x", u.username || "").x;
    const who = me ? "Постоянник " + label(u.username, u.name) : label(u.username, u.name);
    await this.notify(ids, "Новая заявка #" + id + " от " + who + ": " + money(amount) + " ₽ по курсу " + money(rate) + " (≈ " + usdt + " USDT)." + (note ? "\n" + note : ""));
    return { ok: true, id: id, notified: ids.length };
  }

  async take(u, b) {
    const now = Date.now();
    this.expire(now);
    const id = Number(b.id);
    const r = this.get(ORDER_SELECT + " WHERE o.id = ?", id);
    if (!r) throw new UserError("Заявка не найдена.");
    if (r.merchant_id === u.id) throw new UserError("Свою заявку взять нельзя.");
    if (r.status !== "open") throw new UserError(r.status === "expired" ? "Время заявки вышло." : "Заявку уже взяли.");
    if (this.get("SELECT 1 AS x FROM bans WHERE order_id = ? AND user_id = ?", id, u.id)) throw new UserError("Вы уже отказались от этой заявки, взять её повторно нельзя.");
    const me = this.get("SELECT online FROM users WHERE id = ?", u.id);
    if (!me || !me.online) throw new UserError("Включите «В работе», чтобы брать заявки.");
    const taken = this.get("SELECT COUNT(*) AS c FROM orders WHERE taker_id = ? AND status = 'taken'", u.id).c;
    if (taken >= MAX_TAKEN) throw new UserError("У вас уже " + MAX_TAKEN + " заявок в работе. Завершите одну из них.");
    this.sql.exec("UPDATE orders SET status = 'taken', taker_id = ?, taken_at = ? WHERE id = ? AND status = 'open'", u.id, now, id);
    this.addMsg(id, 0, "sys", label(u.username, u.name) + " взял(а) заявку. Договоритесь в чате и отправьте ссылку на ордер Bybit.");
    this.bump();
    await this.notify([r.merchant_id], label(u.username, u.name) + " взял(а) вашу заявку #" + id + ": " + money(r.amount) + " ₽ по курсу " + money(r.rate) + ". Откройте чат в приложении.");
    return { ok: true, id: id };
  }

  cancel(u, b) {
    const id = Number(b.id);
    const r = this.orderFor(id, u.id);
    if (r.status === "open") {
      if (r.merchant_id !== u.id) throw new UserError("Отменить открытую заявку может только её автор.");
      this.sql.exec("UPDATE orders SET status = 'cancelled', done_at = ? WHERE id = ?", Date.now(), id);
      this.bump();
      return { ok: true };
    }
    if (r.status !== "taken") throw new UserError("Заявка уже закрыта.");
    if (r.merchant_id === u.id) {
      this.sql.exec("UPDATE orders SET status = 'cancelled', done_at = ? WHERE id = ?", Date.now(), id);
      this.addMsg(id, 0, "sys", label(u.username, u.name) + " отменил(а) заявку.");
    } else {
      // Исполнитель отказался: заявка возвращается в список, повторно взять её он не сможет.
      this.sql.exec("INSERT OR IGNORE INTO bans (order_id, user_id) VALUES (?, ?)", id, u.id);
      this.sql.exec("UPDATE orders SET status = 'open', taker_id = NULL, taken_at = NULL, ok_m = 0, ok_t = 0 WHERE id = ?", id);
      this.sql.exec("DELETE FROM msgs WHERE order_id = ?", id);
      this.notify([r.merchant_id], label(u.username, u.name) + " отказался от заявки #" + id + ". Она снова в списке и ждёт исполнителя.");
    }
    this.bump();
    return { ok: true };
  }

  /* ---------- чат ---------- */
  msgs(u, b) {
    const id = Number(b.id);
    const r = this.orderFor(id, u.id);
    const after = Math.max(0, Number(b.after) || 0);
    const rows = this.all("SELECT id, sender_id, kind, text, created_at FROM msgs WHERE order_id = ? AND id > ? ORDER BY id LIMIT 200", id, after);
    return {
      ok: true,
      me: u.id,
      order: this.mapOrder(r, u.id),
      msgs: rows.map((m) => ({ id: m.id, mine: m.sender_id === u.id, sys: m.kind === "sys", kind: m.kind, text: m.text, at: m.created_at })),
    };
  }

  async send(u, b) {
    const id = Number(b.id);
    const r = this.orderFor(id, u.id);
    if (r.status !== "taken") throw new UserError("Чат доступен, пока заявка в работе.");
    const text = String(b.text || "").trim().slice(0, 1000);
    if (!text) throw new UserError("Пустое сообщение.");
    const recent = this.get("SELECT COUNT(*) AS c FROM msgs WHERE sender_id = ? AND created_at > ?", u.id, Date.now() - 60000).c;
    if (recent >= 20) throw new UserError("Слишком часто. Подождите минуту.");
    const isLink = /https?:\/\/(?:[\w-]+\.)*bybit\.com\/\S*/i.test(text);
    this.addMsg(id, u.id, isLink ? "link" : "text", text);

    const otherId = r.merchant_id === u.id ? r.taker_id : r.merchant_id;
    const other = this.get("SELECT last_seen FROM users WHERE id = ?", otherId);
    if (other && other.last_seen < Date.now() - 120000) {
      await this.notify([otherId], "Новое сообщение по заявке #" + id + " от " + firstName(u.name) + ".");
    }
    return { ok: true };
  }

  confirm(u, b) {
    const id = Number(b.id);
    const r = this.orderFor(id, u.id);
    if (r.status !== "taken") throw new UserError("Заявка уже закрыта.");
    const hasLink = this.get("SELECT 1 AS x FROM msgs WHERE order_id = ? AND kind = 'link' LIMIT 1", id);
    if (!hasLink) throw new UserError("Сначала отправьте в чат ссылку на ордер Bybit.");
    const col = r.merchant_id === u.id ? "ok_m" : "ok_t";
    if (r[col]) return { ok: true, status: "taken", waiting: true };
    this.sql.exec("UPDATE orders SET " + col + " = 1 WHERE id = ?", id);
    const fresh = this.get("SELECT ok_m, ok_t FROM orders WHERE id = ?", id);
    let status = "taken";
    if (fresh.ok_m && fresh.ok_t) {
      status = "done";
      this.sql.exec("UPDATE orders SET status = 'done', done_at = ? WHERE id = ?", Date.now(), id);
      this.addMsg(id, 0, "sys", "Ордер завершён обеими сторонами.");
    } else {
      this.addMsg(id, 0, "sys", firstName(u.name) + " подтвердил(а) завершение. Ждём вторую сторону.");
    }
    this.bump();
    return { ok: true, status: status };
  }

  /* ---------- постоянники ---------- */
  regsList(u) {
    const rows = this.all("SELECT id, kind, handle, rate_from, rate_to, note, pinned, verified, clean FROM regs ORDER BY pinned DESC, id");
    const regs = { buy: [], sell: [] };
    rows.forEach((r) => {
      (regs[r.kind] || regs.buy).push({
        id: r.id, handle: r.handle, from: r.rate_from, to: r.rate_to, note: r.note || "",
        pinned: !!r.pinned, verified: !!r.verified, clean: !!r.clean,
      });
    });
    return { ok: true, regs: regs, admin: this.isAdmin(u.id) };
  }
  regSave(u, b) {
    if (!this.isAdmin(u.id)) throw new UserError("Постоянников добавляет администратор.");
    const kind = b.kind === "sell" ? "sell" : "buy";
    const handle = String(b.handle || "").trim().replace(/^@/, "");
    if (!/^[A-Za-z0-9_]{4,32}$/.test(handle)) throw new UserError("Ник: 4–32 символа, буквы, цифры и _.");
    let from = Number(b.from), to = Number(b.to);
    if (!isFinite(from) || !isFinite(to)) throw new UserError("Укажите курс «от» и «до».");
    if (from > to) { const x = from; from = to; to = x; }
    const note = String(b.note || "").trim().slice(0, 500);
    const pinned = b.pinned ? 1 : 0, verified = b.verified ? 1 : 0, clean = b.clean ? 1 : 0;
    if (b.id) {
      this.sql.exec("UPDATE regs SET kind = ?, handle = ?, rate_from = ?, rate_to = ?, note = ?, pinned = ?, verified = ?, clean = ? WHERE id = ?", kind, handle, from, to, note, pinned, verified, clean, Number(b.id));
    } else {
      this.sql.exec("INSERT INTO regs (kind, handle, rate_from, rate_to, note, pinned, verified, clean) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", kind, handle, from, to, note, pinned, verified, clean);
    }
    this.bump();
    return this.regsList(u);
  }
  scamList(u) {
    const rows = this.all("SELECT id, handle, reason, created_at FROM scam ORDER BY id DESC");
    return { ok: true, admin: this.isAdmin(u.id), scam: rows.map((r) => ({ id: r.id, handle: r.handle, reason: r.reason || "", at: r.created_at })) };
  }
  scamSave(u, b) {
    if (!this.isAdmin(u.id)) throw new UserError("Список обманщиков пополняет администратор.");
    const handle = String(b.handle || "").trim().replace(/^@/, "").slice(0, 64);
    if (handle.length < 2) throw new UserError("Укажите ник или имя.");
    const reason = String(b.reason || "").trim().slice(0, 1000);
    if (b.id) this.sql.exec("UPDATE scam SET handle = ?, reason = ? WHERE id = ?", handle, reason, Number(b.id));
    else this.sql.exec("INSERT INTO scam (handle, reason, created_at) VALUES (?, ?, ?)", handle, reason, Date.now());
    this.bump();
    return this.scamList(u);
  }
  scamDelete(u, b) {
    if (!this.isAdmin(u.id)) throw new UserError("Список обманщиков меняет администратор.");
    this.sql.exec("DELETE FROM scam WHERE id = ?", Number(b.id));
    this.bump();
    return this.scamList(u);
  }
  regPin(u, b) {
    if (!this.isAdmin(u.id)) throw new UserError("Закреплять может администратор.");
    this.sql.exec("UPDATE regs SET pinned = ? WHERE id = ?", b.pinned ? 1 : 0, Number(b.id));
    return this.regsList(u);
  }
  regDelete(u, b) {
    if (!this.isAdmin(u.id)) throw new UserError("Постоянников удаляет администратор.");
    this.sql.exec("DELETE FROM regs WHERE id = ?", Number(b.id));
    this.bump();
    return this.regsList(u);
  }
}
