// Recon + download of KRS financial documents from rdf-przegladarka.ms.gov.pl
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const KRS = process.argv[2]; const OUT = path.join('rdf-out', KRS); fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => { const s = a.join(' '); console.log(s); fs.appendFileSync(path.join(OUT, 'log.txt'), s + '\n'); };
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  const ctx = await b.newContext({ locale: 'pl-PL', acceptDownloads: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' });
  const p = await ctx.newPage();
  let n = 0;
  p.on('request', r => { if (r.url().includes('/services/')) log('REQ', r.method(), r.url(), r.postData() || ''); });
  p.on('response', async r => {
    if (!r.url().includes('/services/')) return;
    let body = ''; try { body = await r.text(); } catch (e) {}
    log('RES', r.status(), r.url(), r.headers()['content-type'] || '', body.slice(0, 3000));
  });
  await p.goto('https://rdf-przegladarka.ms.gov.pl/', { waitUntil: 'networkidle', timeout: 90000 }).catch(e => log('goto', e.message));
  await p.waitForTimeout(8000);
  fs.writeFileSync(path.join(OUT, 'home.html'), await p.content());
  await p.screenshot({ path: path.join(OUT, 'home.png'), fullPage: true });
  log('TEXT', (await p.evaluate(() => document.body.innerText)).slice(0, 2000));
  const inputs = await p.$$eval('input', a => a.map(i => ({ id: i.id, name: i.name, ph: i.placeholder, type: i.type })));
  log('INPUTS', JSON.stringify(inputs));
  const inp = p.locator('input[type=text], input:not([type])').first();
  if (await inp.count()) {
    await inp.fill(KRS);
    const btn = p.getByRole('button', { name: /wyszukaj|szukaj/i }).first();
    if (await btn.count()) await btn.click(); else await inp.press('Enter');
    await p.waitForTimeout(10000);
    fs.writeFileSync(path.join(OUT, 'results.html'), await p.content());
    await p.screenshot({ path: path.join(OUT, 'results.png'), fullPage: true });
    log('RESULTS_TEXT', (await p.evaluate(() => document.body.innerText)).slice(0, 8000));
  }
  await b.close();
})();
