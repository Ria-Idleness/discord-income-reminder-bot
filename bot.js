require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const cron = require('node-cron');
const express = require('express');

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const MENTION_ROLE_ID = process.env.MENTION_ROLE_ID || '1399374765243891722'; // ロールID

if (!TOKEN || !CHANNEL_ID) {
  console.error('ERROR: DISCORD_TOKENとCHANNEL_IDを環境変数に設定してください');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

let reminderActive = false;

client.on('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}!`);
  console.log(`🔧 BOT状態: オンライン`);
});

// ----------------------------------------
// メッセージコマンド処理
// ----------------------------------------
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== CHANNEL_ID) return;

  const content = message.content.trim();

  if (content === '!income on') {
    reminderActive = true;
    await message.reply('収入リマインダーをオンにしました！');
  } else if (content === '!income off') {
    reminderActive = false;
    await message.reply('収入リマインダーをオフにしました！');
  } else if (content === '!income status') {
    const currentTime = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    await message.reply(`収入リマインダーは現在 **${reminderActive ? 'オン' : 'オフ'}** です。\n現在の日本時間: ${currentTime}`);
  } else if (content === '!income test') {
    await sendReminder(true);
  } else if (content === '!income schedule') {
    const currentTime = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const restrictedStatus = isInRestrictedPeriod() ? '送信禁止期間中' : '送信可能';
    await message.reply(`**スケジュール設定:**\n送信時刻: 0:50 / 4:50 / 8:50 / 12:50 / 16:50 / 20:50\n送信禁止: 月曜17:00～火曜17:00\n\n現在時刻: ${currentTime}\n現在の状態: ${restrictedStatus}`);
  }
});

// ----------------------------------------
// 送信処理
// ----------------------------------------
async function sendReminder(force = false) {
  if (!reminderActive && !force) return;

  const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel) return;

  if (!force && isInRestrictedPeriod()) {
    const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    console.log(`[${now}] 送信禁止期間中のためスキップ`);
    return;
  }

  const nowJST = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  console.log(`[${nowJST}] 収入リマインダーを送信中...`);

  await channel.send(`<@&${MENTION_ROLE_ID}> Collect income !\n収入を回収してください！`);
}

// ----------------------------------------
// 送信禁止期間判定
// 月曜17:00～火曜17:00 JST
// ----------------------------------------
function isInRestrictedPeriod() {
  const now = new Date();
  const jstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const day = jstDate.getDay(); // 0=日曜, 1=月曜, ...
  const hour = jstDate.getHours();

  return (day === 1 && hour >= 17) || (day === 2 && hour < 17);
}

// ----------------------------------------
// cronスケジュール設定（UTC基準で日本時間に合わせる）
// JST = UTC +9
// JST 0:50 → UTC 15:50（前日）
// JST 4:50 → UTC 19:50（前日）
// JST 8:50 → UTC 23:50（前日）
// JST 12:50 → UTC 3:50
// JST 16:50 → UTC 7:50
// JST 20:50 → UTC 11:50
// ----------------------------------------
const scheduleTimesUTC = ['50 15', '50 19', '50 23', '50 3', '50 7', '50 11'];

scheduleTimesUTC.forEach(time => {
  cron.schedule(`${time} * * *`, () => {
    const jstNow = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const jstDate = new Date(jstNow);
    const day = jstDate.getDay();
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    console.log(`[${jstNow}] Cron実行 - ${dayNames[day]}曜日`);

    sendReminder();
  }, {
    scheduled: true,
    timezone: 'UTC' // cron自体はUTC
  });
});

// ----------------------------------------
// Discordログイン
// ----------------------------------------
client.login(TOKEN);

// ----------------------------------------
// Renderのポート監視用サーバー
// ----------------------------------------
const app = express();
app.get('/', (req, res) => {
  const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const botStatus = client.user ? `オンライン (${client.user.tag})` : 'オフライン';
  res.send(`
    <h1>Discord Income Reminder Bot</h1>
    <p><strong>BOT状態:</strong> ${botStatus}</p>
    <p><strong>現在の日本時間:</strong> ${now}</p>
    <p><strong>リマインダー状態:</strong> ${reminderActive ? 'オン' : 'オフ'}</p>
    <p><strong>送信禁止期間:</strong> ${isInRestrictedPeriod() ? 'Yes' : 'No'}</p>
  `);
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    botOnline: client.user ? true : false,
    timestamp: new Date().toISOString()
  });
});

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`🌐 Web server started on port ${port}`);
});
