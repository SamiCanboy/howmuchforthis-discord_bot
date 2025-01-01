const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Puppeteer Extra'nın Stealth eklentisini ekle
puppeteerExtra.use(StealthPlugin());

// Yakıt türü ve şanzıman çevirileri için fonksiyon
function translateData(key, value) {
    const translations = {
        fuel: {
            Dizel: 'Diesel',
            Benzin: 'Petrol',
            Elektrikli: 'Electric',
            Hibrit: 'Hybrid',
        },
        transmission: {
            Manuel: 'Manual',
            Otomatik: 'Automatic',
            'Yarı Otomatik': 'Semi-Automatic',
        },
    };

    return translations[key]?.[value] || value;
}

// İlan bilgilerini çeken fonksiyon
async function fetchRandomCarDetails() {
    const browser = await puppeteerExtra.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();

    try {
        await page.goto(
            'https://www.autoscout24.com.tr/lst?atype=C&cy=D%2CA%2CB%2CE%2CF%2CI%2CL%2CNL&damaged_listing=exclude&desc=0&fregto=2023&offer=U&powertype=kw&search_id=1cieiy2gc7y&sort=standard&source=homepage_search-mask&ustate=N%2CU',
            { waitUntil: 'domcontentloaded' }
        );

        await page.waitForSelector('article[data-testid="list-item"]', { timeout: 60000 });

        const carLinks = await page.evaluate(() => {
            const listings = Array.from(document.querySelectorAll('article[data-testid="list-item"]'));
            return listings
                .map(listing => {
                    const linkElement = listing.querySelector('a.ListItem_title__ndA4s');
                    return linkElement ? 'https://www.autoscout24.com.tr' + linkElement.getAttribute('href') : null;
                })
                .filter(link => link !== null);
        });

        if (carLinks.length === 0) throw new Error('Hiç ilan bulunamadı.');

        const randomLink = carLinks[Math.floor(Math.random() * carLinks.length)];
        await page.goto(randomLink, { waitUntil: 'domcontentloaded' });

        const carDetails = await page.evaluate(() => {
            const getTextBySelector = (selector) => document.querySelector(selector)?.innerText.trim() || 'Bilinmiyor';

            const title = getTextBySelector('.StageTitle_makeModelContainer__RyjBP');
            const packageAndPower = getTextBySelector('.StageTitle_modelVersion__Yof2Z');
            const price = getTextBySelector('.PriceInfo_price__XU0aF');
            const km = getTextBySelector('.Carpass_carpassLink__qhOc1');
            const year = getTextBySelector('.VehicleOverview_containerMoreThanFourItems__691k2 div:nth-child(3) .VehicleOverview_itemText__AI4dA');
            const fuel = getTextBySelector('.VehicleOverview_containerMoreThanFourItems__691k2 div:nth-child(4) .VehicleOverview_itemText__AI4dA');
            const photo = document.querySelector('.image-gallery-slide .ImageWithBadge_picture__XJG24 img')?.src || 'https://via.placeholder.com/250x188?text=Resim+Yok';

            const power = document.querySelector('#technical-details-section .DetailsSection_childrenSection__aElbi .DataGrid_defaultDdStyle__3IYpG.DataGrid_fontBold__RqU01:nth-of-type(1)')?.innerText.trim() || 'Bilinmiyor';
            const transmission = document.querySelector('#technical-details-section .DetailsSection_childrenSection__aElbi .DataGrid_defaultDdStyle__3IYpG.DataGrid_fontBold__RqU01:nth-of-type(2)')?.innerText.trim() || 'Bilinmiyor';
            const engineVolume = document.querySelector('#technical-details-section .DetailsSection_childrenSection__aElbi .DataGrid_defaultDdStyle__3IYpG.DataGrid_fontBold__RqU01:nth-of-type(3)')?.innerText.trim() || 'Bilinmiyor';

            return {
                title: `${title} - ${packageAndPower}`,
                price,
                km,
                year,
                fuel,
                transmission,
                power,
                engineVolume,
                photo,
                link: window.location.href,
            };
        });

        carDetails.fuel = translateData('fuel', carDetails.fuel);
        carDetails.transmission = translateData('transmission', carDetails.transmission);

        return carDetails;
    } catch (error) {
        console.error('Bir hata oluştu:', error);
        return null;
    } finally {
        await browser.close();
    }
}

module.exports = fetchRandomCarDetails;
