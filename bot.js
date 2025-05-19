require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const cron = require('node-cron');
const express = require('express');

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const CLAN_ROLE_ID = '1365109317363044432'; // ← @Clan member ロールID

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

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
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
    sendReminder();
    await message.reply('テスト送信しました！');
  }
});

// リマインダー送信関数
async function sendReminder() {
  if (!reminderActive) return;

  const now = new Date();
  const day = now.getDay(); // 0=日, 1=月, ..., 6=土
  const hour = now.getHours();

  // 月曜17:00～火曜16:59は通知しない
  if ((day === 1 && hour >= 17) || (day === 2 && hour < 17)) {
    console.log('スキップ：収入通知停止時間内');
    return;
  }

  const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel) return;

  channel.send({
    content: `<@&${CLAN_ROLE_ID}>\n収入を回収してください！`,
    allowedMentions: { roles: [CLAN_ROLE_ID] }
  });
}

// 通知スケジュール
const times = ['50 0 * * *', '50 4 * * *', '50 8 * * *', '50 12 * * *', '50 16 * * *', '50 20 * * *'];
times.forEach(schedule => {
  cron.schedule(schedule, () => {
    console.log(`リマインダー実行: ${schedule}`);
    sendReminder();
  });
});

// Botログイン
client.login(TOKEN);

// Render対策：簡易Webサーバー
const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000, () => {
  console.log('Web server started to keep Render happy.');
});
