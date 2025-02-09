"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface VideoData {
  title: string;
  views: number;
  thumbnail: string;
}

interface GraphData {
  name: string;
  views: number;
}

export default function Home() {
  const [playlistUrl, setPlaylistUrl] = useState("https://youtube.com/playlist?list=PLhQjrBD2T381WAHyx1pq-sBfykqMBI7V4&si=TBcXJlHl6j42j8zs");
  const [videoData, setVideoData] = useState<VideoData[]>([]);
  const [graphData, setGraphData] = useState<GraphData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:5000/scrape-playlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playlistUrl }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch playlist data");
      }

      const data = await response.json();
      setVideoData(data.videoList);
      setGraphData(data.graphData);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatViews = (views: number) => {
    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M`;
    } else if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`;
    } else {
      return views.toString();
    }
  };

  return (
    <div className="container mx-auto p-4 px-10 flex flex-col items-center">
      <Card
        style={{
          width: "85%",
          backgroundColor: "#fff6df",
        }}
      >
        <CardHeader>
          <CardTitle>YouTube Playlist Analyzer</CardTitle>
          <CardDescription>
            Enter a YouTube playlist URL to analyze its videos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="url"
              placeholder="Enter YouTube playlist URL"
              value={playlistUrl}
              onChange={(e) => setPlaylistUrl(e.target.value)}
              required
            />

            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Analyzing..." : "Analyze Playlist"}
            </Button>
          </form>
          {isLoading && <p>This can take upto 20 seconds</p>}
        </CardContent>
      </Card>

      {videoData.length > 0 && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-2">
          <Card
            style={{
              width: "85%",
              backgroundColor: "#fff6df",
            }}
          >
            <CardHeader>
              <CardTitle>Video List</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {videoData.map((video, index) => {
                  return (
                    <li key={index} className="flex items-start space-x-4">
                      <span className="font-bold text-lg min-w-[24px]">
                        {index + 1}.
                      </span>
                      <img
                        src={`${video.thumbnail}?t=${Date.now()}`}
                        alt={video.title}
                        className="w-24 h-auto"
                      />
                      <div>
                        <h3 className="font-semibold">{video.title}</h3>
                        <p className="text-sm text-gray-600">
                          {formatViews(video.views)} views
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <Card
            style={{
              borderWidth:0,
              backgroundColor: "#fff6df00",
              

            }}
            
          >
            <CardHeader>
              <CardTitle>View Count Graph</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={graphData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="white" />
                  <XAxis dataKey="name" stroke="white"strokeWidth={2}  />
                  <YAxis fontWeight={"bold"} stroke="white" strokeWidth={2} 
                  tickFormatter={(value) => 
                    value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : 
                    value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value
                  } 
                  />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="views"
                    stroke="#fa1d00"
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
