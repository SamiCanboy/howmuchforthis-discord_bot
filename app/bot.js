console.log('Bot Starting...');
const DISCORD_BOT_TOKEN = ''; // Bot token
const { Client, GatewayIntentBits } = require('discord.js');
const { fetchRandomCarDetails } = require('./fetchData');
const fs = require('fs'); // File system module

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const games = {}; // Track games by channel ID
const guessTimeLimit = 15; // Guess time limit

// Function to save scores
function saveScores(scores) {
    fs.writeFileSync('scores.json', JSON.stringify(scores, null, 4));
}

// Function to load scores
function loadScores() {
    if (fs.existsSync('scores.json')) {
        return JSON.parse(fs.readFileSync('scores.json', 'utf-8'));
    }
    return {};
}

let scores = loadScores(); // Load scores at startup
console.log('Bot is now online.');

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const channelId = message.channel.id;
    const guildName = message.guild ? message.guild.name : 'Unknown Server';
    const channelName = message.channel.name;

    // Start a new game
    if (message.content.toLowerCase() === '!play') {
        if (games[channelId]) {
            console.log(`Game already running in ${guildName} -> #${channelName}`);
            await message.channel.send('A game is already running in this channel!');
            return;
        }

        console.log(`Game started in ${guildName} -> #${channelName}`);
        games[channelId] = { playersGuesses: {}, currentCarDetails: null };

        let countdown = 5;
        const countdownMessage = await message.channel.send(`**Game starting in ${countdown} seconds**...`);
        const interval = setInterval(() => {
            countdown--;
            countdownMessage.edit(`**Game starting in ${countdown} seconds**...`);
            if (countdown <= 0) {
                clearInterval(interval);
            }
        }, 1000);

        setTimeout(async () => {
            const carDetails = await fetchRandomCarDetails();
            if (carDetails) {
                games[channelId].currentCarDetails = carDetails;

                const embed = {
                    color: 0x0099ff,
                    title: carDetails.title,
                    url: carDetails.link,
                    description: `Price: **???**\nKM: **${carDetails.km}**\nYear: **${carDetails.year}**\nFuel Type: **${carDetails.fuel}**\nTransmission: **${carDetails.transmission}**`,
                    image: { url: carDetails.photo },
                    footer: { text: `Guess time: ${guessTimeLimit} seconds` },
                };
                await message.channel.send({ embeds: [embed] });

                let guessCountdown = guessTimeLimit;
                const guessCountdownMessage = await message.channel.send(`You have **${guessCountdown} seconds** to make your guess!`);
                const guessInterval = setInterval(() => {
                    guessCountdown--;
                    guessCountdownMessage.edit(`You have **${guessCountdown} seconds** to make your guess!`);
                    if (guessCountdown <= 0) {
                        clearInterval(guessInterval);
                        announceResult(message.channel);
                    }
                }, 1000);
            } else {
                console.log(`Failed to fetch car details for ${guildName} -> #${channelName}`);
                await message.channel.send('Failed to fetch car details.');
                delete games[channelId];
            }
        }, 5000);
    }

    // Handle price guesses
    if (message.content.toLowerCase().startsWith('!price')) {
        if (!games[channelId] || !games[channelId].currentCarDetails) {
            await message.channel.send('You need to start a game with !play first.');
            return;
        }

        const priceGuess = parseFloat(message.content.split(' ')[1]);
        if (isNaN(priceGuess)) {
            await message.channel.send('Please provide a valid price guess. Example: !price 50000');
            return;
        }

        games[channelId].playersGuesses[message.author.id] = priceGuess;
        console.log(`${message.author.username} guessed ${priceGuess} € in ${guildName} -> #${channelName}`);
        await message.channel.send(`${message.author.username} guessed: ${priceGuess} €`);
    }

    // Show leaderboard
    if (message.content.toLowerCase() === '!leaderboard') {
        const sortedScores = Object.entries(scores)
            .sort(([, a], [, b]) => b.totalScore - a.totalScore)
            .slice(0, 10);

        if (sortedScores.length === 0) {
            await message.channel.send('No scores recorded yet.');
            return;
        }

        const leaderboard = sortedScores.map(([userId, data], index) => {
            return `**${index + 1}.** <@${userId}> - Score: **${data.totalScore}**, Games: **${data.gamesPlayed}**`;
        }).join('\n');

        const embed = {
            color: 0x0099ff,
            title: '🏆 Top 10 Players 🏆',
            description: leaderboard,
            footer: { text: 'Guessing game leaderboard' },
        };
        await message.channel.send({ embeds: [embed] });
    }
});

// Announce results and reset game
async function announceResult(channel) {
    const game = games[channel.id];
    if (!game) return;

    const actualPrice = parseFloat(game.currentCarDetails.price.replace(/[^\d,]+/g, '').replace(',', '.'));
    let resultMessage = `The actual price of the car is: **${actualPrice} €**\n\nGuesses:\n`;

    for (const playerId in game.playersGuesses) {
        const guess = game.playersGuesses[playerId];
        const diff = Math.abs(actualPrice - guess);
        const player = await channel.guild.members.fetch(playerId);
        const score = Math.max(0, 100 - (diff / actualPrice) * 100);

        resultMessage += `${player.user.username}: ${guess} € (Score: ${Math.round(score)})\n`;

        if (!scores[playerId]) {
            scores[playerId] = { username: player.user.username, totalScore: 0, gamesPlayed: 0 };
        }
        scores[playerId].totalScore += Math.round(score);
        scores[playerId].gamesPlayed += 1;
    }

    saveScores(scores);
    console.log(`Game ended in ${channel.guild.name} -> #${channel.name}`);
    await channel.send(resultMessage);

    delete games[channel.id]; // Clear game for this channel
}

client.login(DISCORD_BOT_TOKEN);
