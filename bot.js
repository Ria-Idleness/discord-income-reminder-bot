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
    ],
});

let reminderActive = false;

// 日本時間送信スケジュール（JST）
const jstSchedule = [ { h:0, m:50 }, { h:4, m:50 }, { h:8, m:50 }, { h:12, m:50 }, { h:16, m:50 }, { h:20, m:50 } ];

// Discord起動
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// メッセージ処理
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
    } else if (content === '!income schedule') {
        const next = getNextSchedule();
        await message.reply(`次の収入リマインダーは **${next.hours}時間${next.minutes}分後** に送信予定です。`);
    }
});

// 収入送信関数
async function sendReminder(force = false) {
    if (!reminderActive && !force) return;

    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const day = jst.getDay();  // 0:日, 1:月, ..., 6:土
    const hour = jst.getHours();
    const minute = jst.getMinutes();

    // 月曜17:00～火曜17:00は送信禁止
    const isBlocked = (day === 1 && hour >= 17) || (day === 2 && hour < 17);
    if (!force && isBlocked) return;

    const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
    if (!channel) return;

    channel.send('<@&1399374765243891722> Collect income !\n収入を回収してください！');
}

// 次回送信時間計算（schedule用）
function getNextSchedule() {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);

    let nextTime = null;

    for (let i = 0; i < jstSchedule.length; i++) {
        const sched = jstSchedule[i];
        const candidate = new Date(jst);
        candidate.setHours(sched.h, sched.m, 0, 0);

        // 過ぎていたら翌日
        if (candidate <= jst) candidate.setDate(candidate.getDate() + 1);

        // 月曜17～火曜17ブロックを考慮
        const day = candidate.getDay();
        const hour = candidate.getHours();
        const blocked = (day === 1 && hour >= 17) || (day === 2 && hour < 17);
        if (blocked) {
            candidate.setDate(candidate.getDate() + 1);
            candidate.setHours(jstSchedule[0].h, jstSchedule[0].m, 0, 0);
        }

        if (!nextTime || candidate < nextTime) nextTime = candidate;
    }

    const diffMs = nextTime - jst;
    const hours = Math.floor(diffMs / 1000 / 60 / 60);
    const minutes = Math.floor((diffMs / 1000 / 60) % 60);

    return { hours, minutes };
}

// cronスケジュール（UTCに変換）
const cronTimesUTC = ['50 15', '50 19', '50 23', '50 3', '50 7', '50 11'];
cronTimesUTC.forEach(time => {
    cron.schedule(`${time} * * *`, () => {
        sendReminder();
    });
});

// Discordログイン
client.login(TOKEN);

// Renderのポート監視用サーバー
const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000, () => {
    console.log('Web server started to keep Render happy.');
});
