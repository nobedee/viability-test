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
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { marked } from 'marked';
import https from 'https';
import http from 'http';

// Resolve __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get command-line arguments
const args = process.argv.slice(2);
if (args.length !== 2) {
    console.error('Usage: node render-md.js <source-md-path-or-URL> <output-pdf-path>');
    process.exit(1);
}

const [source, outputPDF] = args;

// Function to fetch remote Markdown if URL is provided
async function fetchMarkdown(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, res => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to fetch ${url}, status code: ${res.statusCode}`));
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

// Main rendering function
async function main() {
    let markdownContent;

    // Determine if source is a URL
    if (source.startsWith('http://') || source.startsWith('https://')) {
        console.log(`Fetching Markdown from URL: ${source}`);
        markdownContent = await fetchMarkdown(source);
    } else {
        const mdPath = path.resolve(source);
        if (!fs.existsSync(mdPath)) {
            console.error(`Markdown file does not exist: ${mdPath}`);
            process.exit(1);
        }
        markdownContent = fs.readFileSync(mdPath, 'utf-8');
    }

    // Convert Markdown to HTML
    const htmlContent = `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          pre { background: #f6f8fa; padding: 10px; overflow-x: auto; }
          code { font-family: monospace; }
          h1,h2,h3,h4,h5,h6 { color: #333; }
          img { max-width: 100%; }
        </style>
      </head>
      <body>
        ${marked(markdownContent)}
      </body>
    </html>
    `;

    // Launch Puppeteer and generate PDF
    console.log(`Rendering PDF to: ${outputPDF}`);
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    await page.pdf({ path: outputPDF, format: 'A4', printBackground: true });
    await browser.close();

    console.log('PDF generation complete!');
}

// Run
main().catch(err => {
    console.error(err);
    process.exit(1);
});
