/*  Express + Puppeteer prerender service
 *  GET /render?url=https://example.com[&format=md]
 *  ────────────────────────────────────────────────
 *  - Exécute le JavaScript de la page (Chromium headless)
 *  - Ignore images, CSS, fonts pour plus de vitesse
 *  - Retourne le HTML final (défaut) ou le Markdown si ?format=md
 */

import express           from "express";
import { launch }        from "puppeteer";
import TurndownService   from "turndown";

const PORT            = process.env.PORT ?? 3000;
const turndown        = new TurndownService({ headingStyle: "atx" });
let   browser         = null;

/* ---------- Browser pool ---------- */
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

/* ---------- HTML rendering ---------- */
async function renderHtml(targetUrl)
{
    const page = await browser.newPage();

    // Bloquer les ressources non nécessaires
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
            timeout:   20000
        });

    const html = await page.content();
    await page.close();
    return html;
}

/* ---------- Express app ---------- */
const app = express();

app.get("/render", async (req, res) =>
{
    const urlParam  = req.query.url;
    const format    = (req.query.format || "").toLowerCase();

    if (!urlParam)
    {
        return res.status(400).json({ error: "url parameter missing" });
    }

    // Validation URL
    let target;
    try
    {
        target = new URL(urlParam);
        if (!["http:", "https:"].includes(target.protocol))
        {
            throw new Error("invalid scheme");
        }
    }
    catch
    {
        return res.status(400).json({ error: "invalid url" });
    }

    try
    {
        await initBrowser();
        const html = await renderHtml(target.href);

        // Conversion éventuelle en Markdown
        if (format === "md" || format === "markdown")
        {
            const md = turndown.turndown(html);
            return res.type("text/markdown").send(md);
        }

        res.type("html").send(html);
    }
    catch (err)
    {
        console.error(err);
        res.status(500).json({ error: "rendering failed" });
    }
});

/* Health-check */
app.get("/health", (_, res) => res.json({ status: "ok" }));

/* Graceful shutdown */
process.on("SIGINT", async () =>
{
    if (browser)
    {
        await browser.close();
    }
    process.exit(0);
});

app.listen(PORT,
    () => console.log(`Prerender API listening on :${PORT}`));
