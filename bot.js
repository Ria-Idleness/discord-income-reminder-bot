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

const REMINDER_ROLE_ID = '1399374765243891722';

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
    const day = now.getUTCDay(); // UTCベース
    const hour = now.getUTCHours();

    // 月曜17:00～火曜17:00 JST (UTC 8:00～翌日8:00)は送信禁止
    const isBlocked = (day === 1 && hour >= 8) || // 月曜17:00以降 JST
                      (day === 2 && hour < 8);   // 火曜17:00まで JST
    if (!force && isBlocked) return;

    const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
    if (!channel) return;

    await channel.send(`<@&${REMINDER_ROLE_ID}> Collect income!\n収入を回収してください！`);
}

// JST: 0:50 / 4:50 / 8:50 / 12:50 / 16:50 / 20:50 → UTC に変換
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
