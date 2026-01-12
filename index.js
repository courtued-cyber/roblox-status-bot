require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const express = require('express');
const fs = require('fs'); // Built-in module for file operations

// ================= Express server =================
const app = express();
const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// ================= Config =================
const TOKEN = process.env.TOKEN;
const CHANNEL_ID = "1460087487635390556";
const UNIVERSE_ID = 9504987215;
const UPDATE_INTERVAL = 60000; // 1 minute (60000 milliseconds)

// ================= File Operations =================
const HIGHEST_FILE = './highestPlayers.json'; // File to store highest players

// Read highest player count from file
function readHighestPlayers() {
  try {
    const data = fs.readFileSync(HIGHEST_FILE, 'utf8');
    return JSON.parse(data).highestPlayers || 0;
  } catch (err) {
    return 0; // Default if no file or error
  }
}

// Write highest player count to file
function writeHighestPlayers(highestPlayers) {
  const data = JSON.stringify({ highestPlayers });
  fs.writeFileSync(HIGHEST_FILE, data);
}

// ================= Discord Client =================
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
let statusMessage = null;
let highestPlayers = readHighestPlayers(); // Initialize from file

// ================= Fetch Roblox Game Stats =================
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

// ================= Update Discord Status =================
async function updateStatus() {
  try {
    const stats = await getGameStats();

    if (stats.players > highestPlayers) {
      highestPlayers = stats.players;
      writeHighestPlayers(highestPlayers); // Save new highest milestone
    }

    // Calculate the difference for milestone
    const diff = stats.players - highestPlayers;
    let diffText = "";

    // Only show "Up by" or "Down by" if there's a change
    if (diff > 0) {
      diffText = `📈 Up by ${diff}`;
    } else if (diff < 0) {
      diffText = `📉 Down by ${Math.abs(diff)}`;
    }

    // Format the Discord message
    const messageContent = `[🎮] **${stats.name.toUpperCase()} **

[👥] Active Players: **${stats.players}**
[🏆] Highest Milestone: **${highestPlayers}** (${diffText})
[⭐] Favorites: **${stats.favorites}**
[👁️‍🗨️] Visits: **${stats.visits}**

*Last updated <t:${Math.floor(Date.now() / 1000)}:R>*`;

    // Send or edit the status message
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!statusMessage) {
      statusMessage = await channel.send(messageContent);
    } else {
      await statusMessage.edit(messageContent);
    }

    console.log(`Updated status: ${stats.players} players`);

  } catch (err) {
    console.error("Failed to update status:", err.message);
  }
}

// ================= Discord Ready =================
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);

  updateStatus();
  setInterval(updateStatus, UPDATE_INTERVAL);

  // Optional heartbeat log
  setInterval(() => console.log("Bot is alive"), UPDATE_INTERVAL);
});

// ================= Login =================
client.login(TOKEN);
