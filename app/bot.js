const { Client, GatewayIntentBits } = require('discord.js');
const fetchRandomCarDetails = require('./fetchData'); // fetchData.js dosyasını içe aktarma

const DISCORD_BOT_TOKEN = 'MTMyMzQ1NDA5ODE5NTg3NzkzOQ.GAHM3k.6KqZjxhTZKTXeDViIoxxyon3MSvphJcjh19dxc';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.toLowerCase() === '!howmuchforthis') {
        await message.channel.send('Araç bilgileri alınıyor, lütfen bekleyin...');

        const carDetails = await fetchRandomCarDetails();
        if (carDetails) {
            const embed = {
                color: 0x0099ff,
                title: carDetails.title,
                url: carDetails.link,
                description: `Fiyat: **${carDetails.price}**\nKM: **${carDetails.km}**\nYıl: **${carDetails.year}**\nYakıt Türü: **${carDetails.fuel}**\nVites: **${carDetails.transmission}**\nGüç: **${carDetails.power}**\nSilindir Hacmi: **${carDetails.engineVolume}**`,
                image: {
                    url: carDetails.photo || 'https://via.placeholder.com/250x188?text=Resim+Yok',
                },
                footer: {
                    text: 'Autoscout24',
                },
            };

            await message.channel.send({ embeds: [embed] });
        } else {
            await message.channel.send('Bir hata oluştu veya ilan bilgisi alınamadı.');
        }
    }
});

client.once('ready', () => {
    console.log('Bot çalışıyor!');
    client.user.setActivity('Araç bilgisi için: !howmuchforthis', { type: 'LISTENING' });
});

client.login(DISCORD_BOT_TOKEN);
