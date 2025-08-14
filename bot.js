require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const cron = require('node-cron');
const express = require('express');

// タイムゾーンを日本時間に設定
process.env.TZ = 'Asia/Tokyo';

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

client.on('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}!`);
  console.log(`📍 現在のタイムゾーン: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  console.log(`🕒 現在の日本時間: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
  console.log(`🤖 BOT ID: ${client.user.id}`);
  console.log(`🔧 BOT状態: オンライン`);
});

// エラーハンドリングを追加
client.on('error', error => {
  console.error('❌ Discord client error:', error);
});

client.on('warn', warn => {
  console.warn('⚠️ Discord client warning:', warn);
});

process.on('unhandledRejection', error => {
  console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
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
    const currentTime = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    await message.reply(`収入リマインダーは現在 **${reminderActive ? 'オン' : 'オフ'}** です。\n現在の日本時間: ${currentTime}`);
  } else if (content === '!income test') {
    await sendReminder(true); // 強制送信（テスト用）
  } else if (content === '!income schedule') {
    const currentTime = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const restrictedStatus = isInRestrictedPeriod() ? '送信禁止期間中' : '送信可能';
    await message.reply(`**スケジュール設定:**
送信時刻: 0:50 / 4:50 / 8:50 / 12:50 / 16:50 / 20:50
送信禁止: 月曜17:00～火曜17:00

現在時刻: ${currentTime}
現在の状態: ${restrictedStatus}`);
  } else if (content === '!income next' || content === '!next') {
    const timeInfo = getTimeUntilNext();
    await message.reply(timeInfo);
  }
});

async function sendReminder(force = false) {
  if (!reminderActive && !force) return;
  
  const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel) return;
  
  const currentTime = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  console.log(`[${currentTime}] 収入リマインダーを送信中...`);
  
  await channel.send(`<@&${MENTION_ROLE_ID}> Collect income !\n収入を回収してください！`);
}

// 送信禁止期間かどうかを判定する関数
function isInRestrictedPeriod() {
  const now = new Date();
  const jstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const day = jstDate.getDay(); // 0=日曜, 1=月曜, 2=火曜, ...
  const hour = jstDate.getHours();
  
  // 月曜17:00～火曜17:00は送信しない
  if (day === 1 && hour >= 17) {
    // 月曜日の17時以降
    return true;
  } else if (day === 2 && hour < 17) {
    // 火曜日の17時未満
    return true;
  }
  
  return false;
}

// 次回通知時間を計算する関数
function getNextNotificationTime() {
  const now = new Date();
  const jstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  
  const notificationTimes = [
    { hour: 0, minute: 50 },
    { hour: 4, minute: 50 },
    { hour: 8, minute: 50 },
    { hour: 12, minute: 50 },
    { hour: 16, minute: 50 },
    { hour: 20, minute: 50 }
  ];
  
  const currentHour = jstDate.getHours();
  const currentMinute = jstDate.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;
  
  // 今日の通知時間を確認
  for (let time of notificationTimes) {
    const notificationTime = time.hour * 60 + time.minute;
    if (notificationTime > currentTime) {
      // 今日のこの時間はまだ来ていない
      const nextDate = new Date(jstDate);
      nextDate.setHours(time.hour, time.minute, 0, 0);
      
      // 送信禁止期間チェック
      const testDay = nextDate.getDay();
      const testHour = nextDate.getHours();
      const isRestricted = (testDay === 1 && testHour >= 17) || (testDay === 2 && testHour < 17);
      
      if (!isRestricted) {
        return nextDate;
      }
    }
  }
  
  // 今日の通知時間は全て過ぎているので、明日以降を探す
  let searchDate = new Date(jstDate);
  searchDate.setDate(searchDate.getDate() + 1);
  
  // 最大7日間検索
  for (let i = 0; i < 7; i++) {
    for (let time of notificationTimes) {
      const nextDate = new Date(searchDate);
      nextDate.setHours(time.hour, time.minute, 0, 0);
      
      // 送信禁止期間チェック
      const testDay = nextDate.getDay();
      const testHour = nextDate.getHours();
      const isRestricted = (testDay === 1 && testHour >= 17) || (testDay === 2 && testHour < 17);
      
      if (!isRestricted) {
        return nextDate;
      }
    }
    searchDate.setDate(searchDate.getDate() + 1);
  }
  
  return null; // 見つからない場合
}

// 時間差を人間が読みやすい形式で返す関数
function getTimeUntilNext() {
  const nextTime = getNextNotificationTime();
  if (!nextTime) {
    return "次回通知時間を計算できませんでした";
  }
  
  const now = new Date();
  const jstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const diffMs = nextTime.getTime() - jstNow.getTime();
  
  if (diffMs <= 0) {
    return "計算エラーが発生しました";
  }
  
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  
  const currentTimeStr = jstNow.toLocaleString('ja-JP', { 
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short'
  });
  
  const nextTimeStr = nextTime.toLocaleString('ja-JP', { 
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short'
  });
  
  if (hours > 0) {
    return `現在時刻: ${currentTimeStr}\n次回通知まで **${hours}時間${minutes}分** です\n次回通知時刻: ${nextTimeStr}`;
  } else {
    return `現在時刻: ${currentTimeStr}\n次回通知まで **${minutes}分** です\n次回通知時刻: ${nextTimeStr}`;
  }
}

// 通知時間のスケジュール（日本時間で設定）
const scheduleTimes = ['50 0', '50 4', '50 8', '50 12', '50 16', '50 20'];

scheduleTimes.forEach(time => {
  cron.schedule(`${time} * * *`, () => {
    const now = new Date();
    const currentTime = now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const jstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    const day = jstDate.getDay();
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    
    console.log(`[${currentTime}] Cron実行 - ${dayNames[day]}曜日`);
    
    if (isInRestrictedPeriod()) {
      console.log(`送信禁止期間中のためスキップ（月曜17:00～火曜17:00）`);
      return;
    }
    
    sendReminder();
  }, {
    scheduled: true,
    timezone: 'Asia/Tokyo'
  });
});

// Discordログイン
console.log('🚀 Discord BOT起動中...');
console.log(`🔑 TOKEN設定: ${TOKEN ? '設定済み' : '未設定'}`);
console.log(`📢 CHANNEL_ID: ${CHANNEL_ID || '未設定'}`);

client.login(TOKEN).then(() => {
  console.log('✅ Discord login成功');
}).catch(error => {
  console.error('❌ Discord login失敗:', error);
  process.exit(1);
});

// Renderのポート監視用サーバー
const app = express();

app.get('/', (req, res) => {
  const currentTime = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const botStatus = client.user ? `オンライン (${client.user.tag})` : 'オフライン';
  
  res.send(`
    <h1>Discord Income Reminder Bot</h1>
    <p><strong>BOT状態:</strong> ${botStatus}</p>
    <p><strong>現在の日本時間:</strong> ${currentTime}</p>
    <p><strong>リマインダー状態:</strong> ${reminderActive ? 'オン' : 'オフ'}</p>
    <p><strong>送信禁止期間:</strong> ${isInRestrictedPeriod() ? 'Yes' : 'No'}</p>
    <hr>
    <p><strong>環境変数チェック:</strong></p>
    <ul>
      <li>DISCORD_TOKEN: ${process.env.DISCORD_TOKEN ? '設定済み' : '❌ 未設定'}</li>
      <li>CHANNEL_ID: ${process.env.CHANNEL_ID || '❌ 未設定'}</li>
      <li>PORT: ${process.env.PORT || '3000'}</li>
    </ul>
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
  console.log(`📊 Health check: http://localhost:${port}/health`);
});