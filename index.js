const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = "1460087487635390556";
const PLACE_ID = 138321611995773;
const UNIVERSE_ID = 9504987215;
const UPDATE_INTERVAL = 30000;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
let statusMessage = null;
let highestPlayers = 0;

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
  } catch (err) {
    console.error(err.message);
  }
}

client.once('clientReady', () => {
  updateStatus();
  setInterval(updateStatus, UPDATE_INTERVAL);
});

client.login(TOKEN);
