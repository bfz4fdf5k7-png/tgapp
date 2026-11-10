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
// Начальный чёрный список: [ник, источник (tg или bb), причина]. Загружается один раз.
const SCAM_SEED = [["User9201IAvDB1","bb","Мошенник (ник на Bybit)"],["x700xx26","bb","Мошенник: чернуха (ник на Bybit)"],["diP2_P","bb","Мошенник (ник на Bybit)"],["User7339OSDJs2","bb","Мошенник (ник на Bybit)"],["Unikalen","bb","Мошенник: чернуха (ник на Bybit)"],["User9461FrlyRa","bb","Мошенник (ник на Bybit)"],["User2515RqtlA3","bb","Мошенник (ник на Bybit)"],["Zalik.100","bb","Мошенник (ник на Bybit)"],["moneytradeff","bb","Мошенник (ник на Bybit)"],["ViaMant","bb","Мошенник (ник на Bybit)"],["kilop","bb","Мошенник (ник на Bybit)"],["алклалал","bb","Мошенник (ник на Bybit)"],["User9414t4JPgA","bb","Мошенник (ник на Bybit)"],["SupSell","bb","Мошенник (ник на Bybit)"],["Kinp","bb","Мошенник (ник на Bybit)"],["Kufteme","bb","Мошенник (ник на Bybit)"],["User5880Ny2wzl","bb","Мошенник (ник на Bybit)"],["Magulya","bb","Мошенник (ник на Bybit)"],["VladRooz","bb","Мошенник (ник на Bybit)"],["MelindaAfridj","bb","Мошенник (ник на Bybit)"],["Basra has","bb","Мошенник (ник на Bybit)"],["vuittonov","bb","Мошенник: морозит тезер (ник на Bybit)"],["Wacgen","bb","Мошенник (ник на Bybit)"],["MASON01","bb","Мошенник (ник на Bybit)"],["User2515RqtIA3","bb","Мошенник (ник на Bybit)"],["User 0200MX17kg","bb","Мошенник (ник на Bybit)"],["mans3rrr","bb","Мошенник (ник на Bybit)"],["knopkaqwa","bb","Мошенник: чернуха (ник на Bybit)"],["Fizzzy101","bb","Мошенник (ник на Bybit)"],["SwizzyAMG","bb","Мошенник (ник на Bybit)"],["Slifer101","bb","Мошенник (ник на Bybit)"],["satryeali","bb","Мошенник (ник на Bybit)"],["qwurti4","bb","Мошенник (ник на Bybit)"],["User9001CNcuJO","bb","Мошенник (ник на Bybit)"],["dadsq","bb","Мошенник (ник на Bybit)"],["Жасик_01","bb","Мошенник (ник на Bybit)"],["IvanPbn","bb","Мошенник (ник на Bybit)"],["By.baby","bb","Мошенник: морозит тезер (ник на Bybit)"],["By.niki","bb","Мошенник (ник на Bybit)"],["decision","bb","Мошенник (ник на Bybit)"],["Money_24","bb","Мошенник (ник на Bybit)"],["Имерт","bb","Мошенник (ник на Bybit)"],["Диаспора","bb","Мошенник (ник на Bybit)"],["NavalnyiKripta","bb","Мошенник (ник на Bybit)"],["Olimjon_Kodirov","bb","Мошенник (ник на Bybit)"],["557dabash","bb","Мошенник (ник на Bybit)"],["Ерла","bb","Мошенник (ник на Bybit)"],["KGS-OPLATA","bb","Мошенник (ник на Bybit)"],["Daven121","bb","Мошенник: рисовщик (ник на Bybit)"],["MIDERTREID","bb","Мошенник (ник на Bybit)"],["gentlemen699","bb","Мошенник (ник на Bybit)"],["LbanovHugsg","bb","Мошенник (ник на Bybit)"],["User9083JBgEGR","bb","Мошенник (ник на Bybit)"],["obmenka90","bb","Мошенник: рисует чеки (ник на Bybit)"],["User43448f5×71","bb","Мошенник (ник на Bybit)"],["BenyaFranklin","bb","Мошенник (ник на Bybit)"],["Andrii_696","bb","Мошенник: рисует чеки (ник на Bybit)"],["TrueHero","bb","Мошенник (ник на Bybit)"],["jirovesc","bb","Мошенник (ник на Bybit)"],["Ya_Sakal","bb","Мошенник: рисует чеки (ник на Bybit)"],["User3758dJjkPJL","bb","Мошенник (ник на Bybit)"],["exchange_usdt07","bb","Мошенник (ник на Bybit)"],["User672Ev3l3D","bb","Мошенник (ник на Bybit)"],["Franceexc","bb","Мошенник (ник на Bybit)"],["Tim163","bb","Мошенник (ник на Bybit)"],["Suziiii","bb","Мошенник (ник на Bybit)"],["Revers0x","bb","Мошенник (ник на Bybit)"],["userdkslpa2626","bb","Мошенник (ник на Bybit)"],["Dogamin","bb","Мошенник (ник на Bybit)"],["Anna_ExChEU","bb","Мошенник (ник на Bybit)"],["co77emaniyya","tg","Мошенник: чернуха"],["amirhanrazblok","tg","Мошенник"],["netyP2P_2_0","tg","Мошенник"],["imTonyp2p","tg","Мошенник"],["pukinator22","tg","Мошенник"],["VENI_VIDI_VICI_333","tg","Мошенник"],["boss_ff_store","tg","Мошенник"],["qqzvt","tg","Мошенник"],["obmen77","tg","Мошенник"],["longspread","tg","Мошенник"],["bybit_jjj","tg","Мошенник"],["Evgeniy_Prizyvnoy","tg","Мошенник"],["Zitrex777","tg","Мошенник"],["kslsllll","tg","Мошенник"],["arBitrage096","tg","Мошенник"],["sushayr","tg","Мошенник"],["molodoytsd","tg","Мошенник"],["naderadey","tg","Мошенник"],["bistriyjo","tg","Мошенник"],["pslsll","tg","Мошенник"],["zetusdt","tg","Мошенник"],["ArtemWorldPay","tg","Мошенник"],["vladis_korchek","tg","Мошенник"],["mdoifididid","tg","Мошенник"],["zzermat","tg","Мошенник"],["svrabotaet","tg","Мошенник"],["garandelovara","tg","Мошенник"],["fhsdfjhsd","tg","Мошенник"],["ieieidios","tg","Мошенник"],["HBP2P","tg","Мошенник"],["MAKSBYB","tg","Мошенник"],["hugoooo661","tg","Мошенник"],["abdulikkkkk","tg","Мошенник"],["moise029","tg","Мошенник"],["Magomedrasullllllll","tg","Мошенник"],["Temur_kz","tg","Мошенник"],["ymnipes","tg","Мошенник"],["kok_p_2_p","tg","Мошенник"],["Lackyrich","tg","Мошенник"],["isaobmenik","tg","Мошенник"],["pe909991","tg","Мошенник"],["verifsz","tg","Мошенник"],["bxbxxs","tg","Мошенник"],["usdtsueta","tg","Мошенник"],["g11gg115","tg","Мошенник"],["novabybit","tg","Мошенник"],["maxxx_immmm","tg","Мошенник"],["dadytrade","tg","Мошенник"],["alexxassonok","tg","Мошенник: колл центр"],["DEMON_P_2_P","tg","Мошенник"],["demidkooooo","tg","Мошенник"],["qwurti4","tg","Мошенник"],["did1233","tg","Мошенник"],["quvoi","tg","Мошенник"],["benladeb8","tg","Мошенник"],["lianasxxx","tg","Мошенник"],["Bybitobmenp2p","tg","Мошенник"],["muralegendaa","tg","Мошенник"],["approvvv","tg","Мошенник: чернуха"],["flownxs","tg","Мошенник"],["shant_fffiqpqpqp","tg","Мошенник"],["rasikbraz","tg","Мошенник"],["sedorkin","tg","Мошенник"],["usdt8069","tg","Мошенник"],["arbit_p2","tg","Мошенник"],["Manlimatan","tg","Мошенник"],["Likeleool","tg","Мошенник"],["tetherbe","tg","Мошенник"],["baybjt123","tg","Мошенник"],["rasulbulativ","tg","Мошенник: персональный ордер"],["Vii_Cash","tg","Мошенник"],["movlanoff_19","tg","Мошенник: скам"],["TERRA_TRC","tg","Мошенник"],["iuvanusdt","tg","Мошенник"],["kokjuy8","tg","Мошенник"],["mamamaw129","tg","Мошенник"],["gassydu","tg","Мошенник"],["LuMawTun","tg","Мошенник"],["darhhaa","tg","Мошенник"],["abdullioow","tg","Мошенник"],["Ramzes_212","tg","Мошенник"],["Hexxui","tg","Мошенник: чернуха"],["conqueroring","tg","Мошенник: чернуха"],["danon666","tg","Мошенник"],["S63205228","tg","Мошенник"],["danon7","tg","Мошенник"],["fidger232","tg","Мошенник"],["Limeexc","tg","Мошенник"],["aist789","tg","Мошенник"],["ceo_firstpay","tg","Мошенник"],["mamaeveldarhan","tg","Мошенник"],["p2pberkart","tg","Мошенник"],["sqwerty16","tg","Мошенник"],["platarus","tg","Мошенник"],["xasbik_p2p","tg","Мошенник"],["Vantoroz","tg","Мошенник"],["ramzes_09093","tg","Мошенник"],["xasbik8","tg","Мошенник: ссылка на приватный ордер"],["roxmax_q","tg","Мошенник"],["mishanyatrc","tg","Мошенник"],["demidkoo_p2p","tg","Мошенник"],["arffi98","tg","Мошенник"],["ggghfkh","tg","Мошенник"],["Jordan12549","tg","Мошенник"],["tyu34456","tg","Мошенник: чернуха"],["Royal_Claw","tg","Мошенник: фейк чеки"],["usdtKing45","tg","Мошенник: персональный ордер"],["mizual_0","tg","Мошенник"],["barboskin_888","tg","Мошенник"],["dovechno","tg","Мошенник"],["P2PBRATAN","tg","Мошенник: рисует чеки"],["managerp2pa","tg","Мошенник: рисует чеки"],["Chimnaz_k","tg","Мошенник"],["Alex_AxeP2P","tg","Мошенник"],["kukich7222","tg","Мошенник"],["wwwwwwwwwwww124575","tg","Мошенник"],["evgeniy_p2p","tg","Мошенник: чернуха"],["angelyxxxiq","tg","Мошенник: скам"],["Kvantixp2p","tg","Мошенник: скам"],["mvpmvpmvpmvpmvp1","tg","Мошенник"],["royal_ca1","tg","Мошенник: скрывает платежи"],["junior_teams","tg","Мошенник: скам ссылка"],["cry1ptoking","tg","Мошенник"],["pauren1","tg","Мошенник"],["p2p_exchenge2","tg","Мошенник"],["magulaya","tg","Мошенник"],["only_usdt07","tg","Мошенник: чернуха"],["kennysssq","tg","Мошенник"],["ctocto005","tg","Мошенник"],["5429939962","tg","Мошенник"],["tintedcoupe","tg","Мошенник"],["leika154","tg","Мошенник"],["toriosw","tg","Мошенник"],["smsmonica","tg","Мошенник: чернуха"],["qaziho","tg","Мошенник: фейковая ссылка"],["Islam21321","tg","Мошенник: чернуха"],["Liderman1","tg","Мошенник"],["chootkup","tg","Мошенник"],["bmwshn1k3","tg","Мошенник"],["clearp2p2","tg","Мошенник"],["vlad_dorom","tg","Мошенник"],["sheni_deda_motha","tg","Мошенник"],["tretipotok1","tg","Мошенник"],["socuf","tg","Мошенник"],["v1v1p1","tg","Мошенник"],["XTEAMXTUT","tg","Мошенник"],["zzzz123456689","tg","Мошенник"],["ctotamktotam","tg","Мошенник"],["cryptop2p1111","tg","Мошенник"],["P2Paui","tg","Мошенник"],["self_dert","tg","Мошенник"],["xbitdesk","tg","Мошенник"],["Hursdeiks2","tg","Мошенник"],["hurshed2003","tg","Мошенник"],["kukanot822222","tg","Мошенник"],["wayfshuesos","tg","Мошенник: фейк ссылка"],["Pibadi_1","tg","Морозит USDT"],["TrustFlov","tg","Морозит USDT"],["User89349e4dL5","bb","Морозит USDT (ник на Bybit)"],["zenvaro","bb","Морозит USDT (ник на Bybit)"],["P2PAlex2000","tg","Морозит USDT"],["finibybit","tg","Мошенник"],["Arbimasterbb","tg","Мошенник"],["TonySopranoBybit","tg","Мошенник"],["JuniorSopranoBybit","tg","Мошенник"],["Nextusdt","tg","Мошенник"],["goroo777","tg","Мошенник"],["Wwwww3i4","tg","Мошенник"],["AndrewKorshyn","tg","Мошенник: чернуха"],["DaviidenkoD","tg","Мошенник: чернуха"],["abu_L777","tg","Мошенник"],["eldar4ikjj","tg","Мошенник"],["StoneIslandOrders","tg","Мошенник"],["WayfsO77","tg","Мошенник"],["KirichMal","tg","Мошенник"],["dontUSElirika","tg","Мошенник: продает постоянных клиентов"],["RuSkOkO","tg","Мошенник"],["sanyav9889","tg","Мошенник"],["monetka_exh","tg","Мошенник"],["hateapth","tg","Мошенник: фейк Эльдархана"],["PARMALATT","tg","Мошенник: чернуха"],["neIegaI_77","tg","Мошенник"],["barbarosssas","tg","Мошенник"],["amfp2p_bot","tg","Мошенник"],["westyp2p","tg","Мошенник"],["gidovv","tg","Мошенник"],["hamzap2p77","tg","Мошенник: продает постоянных клиентов"],["maxximP2P","tg","Мошенник"],["miamib0ss","tg","Мошенник"],["tengo_001","tg","Мошенник"],["noxchy_obmen95","tg","Мошенник: продает мейкера"],["TENKA_adm","tg","Мошенник"],["VERITYCYCLE","tg","Мошенник"],["frickpart","tg","Мошенник"],["traxal_p2p","tg","Мошенник: фейк ссылка на ордер"],["P2PNETUPIM","tg","Мошенник"],["Mohamedsalim1978","tg","Мошенник"],["mikhail_leva","tg","Мошенник"],["homashoot","tg","Мошенник"],["makotraher","tg","Мошенник"],["P2p_Joined","tg","Мошенник: обучение мейкера"],["jshavqhaubsv178","tg","Мошенник: обучение мейкера"],["alex_780433343992","tg","Мошенник"],["isaMagomedov66","tg","Мошенник"],["sasha000009","tg","Мошенник"],["Nikita_Sergeevich0","tg","Мошенник"],["mobil_tehnika_online","tg","Мошенник"],["SiriusSalomonCEO","tg","Мошенник"],["mefedronp2p","tg","Мошенник"],["essax","tg","Мошенник"],["hdjdjfjkll","tg","Мошенник"],["karapzzz","tg","Мошенник"],["Alkanp2p","tg","Мошенник: площадка"],["self_zina","tg","Мошенник: площадка"],["arm_039","tg","Мошенник: продает постоянных клиентов"],["express_pay_admin","tg","Мошенник"],["Shalapay666","tg","Мошенник"],["mamba_500","tg","Мошенник: фейк ссылка"],["asdmm0","tg","Мошенник: фейк ссылка"],["nikitapof","tg","Мошенник"],["Qoroq_Otrisovka","tg","Мошенник"],["p22ppl","tg","Мошенник"],["yunr0","tg","Мошенник"],["p2p_exchan","tg","Мошенник"],["frantsuzFR","tg","Мошенник"],["fzglav","tg","Мошенник"],["muhtarp2p","tg","Мошенник"],["trappausdt","tg","Мошенник"],["krepistnoy99","tg","Мошенник"],["kaxxtany","tg","Мошенник"],["plsstr","tg","Мошенник"],["USDT34456","tg","Мошенник"],["Youngboy_64","tg","Мошенник"],["damir_m77","tg","Мошенник"],["usernamexe","tg","Мошенник"],["kloiqeq","tg","Мошенник: скам сайт бб"],["igoroklq","tg","Мошенник: скам сайт бб"],["derioopx","tg","Мошенник: бутерброд"],["alex780433343992","tg","Мошенник: бутерброд"],["drag11111","tg","Мошенник: постоянные клиенты"],["DalyaUp","tg","Мошенник"],["Elda_p2p","tg","Мошенник"],["vip_tut","tg","Мошенник"],["yaydjeqi73","tg","Мошенник"],["ahyenskyyy","tg","Мошенник: фейк ссылка"],["sjsjw_su","tg","Мошенник"],["kkeess77","tg","Мошенник"],["skxjwjd","tg","Мошенник"],["ComeCletzo","tg","Мошенник"],["Bazar_Tengen","tg","Мошенник: чернуха"],["sanua_p2p","tg","Мошенник: продает обучение"],["Doksicsa","tg","Мошенник"],["rexiiiip","tg","Мошенник"],["rufatga","tg","Мошенник"]];

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
  "EXISTS(SELECT 1 FROM scam z WHERE COALESCE(z.src, 'tg') = 'tg' AND lower(z.handle) = lower(m.username)) AS mscam, " +
  "EXISTS(SELECT 1 FROM scam z WHERE COALESCE(z.src, 'tg') = 'tg' AND lower(z.handle) = lower(t.username)) AS tscam " +
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

    try { this.sql.exec("ALTER TABLE scam ADD COLUMN src TEXT"); } catch (e) {}
    if (!this.get("SELECT v FROM meta WHERE k = 'scam_seed1'")) {
      const now = Date.now();
      SCAM_SEED.forEach((x) => {
        const dup = this.get("SELECT id FROM scam WHERE lower(handle) = lower(?) AND COALESCE(src, 'tg') = ?", x[0], x[1]);
        if (!dup) this.sql.exec("INSERT INTO scam (handle, reason, created_at, src) VALUES (?, ?, ?, ?)", x[0], x[2], now, x[1]);
      });
      this.sql.exec("INSERT INTO meta (k, v) VALUES ('scam_seed1', 1)");
    }
    ["min_amount", "max_amount"].forEach((c) => {
      try { this.sql.exec("ALTER TABLE users ADD COLUMN " + c + " REAL"); } catch (e) {}
    });
    ["f_side", "f_pdf"].forEach((c) => {
      try { this.sql.exec("ALTER TABLE users ADD COLUMN " + c + " TEXT"); } catch (e) {}
    });
    ["side", "pdf"].forEach((c) => {
      try { this.sql.exec("ALTER TABLE orders ADD COLUMN " + c + " TEXT"); } catch (e) {}
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
    const adm = this.isAdmin(me); // ники участников скрыты от всех, кроме администратора
    const isM = r.merchant_id === me;
    return {
      id: r.id,
      amount: r.amount,
      rate: r.rate,
      side: r.side === "sell" ? "sell" : "buy",
      pdf: r.pdf || null,
      note: r.note || "",
      status: r.status,
      role: isM ? "merchant" : "taker",
      created_at: r.created_at,
      taken_at: r.taken_at,
      done_at: r.done_at,
      expires_at: r.created_at + OPEN_TTL,
      other: isM
        ? r.taker_id ? { label: adm ? label(r.tusername, r.tname) : "скрыт", reg: !!r.treg, scam: !!r.tscam } : null
        : { label: adm ? label(r.musername, r.mname) : "скрыт", reg: !!r.mreg, scam: !!r.mscam },
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

    const me = this.get("SELECT online, min_amount, max_amount, f_side, f_pdf FROM users WHERE id = ?", u.id);
    const online = !!(me && me.online);
    const lo = me && me.min_amount != null ? me.min_amount : null;
    const hi = me && me.max_amount != null ? me.max_amount : null;
    const fs = me && me.f_side ? me.f_side : null;
    const fp = me && me.f_pdf ? me.f_pdf : null;
    let free = [];
    if (online) {
      free = this.all(
        "SELECT o.id, o.amount, o.rate, o.side, o.pdf, o.note, o.created_at, m.name AS mname, m.username AS musername, " +
        "EXISTS(SELECT 1 FROM regs r WHERE lower(r.handle) = lower(m.username)) AS mreg, " +
        "EXISTS(SELECT 1 FROM scam z WHERE COALESCE(z.src, 'tg') = 'tg' AND lower(z.handle) = lower(m.username)) AS mscam " +
        "FROM orders o JOIN users m ON m.id = o.merchant_id " +
        "WHERE o.status = 'open' AND o.merchant_id <> ? " +
        "AND NOT EXISTS (SELECT 1 FROM bans b WHERE b.order_id = o.id AND b.user_id = ?) " +
        "AND (? IS NULL OR o.amount >= ?) AND (? IS NULL OR o.amount <= ?) " +
        "AND (? IS NULL OR COALESCE(o.side, 'buy') = ?) " +
        "AND (? IS NULL OR o.pdf = ?) " +
        "ORDER BY o.created_at DESC LIMIT 50", u.id, u.id, lo, lo, hi, hi, fs, fs, fp, fp
      ).map((r) => ({
        id: r.id, amount: r.amount, rate: r.rate, side: r.side === "sell" ? "sell" : "buy", pdf: r.pdf || null, note: r.note || "",
        created_at: r.created_at, expires_at: r.created_at + OPEN_TTL,
        merchant: this.isAdmin(u.id) ? label(r.musername, r.mname) : "Мерчант", reg: !!r.mreg, scam: !!r.mscam,
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
      ok: true, rev: rev, now: now, online: online, range: { min: lo, max: hi }, filter: { min: lo, max: hi, side: fs, pdf: fp },
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
    const side = b.side === "buy" || b.side === "sell" ? b.side : null;
    const pdf = b.pdf === "yes" || b.pdf === "no" ? b.pdf : null;
    this.sql.exec("UPDATE users SET min_amount = ?, max_amount = ?, f_side = ?, f_pdf = ? WHERE id = ?", lo, hi, side, pdf, u.id);
    return { ok: true, range: { min: lo, max: hi }, filter: { min: lo, max: hi, side: side, pdf: pdf } };
  }

  async create(u, b) {
    const now = Date.now();
    const amount = Math.round(Number(b.amount) * 100) / 100;
    const rate = Math.round(Number(b.rate) * 100) / 100;
    if (!(amount >= 100 && amount <= 10000000)) throw new UserError("Сумма: от 100 до 10 000 000 ₽.");
    if (!(rate >= 1 && rate <= 1000)) throw new UserError("Курс: от 1 до 1000 ₽ за USDT.");
    const note = String(b.note || "").trim().slice(0, 300);
    const side = b.side === "sell" ? "sell" : "buy";
    const pdf = b.pdf === "no" ? "no" : "yes";
    this.expire(now);
    const open = this.get("SELECT COUNT(*) AS c FROM orders WHERE merchant_id = ? AND status = 'open'", u.id).c;
    if (open >= MAX_OPEN) throw new UserError("Уже есть " + MAX_OPEN + " открытые заявки. Дождитесь исполнителя или отмените лишнюю.");
    const last = this.get("SELECT MAX(created_at) AS t FROM orders WHERE merchant_id = ?", u.id);
    if (last && last.t && now - last.t < COOLDOWN) throw new UserError("Подождите несколько секунд перед следующей заявкой.");
    const id = this.sql.exec(
      "INSERT INTO orders (merchant_id, amount, rate, side, pdf, note, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?) RETURNING id",
      u.id, amount, rate, side, pdf, note, now
    ).one().id;
    this.bump();

    const ids = this.all(
      "SELECT id FROM users WHERE online = 1 AND id <> ? AND last_seen > ? " +
      "AND (min_amount IS NULL OR min_amount <= ?) AND (max_amount IS NULL OR max_amount >= ?) " +
      "AND (f_side IS NULL OR f_side = ?) AND (f_pdf IS NULL OR f_pdf = ?) LIMIT 100", u.id, now - DAY, amount, amount, side, pdf
    ).map((r) => r.id);
    const usdt = money(amount / rate);
    const me = this.get("SELECT EXISTS(SELECT 1 FROM regs r WHERE lower(r.handle) = lower(?)) AS x", u.username || "").x;
    await this.notify(ids, "Новая заявка #" + id + (me ? " от постоянника" : "") + ": " + (side === "buy" ? "покупка" : "продажа") + " " + money(amount) + " ₽ по курсу " + money(rate) + " (≈ " + usdt + " USDT)." + " " + (side === "buy" ? (pdf === "yes" ? "ПДФ дам." : "ПДФ не дам.") : (pdf === "yes" ? "Нужен ПДФ." : "ПДФ не нужен.")) + (note ? "\n" + note : ""));
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
    this.addMsg(id, 0, "sys", "Исполнитель взял заявку. Договоритесь в чате и отправьте ссылку на ордер Bybit.");
    this.bump();
    await this.notify([r.merchant_id], "Исполнитель взял вашу заявку #" + id + ": " + money(r.amount) + " ₽ по курсу " + money(r.rate) + ". Откройте чат в приложении.");
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
      this.addMsg(id, 0, "sys", "Мерчант отменил заявку.");
    } else {
      // Исполнитель отказался: заявка возвращается в список, повторно взять её он не сможет.
      this.sql.exec("INSERT OR IGNORE INTO bans (order_id, user_id) VALUES (?, ?)", id, u.id);
      this.sql.exec("UPDATE orders SET status = 'open', taker_id = NULL, taken_at = NULL, ok_m = 0, ok_t = 0 WHERE id = ?", id);
      this.sql.exec("DELETE FROM msgs WHERE order_id = ?", id);
      this.notify([r.merchant_id], "Исполнитель отказался от заявки #" + id + ". Она снова в списке и ждёт исполнителя.");
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
      await this.notify([otherId], "Новое сообщение по заявке #" + id + ".");
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
      this.addMsg(id, 0, "sys", (r.merchant_id === u.id ? "Мерчант" : "Исполнитель") + " подтвердил(а) завершение. Ждём вторую сторону.");
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
    const rows = this.all("SELECT id, handle, reason, created_at, src FROM scam ORDER BY id DESC");
    return { ok: true, admin: this.isAdmin(u.id), scam: rows.map((r) => ({ id: r.id, handle: r.handle, reason: r.reason || "", at: r.created_at, src: r.src === "bb" ? "bb" : "tg" })) };
  }
  scamSave(u, b) {
    if (!this.isAdmin(u.id)) throw new UserError("Список обманщиков пополняет администратор.");
    const handle = String(b.handle || "").trim().replace(/^@/, "").slice(0, 64);
    if (handle.length < 2) throw new UserError("Укажите ник или имя.");
    const reason = String(b.reason || "").trim().slice(0, 1000);
    const src = b.src === "bb" ? "bb" : "tg";
    if (b.id) this.sql.exec("UPDATE scam SET handle = ?, reason = ?, src = ? WHERE id = ?", handle, reason, src, Number(b.id));
    else this.sql.exec("INSERT INTO scam (handle, reason, created_at, src) VALUES (?, ?, ?, ?)", handle, reason, Date.now(), src);
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
