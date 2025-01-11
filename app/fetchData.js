const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Puppeteer Stealth eklentisi
puppeteerExtra.use(StealthPlugin());

// Yakıt ve şanzıman çevirileri için fonksiyon
function translateData(key, value) {
    const translations = {
        fuel: {
            Dizel: 'Diesel',
            Benzin: 'Petrol',
            Elektrikli: 'Electric',
            Hibrit: 'Hybrid',
        },
        transmission: {
            'Vites kutusu': 'Manual',
            'Otomatik': 'Automatic',
            'Yarı Otomatik': 'Semi-Automatic',
        },
    };
    return translations[key]?.[value] || value;
}

// Araç bilgilerini çeken fonksiyon
async function fetchRandomCarDetails() {
    const browser = await puppeteerExtra.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    try {
        await page.goto('https://www.autoscout24.com.tr/lst?atype=C', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('article[data-testid="list-item"]', { timeout: 60000 });

        const carLinks = await page.evaluate(() => {
            const listings = Array.from(document.querySelectorAll('article[data-testid="list-item"]'));
            return listings.map(listing => {
                const linkElement = listing.querySelector('a.ListItem_title__ndA4s');
                return linkElement ? 'https://www.autoscout24.com.tr' + linkElement.getAttribute('href') : null;
            }).filter(link => link !== null);
        });

        if (carLinks.length === 0) throw new Error('Hiç ilan bulunamadı.');
        const randomLink = carLinks[Math.floor(Math.random() * carLinks.length)];
        await page.goto(randomLink, { waitUntil: 'domcontentloaded' });

        const carDetails = await page.evaluate(() => {
            const getTextBySelector = selector => document.querySelector(selector)?.innerText.trim() || 'Bilinmiyor';
            const title = getTextBySelector('.StageTitle_makeModelContainer__RyjBP');
            const packageAndPower = getTextBySelector('.StageTitle_modelVersion__Yof2Z');
            const price = getTextBySelector('.PriceInfo_price__XU0aF');
            const km = getTextBySelector('.Carpass_carpassLink__qhOc1');
            const year = document.querySelectorAll(
                '.DetailsSection_container__68Nlc.DetailsSection_breakElement__BD_zV'
            )[1]?.querySelectorAll('.DataGrid_defaultDdStyle__3IYpG.DataGrid_fontBold__RqU01')[1]?.innerText.trim() || 'Bilinmiyor';
            const transmission = document.querySelectorAll(
                '.StageArea_overviewContainer__UyZ9n .VehicleOverview_containerMoreThanFourItems__691k2 .VehicleOverview_itemContainer__XSLWi:nth-child(2) .VehicleOverview_itemText__AI4dA'
            )[0]?.innerText.trim() || 'Bilinmiyor';            
            const fuel = document.querySelectorAll(
                '.StageArea_overviewContainer__UyZ9n .VehicleOverview_containerMoreThanFourItems__691k2 .VehicleOverview_itemContainer__XSLWi:nth-child(4) .VehicleOverview_itemText__AI4dA'
            )[0]?.innerText.trim() || 'Bilinmiyor';
            const photo = document.querySelector('.image-gallery-slide img')?.src || 'https://via.placeholder.com/250x188?text=Resim+Yok';
            return { title: `${title} - ${packageAndPower}`, price, km, year,transmission, fuel, photo, link: window.location.href };
        });
        carDetails.fuel = translateData('fuel', carDetails.fuel);
        carDetails.transmission = translateData('transmission', carDetails.transmission);

        //console.log('Çekilen ilan detayları:', carDetails);
        
        return carDetails;
    } catch (error) {
        console.error('Bir hata oluştu:', error);
        return null;
    } finally {
        await browser.close();
    }
}

module.exports = { fetchRandomCarDetails };
