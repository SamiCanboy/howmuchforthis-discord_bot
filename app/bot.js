const { Client, GatewayIntentBits } = require('discord.js');
const { fetchRandomCarDetails } = require('./fetchData'); // fetchData.js dosyasından ilan çekme fonksiyonu
const DISCORD_BOT_TOKEN = 'MTMyMzQ1NDA5ODE5NTg3NzkzOQ.GAHM3k.6KqZjxhTZKTXeDViIoxxyon3MSvphJcjh19dxc'; // Bot tokeni

// Bot istemcisi
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

let currentCarDetails = null;
let playersGuesses = {};
const guessTimeLimit = 20; // Tahmin süresi

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // !howmuchforthis komutu ile araç bilgilerini çek ve göster
    if (message.content.toLowerCase() === '!howmuchforthis') {
        await message.channel.send('Araç bilgileri yükleniyor.');
        
        // 5 saniye countdown
        let countdown = 5;
        const countdownMessage = await message.channel.send(`**Oyun Başlıyor ${countdown} saniye** kaldı...`);
        const interval = setInterval(() => {
            countdown--;
            countdownMessage.edit(`**Oyun Başlıyor ${countdown} saniye** kaldı...`);
            if (countdown <= 0) {
                clearInterval(interval);
            }
        }, 1000);

        // Araç bilgilerini çek ve göster
        setTimeout(async () => {
            const carDetails = await fetchRandomCarDetails();
            if (carDetails) {
                currentCarDetails = carDetails;
                playersGuesses = {};

                const embed = {
                    color: 0x0099ff,
                    title: carDetails.title,
                    url: carDetails.link,
                    description: `Fiyat: **???**\nKM: **${carDetails.km}**\nYıl: **${carDetails.year}**\nYakıt Türü: **${carDetails.fuel}**\nŞanzıman: **${carDetails.transmission}**`,
                    image: { url: carDetails.photo },
                    footer: { text: 'Tahmin süresi: 20 saniye' },
                };
                await message.channel.send({ embeds: [embed] });

                // 20 saniye tahmin süresi
                let guessCountdown = guessTimeLimit;
                const guessCountdownMessage = await message.channel.send(`Tahmin yapmanız için **${guessCountdown} saniye** kaldı!`);
                const guessInterval = setInterval(() => {
                    guessCountdown--;
                    guessCountdownMessage.edit(`Tahmin yapmanız için **${guessCountdown} saniye** kaldı!`);
                    if (guessCountdown <= 0) {
                        clearInterval(guessInterval);
                        announceResult(message);
                    }
                }, 1000);
            } else {
                await message.channel.send('Araç bilgisi alınamadı.');
            }
        }, 5000);
    }

    // Fiyat tahmini komutu
    if (message.content.toLowerCase().startsWith('!price')) {
        if (!currentCarDetails) {
            await message.channel.send('Önce !howmuchforthis komutunu kullanmalısınız.');
            return;
        }

        const priceGuess = parseFloat(message.content.split(' ')[1]);
        if (isNaN(priceGuess)) {
            await message.channel.send('Lütfen geçerli bir fiyat tahmini yapın. Örnek: !price 50000');
            return;
        }

        playersGuesses[message.author.id] = priceGuess;
        await message.channel.send(`${message.author.username} tahmin yaptı: ${priceGuess} €`);
    }
});

// Sonuçları duyurmak için fonksiyon
async function announceResult(message) {
    if (!currentCarDetails) return;

    const actualPrice = parseFloat(currentCarDetails.price.replace(/[^\d,]+/g, '').replace(',', '.'));
    let resultMessage = `Aracın gerçek fiyatı: **${actualPrice} €**\n\nTahminler:\n`;

    for (const playerId in playersGuesses) {
        const guess = playersGuesses[playerId];
        const diff = Math.abs(actualPrice - guess);
        const player = await message.guild.members.fetch(playerId);
        const score = Math.max(0, 100 - (diff / actualPrice) * 100);

        resultMessage += `${player.user.username}: ${guess} € (Puan: ${Math.round(score)})\n`;
    }

    await message.channel.send(resultMessage);
    currentCarDetails = null; // Sıfırla
}

// Bot giriş yapma
client.login(DISCORD_BOT_TOKEN);
