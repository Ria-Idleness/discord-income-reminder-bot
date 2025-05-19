require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const cron = require('node-cron');
const express = require('express');

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

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
  console.log(`Logged in as ${client.user.tag}!`);
});

// メッセージ受信イベント
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
    await message.reply(`収入リマインダーは現在 **${reminderActive ? 'オン' : 'オフ'}** です。`);
  } else if (content === '!income test') {
    await sendReminder(true);  // テストモードですぐ送信
  }
});

// リマインダー送信関数（本番/テスト兼用）
async function sendReminder(force = false) {
  if (!reminderActive && !force) return;

  const now = new Date();
  const day = now.getDay(); // 0:日曜, 1:月曜, ..., 6:土曜
  const hour = now.getHours();

  // 通常運用時のみ制限（force = true の場合は無視）
  if (!force && ((day === 1 && hour >= 17) || (day === 2 && hour < 17))) {
    return;
  }

  const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel) return;

  channel.send('<@&1365109317363044432> Collect income !\n収入を回収してください！');
}

// 指定時間に定期送信（cron形式: 分 時 * * *）
const times = ['50 0', '50 4', '50 8', '50 12', '50 16', '50 20'];
times.forEach(time => {
  cron.schedule(`${time} * * *`, () => sendReminder());
});

// Discordにログイン
client.login(TOKEN);

// Webサーバー（Render用）
const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000, () => {
  console.log('Web server started to keep Render happy.');
});
