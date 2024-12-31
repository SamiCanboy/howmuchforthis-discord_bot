const { Client, GatewayIntentBits } = require('discord.js');
const puppeteerExtra = require('puppeteer-extra');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');
const fs = require('fs');

const DISCORD_TOKEN = 'MTMyMzQ1NDA5ODE5NTg3NzkzOQ.GAHM3k.6KqZjxhTZKTXeDViIoxxyon3MSvphJcjh19dxc'; // Discord bot token'ınızı buraya ekleyin.
const RECAPTCHA_API_KEY = '79d4fec56a9fc7ae38c04516bd926be8'; // 2Captcha API anahtarınızı buraya ekleyin.

puppeteerExtra.use(
    RecaptchaPlugin({
        provider: { id: '2captcha', token: RECAPTCHA_API_KEY },
        visualFeedback: true,
    })
);

// Çerezleri kaydet ve yükle
async function saveCookies(page) {
    const cookies = await page.cookies();
    fs.writeFileSync('cookies.json', JSON.stringify(cookies, null, 2));
}

async function loadCookies(page) {
    if (fs.existsSync('cookies.json')) {
        const cookies = JSON.parse(fs.readFileSync('cookies.json', 'utf-8'));
        await page.setCookie(...cookies);
    }
}

async function fetchRandomCarDetails() {
    const browser = await puppeteerExtra.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await loadCookies(page);
        await page.goto('https://www.sahibinden.com/otomobil', { waitUntil: 'domcontentloaded' });

        const solved = await page.solveRecaptchas();
        if (solved) {
            console.log('ReCaptcha başarıyla çözüldü!');
            await saveCookies(page);
        }

        await page.waitForSelector('.searchResultsItem', { timeout: 60000 });
        const carLinks = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('.searchResultsItem'));
            return rows.map(row => {
                const titleLink = row.querySelector('a.classifiedTitle');
                return titleLink ? 'https://www.sahibinden.com' + titleLink.getAttribute('href') : null;
            }).filter(link => link !== null);
        });

        if (carLinks.length === 0) throw new Error('Hiç ilan bulunamadı.');
        const randomLink = carLinks[Math.floor(Math.random() * carLinks.length)];

        await page.goto(randomLink, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.classifiedDetailImage', { timeout: 30000 });

        const carDetails = await page.evaluate(() => {
            const infoItems = document.querySelectorAll('.classifiedInfoList li');
            const getInfo = (label) =>
                Array.from(infoItems)
                    .find((li) => li.innerText.includes(label))
                    ?.querySelector('span')
                    ?.innerText.trim() || 'Bilinmiyor';

            return {
                brand: getInfo('Marka'),
                series: getInfo('Seri'),
                model: getInfo('Model'),
                price: document.querySelector('#favoriteClassifiedPrice')?.value.trim() || 'Bilinmiyor',
                km: getInfo('KM'),
                year: getInfo('Yıl'),
                fuel: getInfo('Yakıt'),
                transmission: getInfo('Vites'),
                photo: document.querySelector('.classifiedDetailImage img')?.src || null,
                link: window.location.href,
            };
        });

        return carDetails;
    } catch (error) {
        console.error('Bir hata oluştu:', error);
        return null;
    } finally {
        await browser.close();
    }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once('ready', () => {
    console.log(`${client.user.tag} hazır!`);
});

client.on('messageCreate', async (message) => {
    if (message.content === '!howmuchforthis' || message.content === '!rastgeleilan') {
        await message.channel.send('İlan bilgileri çekiliyor, lütfen bekleyin...');

        const carDetails = await fetchRandomCarDetails();

        if (carDetails) {
            const { brand, series, model, price, km, year, fuel, transmission, photo, link } = carDetails;

            // Konsola araba bilgilerini yazdır
            console.log('Araba bilgileri:', carDetails);

            const embed = {
                title: `${brand} ${series} ${model}`,
                description: `Fiyat: ${price}\nKM: ${km}\nYıl: ${year}\nYakıt: ${fuel}\nVites: ${transmission}\n[İlanı görüntüle](${link})`,
                image: { url: photo },
                color: 0x00aaff,
            };
            await message.channel.send({ embeds: [embed] });
        } else {
            console.log('Bir hata oluştu, araba bilgileri alınamadı.');
            await message.channel.send('Bir hata oluştu, ilan bilgileri alınamadı.');
        }
    }
});

client.login(DISCORD_TOKEN);
