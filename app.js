const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.on('ready', () => {
  console.log(`Nexus S Shop Bot is online and ready for everything! (${client.user.tag})`);
});

client.on('messageCreate', msg => {
  // تجاهل رسائل البوتات الأخرى لمنع التكرار
  if (msg.author.bot) return;

  const content = msg.content.toLowerCase();

  // 1. نظام التيكتات وفتح التذاكر
  if (content === 'تيكت' || content === 'ticket' || content === 'تذاكر' || content === 'طلب') {
    msg.reply('🎟️ **نظام التيكتات والطلب في Nexus S Shop:**\nلطلب أي منتج أو فتح تيكت خاصة بك، يرجى التوجه إلى روم الـ (tickets) المخصص والضغط على زر فتح التيكت، وسيتم خدمتك بأسرع وقت! ✨');
  }

  // 2. شوب ومتجر روبلكس والمنتجات
  if (content === 'شوب' || content === 'shop' || content === 'متجر' || content === 'المنتجات') {
    msg.reply('🛒 أهلاً بك في **Nexus S Shop**! نوفر لك أفضل منتجات روبلكس وخدمات الدعم. تصفح الرومات الخاصة بالمنتجات وللشراء افتح تيكت جديدة 🎟️.');
  }

  // 3. الأسعار والستور
  if (content === 'اسعار' || content === 'أسعار' || content === 'prices' || content === 'المنيو') {
    msg.reply('📋 **قائمة الأسعار والمنتجات:**\nجميع الأسعار وتفاصيل المنتجات موضحة بالكامل في الرومات الخاصة بها بالسيرفر، تصفحها وافتح تيكت عند اختيار طلبك!');
  }

  // 4. طرق الدفع المتاحة
  if (content === 'طرق الدفع' || content === 'دفع' || content === 'شحن' || content === 'robux') {
    msg.reply('💳 **طرق الدفع المتاحة:**\n- روبلكس (Robux)\n- بطاقات / تحويلات حسب المتجر\nتأكد من مراجعة روم طرق الدفع أو سؤال الإدارة داخل التيكت.');
  }

  // 5. الدعم الفني والأمان
  if (content === 'دعم' || content === 'تواصل' || content === 'إدارة' || content === 'مساعدة') {
    msg.reply('🛠️ **الدعم الفني والإدارة:**\nللمساعدة أو الاستفسارات الخاصة، افتح تيكت دعم فني. ⚠️ **تنبيه هام:** لا تشارك كلمة سر حسابك أبداً مع أي شخص، الإدارة لا تطلبها منك نهائياً!');
  }

  // 6. الترحيب العام
  if (content === 'السلام عليكم' || content === 'سلام عليكم' || content === 'hi' || content === 'hello') {
    msg.reply('وعليكم السلام ورحمة الله وبركاته! منور سيرفر **Nexus S Shop** ✨ كيف يمكننا مساعدتك اليوم؟');
  }
});

// تسجيل الدخول باستخدام المتوكن المخفي في إعدادات Render
client.login(process.env.DISCORD_TOKEN);

// خادم ويب وهمي لإبقاء البوت يعمل 24/7 دون توقف على موقع Render
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Nexus S Shop Bot is running 24/7 successfully!');
});
server.listen(process.env.PORT || 3000);
