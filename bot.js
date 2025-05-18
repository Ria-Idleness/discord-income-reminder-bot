require('dotenv').config();  // これをファイルの一番上に追加

const { Client, GatewayIntentBits } = require('discord.js');
const cron = require('node-cron');

// トークン・チャンネルIDは環境変数で管理
const TOKEN = process.env.DISCORD_TOKEN;  // ←ここを修正
const CHANNEL_ID = process.env.CHANNEL_ID || '1373592729870667787'; // チャンネルIDも環境変数化推奨

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// 以下、省略（今のままでOK）

// ...

client.login(TOKEN);
