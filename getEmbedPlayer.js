const puppeteer = require("puppeteer");
const mysql = require("mysql");
const { formatDate } = require("./DateService");
const cheerio = require("cheerio");
const axios = require("axios");

const confLocal = mysql.createPool({
  host:"103.148.76.246",
  user: "deyaproc_denonime",
  password: "d3n0n1m3Db",
  database: "deyaproc_scraping",
});

const connectToDatabase = (pool) => (new Promise((resolve, reject) => {
  pool.getConnection((error, conn) => {
    if (error) reject(error);
    resolve(conn);
  });
}));

const queryDatabase = (connection, sqlString, escapeStrValue) => (new Promise((resolve, reject) => {
  connection.query(sqlString, escapeStrValue, (error, result) => {
    if (error) reject(error);
    resolve(result);
  });
  connection.release();
}));


const getOptionalPlayer = async (linkPage, timeout) => {
  console.log(`[${formatDate(new Date().toISOString())}] Scraping Start`);
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto(linkPage, {
    waitUntil: "networkidle0",
    timeout,
  });

  const btnListsPlayer = "#embed_holder > div.mirrorstream > ul.m720p";
  await page.waitForSelector(btnListsPlayer, { timeout });
  await page.click(btnListsPlayer);
  await page.bringToFront(1);
  console.log(`[${formatDate(new Date().toISOString())}] Aksi Klik List Player Dan Sudah Kembali`);

  const btnPlayerTarget = "#embed_holder > div.mirrorstream > ul.m720p > li:nth-child(2) a";
  await page.click(btnPlayerTarget);
  console.log(`[${formatDate(new Date().toISOString())}] Aksi Klik Player`);

  setTimeout(async () => {
    const sourceIframe = "#pembed > div > iframe";
    await page.waitForSelector(sourceIframe, { timeout });
    const srcAttr480 = await page.$eval(sourceIframe, (el) => el.getAttribute("src"));
    console.log(`[${formatDate(new Date().toISOString())}] Aksi Selesai ${srcAttr480}`);
  }, 5000);
};

const getDefaultPlayer = async (idEpisode, linkPage, timeout) => {
  console.log(`[${formatDate(new Date().toISOString())}] Scraping Start ${idEpisode}`);
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto(linkPage, {
    waitUntil: "networkidle0",
    timeout,
  });

  const sourceIframe = "#pembed > div > iframe";
  await page.waitForSelector(sourceIframe, { timeout });
  const srcAttr = await page.$eval(sourceIframe, (el) => el.getAttribute("src"));
  console.log(`[${formatDate(new Date().toISOString())}] Aksi Selesai ${srcAttr}`);
  return srcAttr;
}

const programMain = async () => {
  const conn = await connectToDatabase(confLocal);
  const results = await queryDatabase(conn, "SELECT * FROM otakudesu_episodes WHERE done='0' LIMIT 10");
  console.log(`[${formatDate(new Date().toISOString())}] ${mysql.format("SELECT * FROM otakudesu_episodes WHERE done='0' LIMIT 10")}`);
  results.forEach((result, idx) => {
    setTimeout(async () => {
      const player = await getDefaultPlayer(result.id, result.link, 50000);
      
      // insert into player episode
      const connIns = await connectToDatabase(confLocal);
      console.log(`[${formatDate(new Date().toISOString())}] ${mysql.format("INSERT INTO otakudesu_player_episode_default (animeId, episodeId, numEpisode, link) VALUES ?", [[[result.animeId, result.id, result.numEpisode, player]]])}`);
      await queryDatabase(connIns, "INSERT INTO otakudesu_player_episode_default (animeId, episodeId, numEpisode, link) VALUES ?", [[[result.animeId, result.id, result.numEpisode, player]]]);

      // update status done
      const connUpd = await connectToDatabase(confLocal);
      console.log(`[${formatDate(new Date().toISOString())}] ${mysql.format("UPDATE otakudesu_episodes SET done=? WHERE id=?", [["1"], [result.id]])}`);
      await queryDatabase(connUpd, "UPDATE otakudesu_episodes SET done=? WHERE id=?", [["1"], [result.id]])
    }, idx * 30000);
  });
}

const getDefaultPlayerWithCurl = async (idEpisode, linkPage) => {
  console.log(`[${formatDate(new Date().toISOString())}] ${idEpisode}`);
  const { data } = await axios.get(linkPage);
  const $ = cheerio.load(data);
  const iframe = $("#pembed iframe").attr("src");
  return iframe;
};

const mainProgramCurl = async () => {
  const conn = await connectToDatabase(confLocal);
  const results = await queryDatabase(conn, "SELECT * FROM otakudesu_episodes WHERE done='0' LIMIT 100");
  console.log(`[${formatDate(new Date().toISOString())}] ${mysql.format("SELECT * FROM otakudesu_episodes WHERE done='0' LIMIT 10")}`);

  results.forEach((result, idx) => {
    setTimeout(async () => {
      const player = await getDefaultPlayerWithCurl(result.id, result.link);
      
      // insert into player episode
      const connIns = await connectToDatabase(confLocal);
      console.log(`[${formatDate(new Date().toISOString())}] ${mysql.format("INSERT INTO otakudesu_player_episode_default (animeId, episodeId, numEpisode, link) VALUES ?", [[[result.animeId, result.id, result.numEpisode, player]]])}`);
      await queryDatabase(connIns, "INSERT INTO otakudesu_player_episode_default (animeId, episodeId, numEpisode, link) VALUES ?", [[[result.animeId, result.id, result.numEpisode, player]]]);

      // update status done
      const connUpd = await connectToDatabase(confLocal);
      console.log(`[${formatDate(new Date().toISOString())}] ${mysql.format("UPDATE otakudesu_episodes SET done=? WHERE id=?", [["1"], [result.id]])}`);
      await queryDatabase(connUpd, "UPDATE otakudesu_episodes SET done=? WHERE id=?", [["1"], [result.id]])
    }, idx * 2000);
  });
}

(async () => {
  await mainProgramCurl();
  setInterval(async () => {
    await mainProgramCurl();
  }, 1000 * 60 * 5);
})();