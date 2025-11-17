// render-md.js
//
// Usage in GitHub Actions:
//   MD_PATH=README.md node render-md.js
//
// Outputs: .tmp/out/rendered.pdf

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const marked = require('marked');

async function main() {
  const mdPath = process.env.MD_PATH || 'README.md';
  if (!fs.existsSync(mdPath)) {
    console.error(`Markdown file not found: ${mdPath}`);
    process.exit(1);
  }

  // Read Markdown content
  const markdown = fs.readFileSync(mdPath, 'utf-8');

  // Convert Markdown to HTML
  const html = `
  <html>
    <head>
      <meta charset="utf-8">
      <title>Markdown PDF</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1,h2,h3,h4,h5,h6 { color: #333; }
        pre { background-color: #f4f4f4; padding: 10px; overflow-x: auto; }
        code { background-color: #f4f4f4; padding: 2px 4px; }
        a { color: #0366d6; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      ${marked(markdown)}
    </body>
  </html>
  `;

  // Ensure output folder exists
  const outDir = path.join(process.cwd(), 'out');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // Launch Puppeteer
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  // Set HTML content
  await page.setContent(html, { waitUntil: 'networkidle0' });

  // Save PDF
  const pdfPath = path.join(outDir, 'rendered.pdf');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
  });

  await browser.close();

  console.log(`PDF created: ${pdfPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
