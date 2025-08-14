require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const cron = require('node-cron');
const express = require('express');

// 環境変数
const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const MENTION_ROLE_ID = '1399374765243891722'; // ロールID

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

// Discord起動時
client.on('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}!`);
  console.log(`🕒 現在の日本時間: ${new Date(new Date().getTime() + 9*60*60*1000).toLocaleString('ja-JP')}`);
});

// エラーハンドリング
client.on('error', console.error);
client.on('warn', console.warn);
process.on('unhandledRejection', console.error);
process.on('uncaughtException', error => { console.error(error); process.exit(1); });

// コマンド処理
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== CHANNEL_ID) return;

  const content = message.content.trim();
  const currentTime = new Date(new Date().getTime() + 9*60*60*1000).toLocaleString('ja-JP');

  if (content === '!income on') {
    reminderActive = true;
    await message.reply('収入リマインダーをオンにしました！');
  } else if (content === '!income off') {
    reminderActive = false;
    await message.reply('収入リマインダーをオフにしました！');
  } else if (content === '!income status') {
    await message.reply(`収入リマインダーは現在 **${reminderActive ? 'オン' : 'オフ'}** です。\n現在の日本時間: ${currentTime}`);
  } else if (content === '!income test') {
    await sendReminder(true);
  } else if (content === '!income schedule') {
    const restrictedStatus = isInRestrictedPeriod() ? '送信禁止期間中' : '送信可能';
    await message.reply(`**スケジュール設定:**
送信時刻: 0:50 / 4:50 / 8:50 / 12:50 / 16:50 / 20:50
送信禁止: 月曜17:00～火曜17:00

現在時刻: ${currentTime}
現在の状態: ${restrictedStatus}`);
  } else if (content === '!income next' || content === '!next') {
    await message.reply(getTimeUntilNext());
  }
});

// リマインダー送信
async function sendReminder(force = false) {
  if (!reminderActive && !force) return;

  const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const currentTime = new Date(new Date().getTime() + 9*60*60*1000).toLocaleString('ja-JP');
  console.log(`[${currentTime}] 収入リマインダー送信`);
  
  await channel.send(`<@&${MENTION_ROLE_ID}> Collect income !\n収入を回収してください！`);
}

// 送信禁止期間チェック（JST）
function isInRestrictedPeriod() {
  const nowJST = new Date(new Date().getTime() + 9*60*60*1000);
  const day = nowJST.getDay();
  const hour = nowJST.getHours();

  return (day === 1 && hour >= 17) || (day === 2 && hour < 17);
}

// 次回通知時間計算
function getNextNotificationTime() {
  const nowJST = new Date(new Date().getTime() + 9*60*60*1000);

  const times = [
    {h:0, m:50}, {h:4, m:50}, {h:8, m:50},
    {h:12, m:50}, {h:16, m:50}, {h:20, m:50}
  ];

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    for (let t of times) {
      const next = new Date(nowJST);
      next.setDate(nowJST.getDate() + dayOffset);
      next.setHours(t.h, t.m, 0, 0);
      if (next > nowJST && !((next.getDay() === 1 && t.h >= 17) || (next.getDay() === 2 && t.h < 17))) {
        return next;
      }
    }
  }
  return null;
}

// 次回通知までの時間文字列
function getTimeUntilNext() {
  const next = getNextNotificationTime();
  if (!next) return "次回通知時間を計算できませんでした";

  const nowJST = new Date(new Date().getTime() + 9*60*60*1000);
  const diffMin = Math.floor((next - nowJST)/60000);
  const h = Math.floor(diffMin/60);
  const m = diffMin % 60;

  const nowStr = nowJST.toLocaleString('ja-JP', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', weekday:'short' });
  const nextStr = next.toLocaleString('ja-JP', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', weekday:'short' });

  return h > 0
    ? `現在時刻: ${nowStr}\n次回通知まで **${h}時間${m}分** です\n次回通知時刻: ${nextStr}`
    : `現在時刻: ${nowStr}\n次回通知まで **${m}分** です\n次回通知時刻: ${nextStr}`;
}

// JST通知時間 -> UTC変換cron
const scheduleTimesUTC = ['50 15', '50 19', '50 23', '50 3', '50 7', '50 11']; // JST 0:50/4:50/8:50/12:50/16:50/20:50

scheduleTimesUTC.forEach(time => {
  cron.schedule(`${time} * * *`, () => {
    const nowJST = new Date(new Date().getTime() + 9*60*60*1000);
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    console.log(`[${nowJST.toLocaleString('ja-JP')}] Cron実行 - ${dayNames[nowJST.getDay()]}曜日`);

    if (isInRestrictedPeriod()) {
      console.log('送信禁止期間中のためスキップ');
      return;
    }

    sendReminder();
  });
});

// Discordログイン
client.login(TOKEN).then(() => console.log('✅ Discord login成功')).catch(console.error);

// Renderポート監視サーバー
const app = express();
app.get('/', (req,res) => {
  const nowJST = new Date(new Date().getTime() + 9*60*60*1000);
  const botStatus = client.user ? `オンライン (${client.user.tag})` : 'オフライン';
  res.send(`
    <h1>Discord Income Reminder Bot</h1>
    <p><strong>BOT状態:</strong> ${botStatus}</p>
    <p><strong>現在の日本時間:</strong> ${nowJST.toLocaleString('ja-JP')}</p>
    <p><strong>リマインダー状態:</strong> ${reminderActive ? 'オン' : 'オフ'}</p>
    <p><strong>送信禁止期間:</strong> ${isInRestrictedPeriod() ? 'Yes' : 'No'}</p>
    <hr>
    <ul>
      <li>DISCORD_TOKEN: ${TOKEN ? '設定済み' : '❌ 未設定'}</li>
      <li>CHANNEL_ID: ${CHANNEL_ID ? '設定済み' : '❌ 未設定'}</li>
      <li>PORT: ${process.env.PORT || 3000}</li>
    </ul>
  `);
});

app.get('/health', (req,res) => {
  res.status(200).json({ status:'OK', botOnline: !!client.user, timestamp: new Date().toISOString() });
});

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => console.log(`🌐 Web server started on port ${port}`));
