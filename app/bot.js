const DISCORD_BOT_TOKEN = ''; // Bot token
const { Client, GatewayIntentBits } = require('discord.js');
const { fetchRandomCarDetails } = require('./fetchData');
const fs = require('fs');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

let currentCarDetails = null;
let playersGuesses = {};
const guessTimeLimit = 15;

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

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.toLowerCase() === '!play') {        
        // 5-second countdown
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
                currentCarDetails = carDetails;
                playersGuesses = {};

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
                        announceResult(message);
                    }
                }, 1000);
            } else {
                await message.channel.send('Failed to fetch car details.');
            }
        }, 5000);
    }

    if (message.content.toLowerCase().startsWith('!price')) {
        if (!currentCarDetails) {
            await message.channel.send('You need to start a game with !play first.');
            return;
        }

        const priceGuess = parseFloat(message.content.split(' ')[1]);
        if (isNaN(priceGuess)) {
            await message.channel.send('Please provide a valid price guess. Example: !price 50000');
            return;
        }

        playersGuesses[message.author.id] = priceGuess;
        await message.channel.send(`${message.author.username} guessed: ${priceGuess} €`);
    }

    // !score command
    if (message.content.toLowerCase().startsWith('!score')) {
        const mentionedUser = message.mentions.users.first();
        if (!mentionedUser) {
            await message.channel.send('Please mention a user. Example: `!score @user`');
            return;
        }

        const userId = mentionedUser.id;
        if (!scores[userId]) {
            await message.channel.send(`${mentionedUser.username} has not played any games yet.`);
            return;
        }

        const userScore = scores[userId];
        const embed = {
            color: 0x00ff00,
            title: `${mentionedUser.username}'s Score`,
            description: `**Total Score:** ${userScore.totalScore}\n**Games Played:** ${userScore.gamesPlayed}`,
            footer: { text: 'Guessing game score' },
        };
        await message.channel.send({ embeds: [embed] });
    }

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

// Function to announce results and save scores
async function announceResult(message) {
    if (!currentCarDetails) return;

    const actualPrice = parseFloat(currentCarDetails.price.replace(/[^\d,]+/g, '').replace(',', '.'));
    let resultMessage = `The actual price of the car is: **${actualPrice} €**\n\nGuesses:\n`;

    for (const playerId in playersGuesses) {
        const guess = playersGuesses[playerId];
        const diff = Math.abs(actualPrice - guess);
        const player = await message.guild.members.fetch(playerId);
        const score = Math.max(0, 100 - (diff / actualPrice) * 100);

        resultMessage += `${player.user.username}: ${guess} € (Score: ${Math.round(score)})\n`;

        // Save scores
        if (!scores[playerId]) {
            scores[playerId] = { username: player.user.username, totalScore: 0, gamesPlayed: 0 };
        }
        scores[playerId].totalScore += Math.round(score);
        scores[playerId].gamesPlayed += 1;
    }

    saveScores(scores); // Save updated scores
    await message.channel.send(resultMessage);
    currentCarDetails = null;
}

client.login(DISCORD_BOT_TOKEN);
