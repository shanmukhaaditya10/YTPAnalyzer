import { NextRequest, NextResponse } from "next/server";
import { PlaywrightCrawler, Dataset } from "crawlee";
import { v4 as uuidv4 } from "uuid";

interface VideoData {
  title: string;
  views: number;
  thumbnail: string;
}

interface PlaylistData {
  videoList: VideoData[];
  graphData: { name: string; views: number }[];
}

export async function POST(request: NextRequest) {
  const { playlistUrl } = await request.json();

  if (!playlistUrl) {
    return NextResponse.json(
      { error: "Playlist URL is required" },
      { status: 400 }
    );
  }

  const playlistId = new URL(playlistUrl).searchParams.get("list");
  if (!playlistId) {
    return NextResponse.json(
      { error: "Invalid playlist URL" },
      { status: 400 }
    );
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

      const videos: VideoData[] = await page.$$eval(
        "#contents ytd-playlist-video-renderer",
        async (elements) => {
          const loadImages = async () => {
            const imgElements = document.querySelectorAll("img");
            const imgPromises = Array.from(imgElements).map(
              (img) =>
                new Promise((resolve) => {
                  if (img.complete) resolve(true);
                  else img.onload = img.onerror = () => resolve(true);
                })
            );
            await Promise.all(imgPromises);
          };
      
          await loadImages(); 
      
          return elements.map((el) => {
            const title =
              el.querySelector("#video-title")?.textContent?.trim() || "";
            const viewsText =
              el.querySelector("#video-info span")?.textContent?.trim() || "";
           
            const viewsMatch = viewsText.match(/^([\d,.]+[KMB]?)\s*views?$/i);
            let views = 0;
            if (viewsMatch) {
              const viewString = viewsMatch[1].toUpperCase().replace(/,/g, "");
              if (viewString.endsWith("K"))
                views = parseFloat(viewString) * 1000;
              else if (viewString.endsWith("M"))
                views = parseFloat(viewString) * 1000000;
              else if (viewString.endsWith("B"))
                views = parseFloat(viewString) * 1000000000;
              else views = parseInt(viewString);
            }
            
            const imgElement = el.querySelector("img");
            const thumbnail = imgElement?.src || "https://imgs.search.brave.com/4g4GFqi0GfyV1NY16cG5XsEvUnzhjUv2Qd7w0OPOlwU/rs:fit:500:0:0:0/g:ce/aHR0cHM6Ly9jZG40/Lmljb25maW5kZXIu/Y29tL2RhdGEvaWNv/bnMvdWktYmVhc3Qt/NC8zMi9VaS0xMi01/MTIucG5n";

            

            return { title, views, thumbnail };
          });
        }
      );

      log.info(`Found ${videos.length} videos in the playlist`);

      await dataset.pushData({ videos });
    },

    failedRequestHandler({ request, log }) {
      log.error(`Request ${request.url} failed too many times.`);
    },
  });

  try {
    // Use a unique key for the request to bypass caching
    await crawler.run([
      { url: playlistUrl, uniqueKey: `${playlistUrl}:${uuid}` },
    ]);

    const results = await dataset.getData();
    const videos = (results.items[0]?.videos as VideoData[]) || [];

    const graphData = videos.map((video, index) => ({
      name: `Video ${index + 1}`,
      views: video.views,
    }));

    const playlistData: PlaylistData = {
      videoList: videos,
      graphData: graphData,
    };

    await dataset.drop();

    return NextResponse.json(playlistData);
  } catch (error) {
    console.error("Crawling failed:", error);
    await dataset.drop();
    return NextResponse.json(
      { error: "An error occurred while scraping the playlist" },
      { status: 500 }
    );
  }
}
