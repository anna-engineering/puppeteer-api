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
import { JSDOM }          from "jsdom";
import { Readability }    from "@mozilla/readability";

const PORT            = process.env.PORT ?? 3000;
const turndown        = new TurndownService({ headingStyle: "atx" });
//Dirty and fast solution:
//turndown.remove(
//    [
//        "script",
//        "style",
//        "head",
//        "noscript",
//        "template",
//        "meta",
//        "link"
//    ]);
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

/* --- helper : return cleaned body innerHTML --- */
async function getCleanBodyHtml(page)
{
    return await page.evaluate(() =>
    {
        // Remove noise elements
        const selectors =
            [
                "script",
                "style",
                "noscript",
                "template",
                "link",
                "meta",
                "head"
            ];

        selectors.forEach(
            (sel) =>
            {
                document.querySelectorAll(sel).forEach((el) => el.remove());
            });

        return document.body.innerHTML;   // head is gone, only visible DOM
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

  //const html = await page.content();
    const html = await getCleanBodyHtml(page); // cleaned HTML (without <head>, <style>, <script>, ...)
    await page.close();
    return html;
}

/* ---------- Express app ---------- */
const app = express();

app.get("/render", async (req, res) =>
{
    const urlParam  = req.query.url;
    const format    = (req.query.format || "").toLowerCase();
    const readable  = (req.query.readable || "").toLowerCase();

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

        if (readable === "true" || readable === "1" || readable === "yes" || readable === "on")
        {
            const dom       = new JSDOM(html, { url: target.href });
            const reader    = new Readability(dom.window.document);
            const article   = reader.parse();          // { title, content, textContent, … }
            if (format === "md" || format === "markdown")
            {
                const md = turndown.turndown(article.content);
                return res.type("text/markdown").send(md);
            }
        }

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
