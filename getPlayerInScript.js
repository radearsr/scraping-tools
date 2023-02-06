const express = require("express");
const cheerio = require("cheerio");
const axios = require("axios");

const app = express();

const headers = {
  "cache-control": "max-age=0",
  "sec-ch-ua": '"Not_A Brand";v="99", "Google Chrome";v="109", "Chromium";v="109"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": "Windows",
  "upgrade-insecure-requests": 1,
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
  "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
  "sec-fetch-site": "none",
  "sec-fetch-mode": "navigate",
  "sec-fetch-user": "?1",
  "sec-fetch-dest": "document",
  "accept-encoding": "gzip, deflate, br",
  "accept-language": "en-US,en;q=0.9",
};


app.get("/", async (req, res) => {
  const { data } = await axios.get(req.query.src, { headers });
  const $ = cheerio.load(data);
  const scriptContent = $("script").text();
  const scriptIncludedFormat = scriptContent.split("sources")[1];
  const splitedbyFileKey = scriptIncludedFormat.split(": [{'file':'")[1];
  const videoPlayer = splitedbyFileKey.split("','type':'video/mp4'}],\n")[0];
  res.json({
    video: videoPlayer,
  });
})

app.listen(4001, () => {
  console.log("Server is running");
})