// bot.js
import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import cron from 'node-cron';
import express from 'express';

// Node実行環境をJSTに固定
process.env.TZ = 'Asia/Tokyo';

// --- 必須ENV ---
const token = process.env.DISCORD_TOKEN;
const channelId = process.env.CHANNEL_ID;
// --- 任意(推奨): ロールメンション用 ---
const mentionRoleId = '1399374765243891722'; // ← ここだけ固定

if (!token || !channelId) {
  console.error('ERROR: DISCORD_TOKEN と CHANNEL_ID を Render の環境変数に設定してください。');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // ← これがないとコマンドに反応しません
  ],
});

// デフォルト: 通知ON（!income offで停止できます）
let enabled = true;

client.once('ready', () => {
  console.log(`ログイン完了: ${client.user.tag}`);
});

// コマンド処理
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (message.channel.id !== channelId) return;

  const text = message.content.trim();

  if (text === '!income on') {
    enabled = true;
    await message.reply('通知をONにしました！');
  } else if (text === '!income off') {
    enabled = false;
    await message.reply('通知をOFFにしました！');
  } else if (text === '!income status') {
    await message.reply(`現在の通知状態: **${enabled ? 'ON ✅' : 'OFF ❌'}**\nCH: ${channelId}`);
  } else if (text === '!income test') {
    await sendReminder({ force: true });
  } else if (text === '!income next' || text === '!next') {
    await message.reply(getNextTimeText());
  }
});

// リマインダー本体
async function sendReminder({ force = false } = {}) {
  if (!enabled && !force) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    console.error('送信先チャンネルが取得できませんでした');
    return;
  }

  const mention = mentionRoleId ? `<@&${mentionRoleId}> ` : '';
  await channel.send(`${mention}Collect income !\n収入を回収してください！`);
}

// 0:50 / 4:50 / 8:50 / 12:50 / 16:50 / 20:50（JST）
const hours = [0, 4, 8, 12, 16, 20];
for (const h of hours) {
  // 秒 分 時 日 月 曜
  const expr = `0 50 ${h} * * *`;
  cron.schedule(
    expr,
    () => {
      console.log(`cron ${h}:50 (JST) fired. enabled=${enabled}`);
      sendReminder();
    },
    { timezone: 'Asia/Tokyo' }
  );
}

// 次回時刻テキスト
function getNextTimeText() {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const today = hours.map((h) => h * 60 + 50).filter((t) => t > nowMin);

  let next;
  if (today.length) {
    const t = today[0];
    next = new Date(now);
    next.setHours(Math.floor(t / 60), t % 60, 0, 0);
  } else {
    next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(hours[0], 50, 0, 0);
  }

  const jp = next.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `次回の通知は **${jp}** の予定です。`;
}

// Render のヘルスチェック用
const app = express();
app.get('/', (_req, res) => res.send('Bot is running'));
app.listen(process.env.PORT || 3000, () => console.log('Webサーバー起動'));

client.login(token);
cc