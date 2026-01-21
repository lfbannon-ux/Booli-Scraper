import 'dotenv/config';
import cron from 'node-cron';
import BooliDatabase from './database';
import { scrapeBooli, createSnapshot } from './scraper';
import { sendWeeklyReport } from './email';

const db = new BooliDatabase();

async function runDailyScrape(): Promise<void> {
  try {
    console.log(`[${new Date().toISOString()}] Starting daily scrape...`);

    const data = await scrapeBooli();
    const snapshot = createSnapshot(data);

    db.insertSnapshot(snapshot);

    console.log(`[${new Date().toISOString()}] Scrape completed successfully!`);
    console.log(`Saved: Date=${snapshot.date}, For Sale=${snapshot.forSale}, Soon to be Sold=${snapshot.soonToBeSold}`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error during daily scrape:`, error);
  }
}

async function runWeeklyReport(): Promise<void> {
  try {
    console.log(`[${new Date().toISOString()}] Starting weekly report...`);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDate = sevenDaysAgo.toISOString().split('T')[0];

    const snapshots = db.getSnapshotsSince(startDate);

    console.log(`Found ${snapshots.length} snapshots since ${startDate}`);

    await sendWeeklyReport(snapshots);

    console.log(`[${new Date().toISOString()}] Weekly report sent successfully!`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error during weekly report:`, error);
  }
}

async function runOnStartup(): Promise<void> {
  const runOnStartupEnabled = process.env.RUN_ON_STARTUP === 'true';
  const sendTestEmail = process.env.SEND_TEST_EMAIL === 'true';

  if (runOnStartupEnabled) {
    console.log('Running initial scrape on startup...');
    await runDailyScrape();
  }

  if (sendTestEmail) {
    console.log('Sending test email on startup...');
    await runWeeklyReport();
  }
}

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Booli Scraper Service Started');
  console.log('='.repeat(60));
  console.log('Daily scrape: Every day at 10:00 AM');
  console.log('Weekly report: Every Monday at 9:00 AM');
  console.log('='.repeat(60));

  await runOnStartup();

  cron.schedule('0 10 * * *', async () => {
    await runDailyScrape();
  }, {
    timezone: 'Europe/Stockholm',
  });

  cron.schedule('0 9 * * 1', async () => {
    await runWeeklyReport();
  }, {
    timezone: 'Europe/Stockholm',
  });

  console.log('Cron jobs scheduled. Service is now running...');
}

process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  db.close();
  process.exit(0);
});

main().catch((error) => {
  console.error('Fatal error:', error);
  db.close();
  process.exit(1);
});
