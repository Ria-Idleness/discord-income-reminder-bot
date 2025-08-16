import { Client, GatewayIntentBits } from "discord.js";
import cron from "node-cron";
import express from "express";

const token = process.env.DISCORD_TOKEN;
const channelId = process.env.CHANNEL_ID;
const mentionRoleId = process.env.MENTION_ROLE_ID; // ← 環境変数に変更推奨

if (!token || !channelId) {
  console.error("ERROR: DISCORD_TOKEN, CHANNEL_ID (必要なら MENTION_ROLE_ID) を環境変数に設定してください");
  process.exit(1);
}

// NodeのTZを日本時間に固定
process.env.TZ = "Asia/Tokyo";

// Discordクライアント
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// JSTベースの曜日・時刻チェック
function isInRestrictedPeriod() {
  const now = new Date(); // TZがJSTなのでそのままOK
  const day = now.getDay(); // 0:日曜, 1:月曜...
  const hour = now.getHours();

  return (day === 1 && hour >= 17) || (day === 2 && hour < 17);
}

// 定期送信処理
cron.schedule("0 0 20 * * *", async () => {
  if (isInRestrictedPeriod()) {
    console.log("制限時間内のため送信スキップ");
    return;
  }

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      console.error("チャンネルが見つかりません");
      return;
    }
    await channel.send(
      `<@&${mentionRoleId}> 本日分のインカム入力をお忘れなく！`
    );
    console.log("メッセージ送信成功");
  } catch (error) {
    console.error("メッセージ送信エラー:", error);
  }
}, {
  timezone: "Asia/Tokyo", // cronもJSTで動作
});

// 起動ログ
client.once("ready", () => {
  console.log(`ログイン完了: ${client.user.tag}`);
});

// keep-alive (Render対策)
const app = express();
app.get("/", (req, res) => res.send("Bot is running"));
app.listen(process.env.PORT || 3000, () => {
  console.log("Webサーバー起動");
});

client.login(token);
