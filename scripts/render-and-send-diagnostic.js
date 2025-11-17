#!/usr/bin/env node
/**
 * scripts/render-and-send-diagnostic.js
 * - More defensive than original: writes debug artifacts (HTML, screenshot, error.txt)
 * - Useful for GitHub Actions debugging so out/ always contains something to upload
 */
import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import puppeteer from 'puppeteer';
import marked from 'marked';

const mdPath = process.env.MD_PATH || 'README.md';
const absMd = path.resolve(process.cwd(), mdPath);
const outDir = path.resolve(process.cwd(), 'out');
const outPdf = path.join(outDir, 'rendered.pdf');
const outHtml = path.join(outDir, 'rendered.html');
const outPng = path.join(outDir, 'rendered.png');
const outError = path.join(outDir, 'error.txt');

async function mdToHtml(md) {
  const css = `
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial; margin: 28px; color: #222; }
    pre, code { font-family: monospace; background: #f6f8fa; padding: 4px 6px; border-radius: 4px; }
    h1,h2,h3 { color: #0b3d91; }
    img { max-width: 100%; }
  `;
  const htmlBody = marked.parse(md);
  return `<!doctype html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>${css}</style></head><body>${htmlBody}</body></html>`;
}

async function writeError(err) {
  try {
    await mkdirp(outDir);
    const txt = [
      `TIME: ${new Date().toISOString()}`,
      `MD_PATH: ${mdPath}`,
      '',
      'ERROR STACK:',
      err && err.stack ? err.stack : String(err),
      '',
      'PROCESS.VERSIONS:',
      JSON.stringify(process.versions, null, 2),
      '',
    ].join('\n');
    fs.writeFileSync(outError, txt, 'utf8');
    console.error('Wrote error details to', outError);
  } catch (e) {
    console.error('Failed to write error file:', e);
  }
}

(async () => {
  try {
    await mkdirp(outDir);

    if (!fs.existsSync(absMd)) {
      throw new Error(`Markdown file not found: ${absMd} (cwd=${process.cwd()})`);
    }

    const md = fs.readFileSync(absMd, 'utf8');
    const html = await mdToHtml(md);

    // Save the HTML as artifact for debugging
    fs.writeFileSync(outHtml, html, 'utf8');
    console.log('Saved intermediate HTML to', outHtml);

    console.log('Launching puppeteer...');
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      // headless is default true
    });

    try {
      const page = await browser.newPage();
      // Set a reasonable timeout for navigation/wait ops
      page.setDefaultNavigationTimeout(60_000);
      await page.setContent(html, { waitUntil: 'networkidle2' }); // networkidle2 is less strict
      console.log('Page content set. Taking screenshot...');
      await page.screenshot({ path: outPng, fullPage: true });
      console.log('Saved screenshot to', outPng);

      console.log('Generating PDF...');
      await page.pdf({
        path: outPdf,
        format: 'A4',
        printBackground: true,
        margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' }
      });
      console.log('Saved PDF to', outPdf);
    } finally {
      await browser.close();
    }

    // Optionally POST to print server if configured
    if (process.env.PRINT_SERVER_URL) {
      try {
        // lazy import to reduce error surface when server is not configured
        const fetch = (await import('node-fetch')).default;
        const FormData = (await import('form-data')).default;
        const stream = fs.createReadStream(outPdf);
        const form = new FormData();
        form.append('file', stream, { filename: path.basename(outPdf) });
        if (process.env.PRINTER_NAME) form.append('printer', process.env.PRINTER_NAME);
        const headers = {};
        if (process.env.PRINT_SERVER_TOKEN) headers.Authorization = `Bearer ${process.env.PRINT_SERVER_TOKEN}`;
        const resp = await fetch(process.env.PRINT_SERVER_URL.replace(/\/$/, '') + '/print', { method: 'POST', body: form, headers });
        const body = await resp.text();
        if (!resp.ok) throw new Error(`Print server responded ${resp.status}: ${body}`);
        console.log('Print server response:', body);
      } catch (e) {
        console.error('Print submission failed:', e);
        // write error but don't kill; PDF at least exists
        await writeError(e);
      }
    }

    console.log('Done successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Fatal error during render:', err);
    await writeError(err);
    // produce a placeholder text file if PDF wasn't created
    try {
      if (!fs.existsSync(outPdf)) {
        fs.writeFileSync(path.join(outDir, 'README_render_failed.txt'),
          'Render failed. See error.txt for details.', 'utf8');
      }
    } catch (x) {
      console.error('Failed to write fallback artifact:', x);
    }
    process.exit(1);
  }
})();
