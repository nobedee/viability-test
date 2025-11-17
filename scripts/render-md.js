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
import puppeteer from 'puppeteer';
import { marked } from 'marked';

const mdUrl = process.env.MD_URL;

if (!mdUrl) {
  throw new Error('MD_URL is not set. Pass Markdown file path or URL via workflow input.');
}

async function main() {
  let markdown;

  if (mdUrl.startsWith('http')) {
    // Fetch from URL
    const res = await fetch(mdUrl);
    if (!res.ok) throw new Error(`Failed to fetch Markdown: ${res.statusText}`);
    markdown = await res.text();
  } else {
    // Read local file
    if (!fs.existsSync(mdUrl)) {
      throw new Error(`Local Markdown file not found: ${mdUrl}`);
    }
    markdown = fs.readFileSync(mdUrl, 'utf8');
  }

  const html = marked(markdown);

  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  // Ensure output folder exists
  fs.mkdirSync('.tmp/out', { recursive: true });
  await page.pdf({ path: '.tmp/out/rendered.pdf', format: 'A4' });
  await browser.close();

  console.log('PDF generated at .tmp/out/rendered.pdf');
}

main();
