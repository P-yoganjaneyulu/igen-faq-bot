const { Client, GatewayIntentBits, Partials } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const YOUR_SERVER_URL = process.env.YOUR_SERVER_URL || 'https://igen-faq-bot.onrender.com/webhook/discord';

client.on('messageCreate', async (message) => {
  // Ignore bot's own messages
  if (message.author.bot) return;

  // Only process replies
  if (!message.reference) return;

  try {
    // Fetch the referenced message
    const referenced = await message.channel.messages.fetch(message.reference.messageId);

    // Prepare payload
    const payload = {
      author: { username: message.author.username, bot: message.author.bot },
      content: message.content,
      referenced_message: {
        content: referenced.content,
        embeds: referenced.embeds.map(e => ({
          fields: e.fields?.map(f => ({ name: f.name, value: f.value }))
        }))
      }
    };

    // POST to your server
    await axios.post(YOUR_SERVER_URL, payload);
    console.log('Forwarded reply to server:', payload);
  } catch (err) {
    console.error('Error forwarding reply:', err);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);