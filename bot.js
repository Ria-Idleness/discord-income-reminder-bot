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
  // ボット自身や別チャンネルは無視
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
  }
});

// 定期タスク（例：毎日9時にメッセージ送信）
cron.schedule('0 9 * * *', async () => {
  if (!reminderActive) return;
  const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel) return;
  channel.send('おはようございます！今日の収入リマインダーです。');
});

client.login(TOKEN);

// Webサーバー（Renderのポート監視用）
const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000, () => {
  console.log('Web server started to keep Render happy.');
});
