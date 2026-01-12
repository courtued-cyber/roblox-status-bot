require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const express = require('express');

// Express server setup
const app = express();
const PORT = process.env.PORT || 3000;

// Simple heartbeat endpoint to keep Railway active
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = "1460087487635390556";
const UNIVERSE_ID = 9504987215;
const UPDATE_INTERVAL = 30000; // 30 seconds

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
let statusMessage = null;
let highestPlayers = 0;

// Fetch Roblox game stats
async function getGameStats() {
  const res = await axios.get(`https://games.roblox.com/v1/games?universeIds=${UNIVERSE_ID}`);
  const data = res.data.data[0];
  return {
    name: data.name,
    players: data.playing,
    favorites: data.favoritedCount,
    visits: data.visits
  };
}

// Update Discord message
async function updateStatus() {
  try {
    const stats = await getGameStats();

    if (stats.players > highestPlayers) highestPlayers = stats.players;
    const diff = stats.players - highestPlayers;
    const diffSymbol = diff > 0 ? "📈 Up" : diff < 0 ? "📉 Down" : "⏸️ Stable";
    const diffValue = Math.abs(diff);

    const messageContent = `[🎮] **${stats.name.toUpperCase()} **

[👥] Active Players: **${stats.players}**
[🏆] Highest Milestone: **${highestPlayers}** (${diffSymbol} by ${diffValue})
[⭐] Favorites: **${stats.favorites}**
[👁️‍🗨️] Visits: **${stats.visits}**

*Last updated <t:${Math.floor(Date.now() / 1000)}:R>*`;

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!statusMessage) {
      statusMessage = await channel.send(messageContent);
    } else {
      await statusMessage.edit(messageContent);
    }

    console.log(`Updated status: ${stats.players} players`); // heartbeat log for Railway

  } catch (err) {
    console.error("Failed to update status:", err.message);
  }
}

// Use 'ready' event safely
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  updateStatus();
  setInterval(updateStatus, UPDATE_INTERVAL);

  // Optional heartbeat log so Railway sees activity
  setInterval(() => {
    console.log("Bot is alive");
  }, 30000);
});

client.login(TOKEN);
