const cheerio = require("cheerio");
const axios = require("axios");
const mysql = require("mysql");

// (async () => {
//   const confLocal = mysql.createPool({
//     host:"localhost",
//     user: "root",
//     password: "",
//     database: "scraping",
//   });

//   const connectToDatabase = (pool) => (new Promise((resolve, reject) => {
//     pool.getConnection((error, conn) => {
//       if (error) reject(error);
//       resolve(conn);
//     });
//   }));
  
//   const queryDatabase = (connection, sqlString, escapeStrValue) => (new Promise((resolve, reject) => {
//     connection.query(sqlString, escapeStrValue, (error, result) => {
//       if (error) reject(error);
//       resolve(result);
//     });
//     connection.release();
//   }));

//   const { data } = await axios.get("https://otakudesu.asia/anime-list/");
//   const $ = cheerio.load(data);
//   const result = [];
//   $(".hodebgst > color").each((idx, element) => {
//     const title = $(element.parent).text();
//     const link = $(element.parent).attr("href");
//     const label = $(element).text();
//     let status, type;
//     if (label === "Movie") {
//       status = "0";
//       type = "0";
//     } else if (label === "On-Going") {
//       status = "1";
//       type = "1";
//     } else {
//       status = "0";
//       type = "1";
//     }
//     result.push([
//       title.trim(),
//       link.trim(),
//       type,
//       status,
//     ]);
//   });
//   const sqlString = "INSERT INTO otakudesu_lists (title, link, type, status) VALUES ?";
//   const conn = await connectToDatabase(confLocal);
//   // console.log(mysql.format(sqlString, [result]));
//   const insertedAnimes = await queryDatabase(conn, sqlString, [result]);
//   console.log(insertedAnimes);
//   // const 
// })();

(async () => {
  const confLocal = mysql.createPool({
    host:"localhost",
    user: "root",
    password: "",
    database: "scraping",
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
  const conTmp = await connectToDatabase(confLocal);
  const resultTemp = await queryDatabase(
    conTmp,
    "SELECT * FROM otakudesu_lists WHERE inserted IS NULL"
  );

  resultTemp.forEach(async (result, id) => {
    setTimeout(async () => {
      const { data } = await axios.get(result.link);
      const $ = cheerio.load(data);
      const episodes = [];
      $("#venkonten > div.venser > div:nth-child(8) li a").each((idx, element) => {
        const linkEpisode = $(element).attr("href");
        const label = $(element).text();
        const [, splitedEps] = label.split("Episode");
        let numEpisode;

        if (splitedEps === undefined) {
          numEpisode = "OVA";
        } else {
          if (splitedEps.includes("(End)")) {
            [numEpisode] = splitedEps.split("(End)")
          } else if (splitedEps.includes("Subtitle")) {
            [numEpisode] = splitedEps.split("Subtitle")
          }
        }

        if (numEpisode === undefined) {
          numEpisode = "OVA";
        }
        episodes.push([
          result.id,
          numEpisode.trim(),
          linkEpisode,
        ])
      });
    
      const sqlString = "INSERT INTO otakudesu_episodes (animeId, numEpisode, link) VALUES ?";
      const conn = await connectToDatabase(confLocal);
      const insertedEpisodes = await queryDatabase(conn, sqlString, [episodes]);

      const sqlStringUpdate = "UPDATE otakudesu_lists SET inserted=? WHERE id=?";
      const connUpdate = await connectToDatabase(confLocal);
      const updatedLists = await queryDatabase(connUpdate, sqlStringUpdate, [['1'],[result.id]]);
      console.log(insertedEpisodes);
      console.log(updatedLists);
    }, id * 2000);
  });


  // console.log(mysql.format(sqlString, [result]));
  // const insertedAnimes = await queryDatabase(conn, sqlString, [result]);
  // console.log(insertedAnimes);
  // const 
})();