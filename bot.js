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
    await sendReminder(true); // 強制送信（テスト用）
  }
});

async function sendReminder(force = false) {
  if (!reminderActive && !force) return;

  const now = new Date();
  const day = now.getDay(); // 0:日曜, 1:月曜, ..., 6:土曜
  const hour = now.getHours();

  // 通常送信時（月曜19:50 / 火曜全体は送信禁止）
  if (!force) {
    const isBlocked =
      (day === 1 && hour >= 16) ||  // 月曜 16:00 以降 →ブロック（19:50含む）
      (day === 2);                 // 火曜全体 →ブロック

    if (isBlocked) return;
  }

  const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel) return;

  channel.send('<@&1365109317363044432> Collect income !\n収入を回収してください！');
}

// スケジュール設定（cron形式：分 時 * * *）
// 火曜以外
const nonTuesdayTimes = ['50 23', '50 3', '50 7', '50 11', '50 15'];
nonTuesdayTimes.forEach(time => {
  cron.schedule(`${time} * * *`, () => {
    const day = new Date().getDay();
    if (day !== 2) sendReminder();
  });
});

// 月曜以外
cron.schedule('50 19 * * *', () => {
  const day = new Date().getDay();
  if (day !== 1) sendReminder();
});

// Discordログイン
client.login(TOKEN);

// Renderのポート監視用サーバー
const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000, () => {
  console.log('Web server started to keep Render happy.');
});
