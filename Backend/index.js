const express = require("express");
const cors = require("cors");
const { PlaywrightCrawler, Dataset } = require("crawlee");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(express.json());
app.use(cors()); // Allow requests from the frontend

// Playlist scraper API
app.post("/scrape-playlist", async (req, res) => {
  const { playlistUrl } = req.body;

  if (!playlistUrl) {
    return res.status(400).json({ error: "Playlist URL is required" });
  }

  const playlistId = new URL(playlistUrl).searchParams.get("list");
  if (!playlistId) {
    return res.status(400).json({ error: "Invalid playlist URL" });
  }

  const uuid = uuidv4();
  const dataset = await Dataset.open(`playlist-${uuid}`);

  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: 50,
    async requestHandler({ request, page, log }) {
      log.info(`Processing ${request.url}...`);

      await page.waitForSelector("#contents ytd-playlist-video-renderer", {
        timeout: 30000,
      });

      // Scroll to load all videos
      await page.evaluate(async () => {
        while (true) {
          const oldHeight = document.body.scrollHeight;
          window.scrollTo(0, document.body.scrollHeight);
          await new Promise((resolve) => setTimeout(resolve, 100));
          if (document.body.scrollHeight === oldHeight) break;
        }
      });

      const videos = await page.$$eval("#contents ytd-playlist-video-renderer", (elements) => {
        return elements.map((el) => {
          const title = el.querySelector("#video-title")?.textContent?.trim() || "";
          const viewsText = el.querySelector("#video-info span")?.textContent?.trim() || "";
          
          const viewsMatch = viewsText.match(/^([\d,.]+[KMB]?)\s*views?$/i);
          let views = 0;
          if (viewsMatch) {
            const viewString = viewsMatch[1].toUpperCase().replace(/,/g, "");
            if (viewString.endsWith("K")) views = parseFloat(viewString) * 1000;
            else if (viewString.endsWith("M")) views = parseFloat(viewString) * 1000000;
            else if (viewString.endsWith("B")) views = parseFloat(viewString) * 1000000000;
            else views = parseInt(viewString);
          }

          const imgElement = el.querySelector("img");
          const thumbnail = imgElement?.src || "https://imgs.search.brave.com/4g4GFqi0GfyV1NY16cG5XsEvUnzhjUv2Qd7w0OPOlwU/rs:fit:500:0:0/g:ce/aHR0cHM6Ly9jZG40/Lmljb25maW5kZXIu/Y29tL2RhdGEvaWNv/bnMvdWktYmVhc3Qt/NC8zMi9VaS0xMi01/MTIucG5n";

          return { title, views, thumbnail };
        });
      });

      log.info(`Found ${videos.length} videos in the playlist`);
      await dataset.pushData({ videos });
    },

    failedRequestHandler({ request, log }) {
      log.error(`Request ${request.url} failed too many times.`);
    },
  });

  try {
    await crawler.run([{ url: playlistUrl, uniqueKey: `${playlistUrl}:${uuid}` }]);

    const results = await dataset.getData();
    const videos = (results.items[0]?.videos) || [];

    const graphData = videos.map((video, index) => ({
      name: `Video ${index + 1}`,
      views: video.views,
    }));

    const playlistData = {
      videoList: videos,
      graphData,
    };

    await dataset.drop();
    res.json(playlistData);
  } catch (error) {
    console.error("Crawling failed:", error);
    await dataset.drop();
    res.status(500).json({ error: "An error occurred while scraping the playlist" });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
