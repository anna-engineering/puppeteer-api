/*  Express + Puppeteer prerender service
 *  GET /render?url=https://example.com
 *  Returns fully rendered HTML (images, CSS, fonts skipped for speed).
 */

import express          from "express";
import { launch }       from "puppeteer";

const PORT      = process.env.PORT ?? 3000;
let   browser   = null;

// ---------- Browser initialisation ----------
async function initBrowser()
{
    if (browser)
    {
        return;
    }

    browser = await launch(
        {
            headless: true,
            args:
                [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--disable-features=IsolateOrigins,site-per-process"
                ]
        });
}

// ---------- Render helper ----------
async function renderHtml(targetUrl)
{
    const page = await browser.newPage();

    // Block resources that are useless for pure DOM extraction
    await page.setRequestInterception(true);
    page.on("request",
        (req) =>
        {
            const type = req.resourceType();
            if (["image", "stylesheet", "font", "media"].includes(type))
            {
                req.abort();
            }
            else
            {
                req.continue();
            }
        });

    await page.goto(targetUrl,
        {
            waitUntil: "networkidle2",
            timeout:   20000        // 20 s max pour les pages très lourdes
        });

    const html = await page.content();
    await page.close();
    return html;
}

// ---------- Express server ----------
const app = express();

app.get("/render", async (req, res) =>
{
    const urlParam = req.query.url;

    if (!urlParam)
    {
        return res.status(400).json({ error: "url parameter missing" });
    }

    let target;
    try
    {
        target = new URL(urlParam);
        if (!["http:", "https:"].includes(target.protocol))
        {
            throw new Error("invalid scheme");
        }
    }
    catch (e)
    {
        return res.status(400).json({ error: "invalid url" });
    }

    try
    {
        await initBrowser();
        const html = await renderHtml(target.href);
        res.type("html").send(html);
    }
    catch (err)
    {
        console.error(err);
        res.status(500).json({ error: "rendering failed" });
    }
});

// Simple health-check
app.get("/health", (_, res) => res.json({ status: "ok" }));

// Graceful shutdown
process.on("SIGINT", async () =>
{
    if (browser)
    {
        await browser.close();
    }
    process.exit(0);
});

app.listen(PORT, () => console.log(`Prerender API listening on :${PORT}`));
