const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ] 
});

client.on('ready', () => {
  console.log(`Nexus S Shop & Full Server Bot is online! (${client.user.tag})`);
  client.user.setActivity('Nexus S Shop | تيكت وطلب', { type: 3 }); // Activity: Watching
});

client.on('messageCreate', msg => {
  if (msg.author.bot) return;
  const content = msg.content.toLowerCase();

  // 1. نظام التيكتات والطلب والشراء
  if (content === 'تيكت' || content === 'ticket' || content === 'تذاكر' || content === 'طلب' || content === 'شراء') {
    msg.reply('🎟️ **نظام التيكتات والطلب في Nexus S Shop:**\nلطلب أي منتج، شحن، أو فتح تيكت خاصة بك، يرجى التوجه إلى روم الـ (tickets) المخصص والضغط على زر فتح التيكت، وسيتم خدمتك بأسرع وقت! ✨');
  }

  // 2. شوب ومتجر روبلكس والمنتجات
  if (content === 'شوب' || content === 'shop' || content === 'متجر' || content === 'المنتجات' || content === 'روبلكس') {
    msg.reply('🛒 أهلاً بك في **Nexus S Shop**! نوفر لك أفضل منتجات روبلكس وخدمات الدعم. تصفح الرومات الخاصة بالمنتجات وللشراء افتح تيكت جديدة 🎟️.');
  }

  // 3. الأسعار والمنيو
  if (content === 'اسعار' || content === 'أسعار' || content === 'prices' || content === 'المنيو' || content === 'الاسعار') {
    msg.reply('📋 **قائمة الأسعار والمنتجات:**\nجميع الأسعار وتفاصيل المنتجات موضحة بالكامل في الرومات الخاصة بها بالسيرفر، تصفحها وافتح تيكت عند اختيار طلبك!');
  }

  // 4. طرق الدفع المتاحة
  if (content === 'طرق الدفع' || content === 'دفع' || content === 'شحن' || content === 'robux' || content === 'تحويل') {
    msg.reply('💳 **طرق الدفع المتاحة في السيرفر:**\n- روبلكس (Robux)\n- بطاقات / تحويلات حسب المتجر\nتأكد من مراجعة روم طرق الدفع أو سؤال الإدارة داخل التيكت.');
  }

  // 5. الأمان والتشفير والتحذيرات
  if (content === 'تشفير' || content === 'امان' || content === 'أمان' || content === 'سرقة' || content === 'نصب') {
    msg.reply('🔒 **نظام الحماية والأمان في Nexus S:**\n⚠️ **تنبيه هام جداً:** لا تشارك كلمة سر حسابك، البريد الإلكتروني، أو أي معلومات شخصية مع أي شخص أبداً! الإدارة لا تطلب منك كلمة السر نهائياً، واحرص على الحذر من الروابط الوهمية.');
  }

  // 6. الدعم الفني والإدارة
  if (content === 'دعم' || content === 'تواصل' || content === 'إدارة' || content === 'مساعدة' || content === 'حل مشكلة') {
    msg.reply('🛠️ **الدعم الفني والإدارة:**\nللمساعدة أو الاستفسارات الخاصة، افتح تيكت دعم فني. فريق الإدارة جاهز دائماً لمساعدتك.');
  }

  // 7. الترحيب العام والسلام
  if (content === 'السلام عليكم' || content === 'سلام عليكم' || content === 'hi' || content === 'hello' || content === 'هلا') {
    msg.reply('وعليكم السلام ورحمة الله وبركاته! منور سيرفر **Nexus S Shop** ✨ كيف يمكننا مساعدتك اليوم؟');
  }
});

// تسجيل الدخول باستخدام المتوكن المخفي في إعدادات Render
client.login(process.env.DISCORD_TOKEN);

// خادم ويب وهمي لإبقاء البوت يعمل 24/7 دون توقف على موقع Render
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Nexus S Shop & Full Server Bot is running 24/7 successfully!');
});
server.listen(process.env.PORT || 3000);
