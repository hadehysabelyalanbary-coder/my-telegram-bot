const { Bot, Keyboard } = require("grammy");
const http = require("http");
const fs = require("fs");

const BOT_TOKEN = "8704729964:AAGBjFRl7XNmc6oOfL4fw5Z4gEdWVO-EM3M";
const ADMIN_ID = 8691612879;
const WEB_APP_URL = "https://eclectic-zabaione-f1c24d.netlify.app/";

const bot = new Bot(BOT_TOKEN);

const DB_FILE = "./database.json";
let db = { users: {}, supportMap: {} };

if (fs.existsSync(DB_FILE)) {
  db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
} else {
  fs.writeFileSync(DB_FILE, JSON.stringify(db));
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function registerUser(ctx) {
  const userId = ctx.from.id;
  const now = Date.now();
  if (!db.users[userId]) {
    db.users[userId] = {
      id: userId,
      first_name: ctx.from.first_name,
      username: ctx.from.username || "",
      joinedAt: now,
      lastActive: now,
    };
  } else {
    db.users[userId].lastActive = now;
  }
  saveDB();
}

// أمر /start مع إظهار زر الإحصائيات للآدمن فقط
bot.command("start", async (ctx) => {
  registerUser(ctx);

  const keyboard = new Keyboard()
    .webApp("هذه سبيلي | لأبي علي الأنباري 📱", WEB_APP_URL)
    .row()
    .text("📩 تواصل مع الإدارة");

  if (ctx.from.id === ADMIN_ID) {
    keyboard.row().text("📊 الإحصائيات");
  }

  keyboard.resized();

  await ctx.reply(
    `السلام عليكم ورحمة الله وبركاته\nأهلاً بك يا ${ctx.from.first_name} على قناة هذه سبيلي المتخصصة في نشر تراث الشيخ الأنباري تقبله الله\n\nلا تنسونا من صالح الدعاء`,
    { reply_markup: keyboard }
  );
});

// دالة لحساب وعرض الإحصائيات (شاملة الشهر واليوم)
async function sendStats(ctx) {
  if (ctx.from.id !== ADMIN_ID) return;

  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const totalUsers = Object.keys(db.users).length;
  
  const active24h = Object.values(db.users).filter(
    (u) => u.lastActive > oneDayAgo
  ).length;

  const active30d = Object.values(db.users).filter(
    (u) => u.lastActive > thirtyDaysAgo
  ).length;

  await ctx.reply(
    `📈 **إحصائيات البوت (الإدارة):**\n\n` +
      `👥 **إجمالي المشتركين:** ${totalUsers}\n` +
      `📅 **النشطين خلال آخر 30 يوماً:** ${active30d}\n` +
      `⚡ **النشطين خلال آخر 24 ساعة:** ${active24h}\n\n` +
      `للإرسال الجماعي، قم بعمل Reply على أي رسالة واكتب \`/broadcast\``
  );
}

bot.hears("📊 الإحصائيات", sendStats);
bot.command("stats", sendStats);

bot.hears("📩 تواصل مع الإدارة", async (ctx) => {
  registerUser(ctx);
  await ctx.reply(
    "أهلاً بك! يمكنك إرسال استفسارك أو رسالتك الآن، وسيقوم فريق الإدارة بالرد عليك فوراً."
  );
});

bot.on("message", async (ctx) => {
  registerUser(ctx);
  const userId = ctx.from.id;

  if (userId === ADMIN_ID && ctx.message.reply_to_message) {
    const targetUserId = db.supportMap[ctx.message.reply_to_message.message_id];
    if (targetUserId) {
      await ctx.api.copyMessage(targetUserId, ctx.chat.id, ctx.message.message_id);
      await ctx.reply("✅ تم إرسال الرد إلى الزبون بنجاح.");
      return;
    }
  }

  if (userId === ADMIN_ID && ctx.message.text && ctx.message.text.startsWith("/broadcast")) {
    const messageToBroadCast = ctx.message.reply_to_message;
    if (!messageToBroadCast) {
      return ctx.reply("⚠️ يرجى عمل Reply (رد) على الرسالة التي تريد إرسالها للجميع واكتب `/broadcast`.");
    }

    let success = 0;
    let fail = 0;
    const users = Object.keys(db.users);

    for (const id of users) {
      try {
        await ctx.api.copyMessage(id, ctx.chat.id, messageToBroadCast.message_id);
        success++;
      } catch (e) {
        fail++;
      }
    }
    return ctx.reply(`📢 **اكتمل الإرسال الجماعي:**\n✅ تم بنجاح: ${success}\n❌ فشل: ${fail}`);
  }

  if (userId !== ADMIN_ID) {
    const forwarded = await ctx.api.forwardMessage(
      ADMIN_ID,
      ctx.chat.id,
      ctx.message.message_id
    );
    db.supportMap[forwarded.message_id] = userId;
    saveDB();

    await ctx.reply("✅  تم إيصال رسالتك للإدارة، وسنرد عليك في أقرب وقت إن يسَّر الله.");
  }
});

// خادم وهمي لإرضاء منصة Render
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot is running perfectly!");
}).listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

bot.start();
console.log("🤖 البوت يعمل بنجاح الان...");
