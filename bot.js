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
    await sendReminder(true); // 強制送信
  }
});

async function sendReminder(force = false) {
  if (!reminderActive && !force) return;

  const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel) return;

  channel.send('<@&1365109317363044432> Collect income !\n収入を回収してください！');
}

// cron形式: '分 時 日 月 曜日'

// 火曜日以外: 0:50, 4:50, 8:50, 12:50, 16:50 → cronで火曜 (2) 除外
const timesExceptTuesday = ['50 0 * * 0,1,3,4,5,6', '50 4 * * 0,1,3,4,5,6', '50 8 * * 0,1,3,4,5,6', '50 12 * * 0,1,3,4,5,6', '50 16 * * 0,1,3,4,5,6'];

// 月曜日以外: 20:50 → cronで月曜 (1) 除外
const timeExceptMonday = ['50 20 * * 0,2,3,4,5,6'];

// 登録
[...timesExceptTuesday, ...timeExceptMonday].forEach(schedule => {
  cron.schedule(schedule, () => sendReminder());
});

client.login(TOKEN);

// Webサーバー（Render用）
const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000, () => {
  console.log('Web server started to keep Render happy.');
});
