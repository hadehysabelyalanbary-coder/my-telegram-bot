const { Bot, InlineKeyboard } = require("grammy");
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

// أمر /start لفتح المحتوى مباشرة عبر زر مدمج تحت الرسالة
bot.command("start", async (ctx) => {
  registerUser(ctx);

  const inlineKeyboard = new InlineKeyboard()
    .webApp("📱 تصفح المحتوى الآن (هذه سبيلي)", WEB_APP_URL)
    .row()
    .url("📩 تواصل مع الإدارة", `tg://user?id=${ADMIN_ID}`);

  await ctx.reply(
    `السلام عليكم ورحمة الله وبركاته\nأهلاً بك / بكِ يا ${ctx.from.first_name} على قناة هذه سبيلي\n\nاضغط على الزر أدناه لتصفح المحتوى مباشرة 👇\n\nلا تنسونا من صالح الدعاء`,
    { reply_markup: inlineKeyboard }
  );
});

// أمر الإحصائيات خاص بالأدمن
bot.command("stats", async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  const totalUsers = Object.keys(db.users).length;
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const activeUsers = Object.values(db.users).filter(
    (u) => u.lastActive > oneDayAgo
  ).length;

  await ctx.reply(
    `📈 **إحصائيات البوت (الإدارة):**\n\n` +
      `👥 **إجمالي المستخدمين:** ${totalUsers}\n` +
      `⚡ **النشطين خلال 24 ساعة:** ${activeUsers}\n\n` +
      `للإرسال الجماعي، قم بعمل Reply على أي رسالة واكتب \`/broadcast\``
  );
});

bot.on("message", async (ctx) => {
  registerUser(ctx);
  const userId = ctx.from.id;

  // رد الأدمن على الزبائن
  if (userId === ADMIN_ID && ctx.message.reply_to_message) {
    const targetUserId = db.supportMap[ctx.message.reply_to_message.message_id];
    if (targetUserId) {
      await ctx.api.copyMessage(targetUserId, ctx.chat.id, ctx.message.message_id);
      await ctx.reply("✅ تم إرسال الرد إلى الزبون بنجاح.");
      return;
    }
  }

  // إرسال جماعي (Broadcast) للأدمن
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

  // إذا أرسل المستخدم رسالة عادية للادارة
  if (userId !== ADMIN_ID) {
    const forwarded = await ctx.api.forwardMessage(
      ADMIN_ID,
      ctx.chat.id,
      ctx.message.message_id
    );
    db.supportMap[forwarded.message_id] = userId;
    saveDB();

    await ctx.reply("✅ تم إيصال رسالتك للإدارة، وسنرد عليك في أقرب وقت.");
  }
});

bot.start();
console.log("🤖 البوت يعمل بنجاح الان...");
