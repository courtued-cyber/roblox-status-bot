require("dotenv").config();
const { Client, GatewayIntentBits, ActivityType } = require("discord.js");
const axios = require("axios");
const express = require("express");
const fs = require("fs");
const { Configuration, OpenAIApi } = require("openai");

// ================= Express Keep-Alive Server =================
const app = express();
const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
  console.log("Received ping from UptimeRobot!");
  res.send("Bot is alive!");
});

app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// ================= Config =================
const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = "1460087487635390556";
const UNIVERSE_ID = 9504987215;
const UPDATE_INTERVAL = 60000; // 1 minute
const PRESENCE_INTERVAL = 10000; // 10 seconds rotation
const HIGHEST_FILE = "./highestPlayers.json";

// ================= File Operations =================
function readHighestPlayers() {
  try {
    const data = fs.readFileSync(HIGHEST_FILE, "utf8");
    return JSON.parse(data).highestPlayers || 0;
  } catch {
    return 0;
  }
}

function writeHighestPlayers(highestPlayers) {
  fs.writeFileSync(HIGHEST_FILE, JSON.stringify({ highestPlayers }));
}

// ================= Discord Client =================
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent
  ] 
});
let statusMessage = null;
let highestPlayers = readHighestPlayers();

// ================= OpenAI Setup =================
const configuration = new Configuration({ apiKey: process.env.OPENAI_KEY });
const openai = new OpenAIApi(configuration);

// ================= Roblox Game Stats =================
async function getGameStats() {
  const res = await axios.get(`https://games.roblox.com/v1/games?universeIds=${UNIVERSE_ID}`);
  const data = res.data.data[0];

  return {
    name: data.name,
    players: data.playing,
    favorites: data.favoritedCount,
    visits: data.visits,
  };
}

// ================= Update Discord Status =================
async function updateStatus() {
  try {
    const stats = await getGameStats();

    if (stats.players > highestPlayers) {
      highestPlayers = stats.players;
      writeHighestPlayers(highestPlayers);
    }

    const diff = stats.players - highestPlayers;
    const diffText =
      diff > 0 ? `📈 Up by ${diff}` :
      diff < 0 ? `📉 Down by ${Math.abs(diff)}` :
      `⏸️ Stable`;

    const messageContent = `[🎮] **${stats.name.toUpperCase()}**  

[👥] Active Players: **${stats.players}**  
[🏆] Highest Milestone: **${highestPlayers}** (${diffText})  
[⭐] Favorites: **${stats.favorites}**  
[👁️‍🗨️] Visits: **${stats.visits}**  

*Last updated <t:${Math.floor(Date.now() / 1000)}:R>*`;

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!statusMessage) {
      statusMessage = await channel.send(messageContent);
    } else {
      await statusMessage.edit(messageContent);
    }

    console.log(`Updated status: ${stats.players} players`);

    const presenceMessages = [
      `${stats.players} players in-game :3`,
      `${stats.favorites} total favorites! :3`,
      `${stats.visits} total visits! :3`,
      `Currently Managing ${stats.name} Network!`,
    ];

    let i = 0;
    if (client.presenceInterval) clearInterval(client.presenceInterval);

    client.presenceInterval = setInterval(() => {
      client.user.setPresence({
        status: "dnd",
        activities: [{ name: presenceMessages[i], type: ActivityType.Watching }],
      });
      i = (i + 1) % presenceMessages.length;
    }, PRESENCE_INTERVAL);

  } catch (err) {
    console.error("Failed to update status:", err.message);
  }
}

// ================= Discord Ready =================
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  updateStatus();
  setInterval(updateStatus, UPDATE_INTERVAL);
  setInterval(() => console.log("Bot is alive"), UPDATE_INTERVAL);
});

// ================= AI Chat / Mention Response =================
const cooldowns = new Map();

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.mentions.has(client.user)) {
    const userId = message.author.id;

    // 5-second cooldown per user
    if (cooldowns.has(userId)) {
      return message.reply("⏳ Please wait a few seconds before chatting again!");
    }
    cooldowns.set(userId, true);
    setTimeout(() => cooldowns.delete(userId), 5000);

    const userMessage = message.content.replace(/<@!?(\d+)>/, "").trim();
    if (!userMessage) {
      return message.reply("Hello! Ping me and we can chat about anything 😄");
    }

    try {
      const completion = await openai.createChatCompletion({
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are a friendly Discord bot that chats with users." },
          { role: "user", content: userMessage },
        ],
      });

      const reply = completion?.data?.choices?.[0]?.message?.content;
      if (!reply) return message.reply("Hmm, I didn't get a response 😅");

      await message.reply(reply);
    } catch (err) {
      console.error("Failed to respond via AI:", err);
      await message.reply("Oops, something went wrong while trying to chat 😅");
    }
  }
});

// ================= Login =================
client.login(TOKEN);

