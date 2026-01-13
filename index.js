require("dotenv").config();
const { Client, GatewayIntentBits, ActivityType } = require("discord.js");
const axios = require("axios");
const express = require("express");
const fs = require("fs");

// ================= Express Keep-Alive Server =================
const app = express();
const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
  console.log("Received ping from UptimeRobot!");
  res.send("Bot is alive!");
});

app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// ================= Config =================
const TOKEN = process.env.TOKEN;
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
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
let statusMessage = null;
let highestPlayers = readHighestPlayers();

// ================= Fetch Roblox Game Stats =================
async function getGameStats() {
  const res = await axios.get(
    `https://games.roblox.com/v1/games?universeIds=${UNIVERSE_ID}`,
  );
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

    // Update highest milestone if needed
    if (stats.players > highestPlayers) {
      highestPlayers = stats.players;
      writeHighestPlayers(highestPlayers);
    }

    const diff = stats.players - highestPlayers;
    let diffText =
      diff > 0
        ? `📈 Up by ${diff}`
        : diff < 0
          ? `📉 Down by ${Math.abs(diff)}`
          : `⏸️ Stable`;

    // ===== Channel Message =====
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

    // ===== Rotating Presence =====
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
        status: "dnd", // Do Not Disturb
        activities: [
          { name: presenceMessages[i], type: ActivityType.Watching },
        ],
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

  // Initial update
  updateStatus();
  setInterval(updateStatus, UPDATE_INTERVAL);

  // Heartbeat log
  setInterval(() => console.log("Bot is alive"), UPDATE_INTERVAL);
});

// ================= Login =================
client.login(TOKEN);
