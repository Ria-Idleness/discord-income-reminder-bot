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

// リマインダーメッセージを送信する関数
async function sendReminder() {
  if (!reminderActive) return;

  // 月曜17時〜火曜17時は送信しない
  const now = new Date();
  const day = now.getDay(); // 0=日曜,1=月曜,...6=土曜
  const hour = now.getHours();

  // 月曜17時以降かつ火曜17時未満を除外
  if (
    (day === 1 && hour >= 17) ||
    (day === 2 && hour < 17)
  ) {
    return;
  }

  const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel) return;

  await channel.send('<@&1365109317363044432> @Clan member Collect income !\n収入を回収してください！');
}

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
    sendReminder(); // リマインダー送信（返信はなし）
  }
});

// 指定時間帯に通知を送るcronスケジュール
const times = ['50 0 * * *', '50 4 * * *', '50 8 * * *', '50 12 * * *', '50 16 * * *', '50 20 * * *'];
times.forEach((time) => {
  cron.schedule(time, () => {
    sendReminder();
  });
});

client.login(TOKEN);

// Webサーバー（Renderのポート監視用）
const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000, () => {
  console.log('Web server started to keep Render happy.');
});
