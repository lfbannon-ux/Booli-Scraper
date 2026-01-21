import { chromium } from 'playwright';
import type { BooliSnapshot } from './database';

export interface ScrapedData {
  forSale: number;
  soonToBeSold: number;
}

export async function scrapeBooli(): Promise<ScrapedData> {
  console.log('Starting Booli scrape...');

  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    console.log('Navigating to Booli.se...');
    await page.goto('https://www.booli.se/sok/till-salu', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    console.log('Waiting for page to load...');
    await page.waitForTimeout(5000);

    console.log('Looking for housing data...');
    
    // Look for the text that contains both numbers
    // Format: "50 803 till salu och 35 547 snart till salu"
    const fullText = await page.locator('text=/till salu och.*snart till salu/i').first().textContent({ timeout: 10000 });
    
    console.log(`Found text: ${fullText}`);
    
    if (!fullText) {
      throw new Error('Could not find housing statistics on page');
    }

    // Extract both numbers from the text
    // Format: "50 803 till salu och 35 547 snart till salu"
    // Match: number before "till salu" and number before "snart till salu"
    const forSaleMatch = fullText.match(/([\d\s]+)\s+till salu/i);
    const soonMatch = fullText.match(/([\d\s]+)\s+snart till salu/i);
    
    if (!forSaleMatch || !soonMatch) {
      throw new Error(`Could not extract numbers from text: "${fullText}"`);
    }

    // Clean and parse numbers (remove all spaces)
    const forSale = parseInt(forSaleMatch[1].replace(/\s/g, ''), 10);
    const soonToBeSold = parseInt(soonMatch[1].replace(/\s/g, ''), 10);

    console.log(`Scraped data: For sale=${forSale}, Soon to be sold=${soonToBeSold}`);

    return { forSale, soonToBeSold };
  } finally {
    await browser.close();
  }
}

function extractNumber(text: string): number {
  const match = text.match(/[\d,]+/);
  if (!match) {
    throw new Error(`Could not extract number from text: "${text}"`);
  }
  return parseInt(match[0].replace(/,/g, ''), 10);
}

export function createSnapshot(data: ScrapedData): BooliSnapshot {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  return {
    date: dateStr,
    forSale: data.forSale,
    soonToBeSold: data.soonToBeSold,
  };
}
