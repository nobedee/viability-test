#!/usr/bin/env node

/**
 * render-md.js
 * 
 * Usage:
 *   node render-md.js <source-md-path-or-URL> <output-pdf-path>
 *
 * Example:
 *   node render-md.js https://raw.githubusercontent.com/user/repo/main/README.md .tmp/out/rendered.pdf
 */

import fs from 'fs';
import fetch from 'node-fetch';
import puppeteer from 'puppeteer';
import marked from 'marked';

const mdUrl = process.env.MD_URL;

async function main() {
  let markdown;

  if (mdUrl.startsWith('http')) {
    // Fetch markdown from URL
    const res = await fetch(mdUrl);
    if (!res.ok) throw new Error(`Failed to fetch Markdown: ${res.statusText}`);
    markdown = await res.text();
  } else {
    // Fallback: local file
    markdown = fs.readFileSync(mdUrl, 'utf8');
  }

  // Convert Markdown to HTML
  const html = marked(markdown);

  // Render HTML to PDF using Puppeteer
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({ path: '.tmp/out/rendered.pdf', format: 'A4' });
  await browser.close();

  console.log('PDF generated at .tmp/out/rendered.pdf');
}

main();
