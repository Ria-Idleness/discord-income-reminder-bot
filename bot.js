require('dotenv').config();

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

// 疑似WebサーバーでRenderの「ポート監視」を回避する
const express = require('express');
const app = express();

app.get('/', (req, res) => res.send('Bot is running!'));

app.listen(process.env.PORT || 3000, () => {
  console.log('Web server started to keep Render happy.');
});

