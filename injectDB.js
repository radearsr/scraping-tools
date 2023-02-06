const mysql = require("mysql");
const cheerio = require("cheerio");
const axios = require("axios");
const fs = require("fs");

const object  = {};

const confLocal = mysql.createPool({
  host:"localhost",
  user: "root",
  password: "",
  database: "scraping",
});

const confRemote = mysql.createPool({
  host:"103.148.76.246",
  user: "deyaproc_denonime",
  password: "d3n0n1m3Db",
  database: "deyaproc_denonime_api_dev",
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

const getterPayloadToInsertAnime = async (link) => {
  try {
    console.log("Getter ON");
    const { data } = await axios.get(link);
    const $ = cheerio.load(data);
    let genre = [];
    let poster = $(".detail > img").attr("src");
    let title = $(".detail > h2").text();
    let description = $(".detail > p").text();
    $(".detail > li").each((id, element) => {
      const data = $(element.firstChild).text();
      genre.push(data);
    });
    genre = genre.length < 1 ? ["Action", "Romance"] : genre;
    title = title.length < 1 ? "lorem ipsum dolor" : title;
    description = description.length < 1 ? "lorem ipsum dolor" : description;
    return {
      title, poster: `https://185.224.82.193${poster}`, description, genre: genre.join(",")
    };
  } catch (error) {
    throw new Error("Gagal mendapatkan payload", error);
  }
}


const postAPI = async (link) => {
  const payload = await getterPayloadToInsertAnime(link);
  const fixPayload = {
    ...payload,
    status: "Completed",
    releaseDate: "12-04-2022",
    type: "Series",
  }
  const enpoint = "https://denonime-api.vercel.app/api/v1/animes";
  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsInJvbGVJZCI6MSwiaWF0IjoxNjc0OTE1NjY5LCJleHAiOjE2NzUwMDIwNjl9.IgAWPHZuTmQARHwBZNiPPbbRW14awz-bYjCDPK4a8_A";
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };
  const addedApi = await axios.post(enpoint, { ...fixPayload }, config);
  console.log(addedApi.data);
  return {
    idApi: addedApi.data.data.animeId,
  }
};

const episodeAnimes = async (idAnime) => {
  const conn = await connectToDatabase(confLocal);
  const results = await queryDatabase(
    conn,
    `SELECT al.id_api, ae.id_anime, ae.episodes, vrqs.link_video AS embed, vrqs.link_video_hd AS embed_hd, vrss.link_video AS player,
    vrss.link_video_hd AS player_hd
    FROM anime_eps AS ae JOIN video_req_sources AS vrqs ON ae.id=vrqs.id_episode
    JOIN video_res_sources AS vrss ON vrqs.id=vrss.id_video_source
    JOIN anime_lists AS al ON ae.id_anime=al.id 
    WHERE ae.id_anime=?`,
    [idAnime],
  );
  const mappedQuery = results.map((result) => ([
    result.episodes,
    result.player,
    "-",
    "-",
    result.id_api
  ]));
  console.log("MAPPED SUCCESS", idAnime);
  return mappedQuery;
}

const main = async () => {
  console.log("SYSTEM ON");
  const connLocal = await connectToDatabase(confLocal);
  const animeLists = await queryDatabase(
    connLocal,
    `SELECT al.id
    FROM anime_lists AS al
    JOIN (SELECT ae.id_anime, COUNT(DISTINCT(vrqs.id_episode)) AS total_req_sources, COUNT(DISTINCT(vrss.link_video)) AS total_res_sources
    FROM anime_eps AS ae
    LEFT JOIN video_req_sources AS vrqs ON ae.id=vrqs.id_episode
    JOIN video_res_sources AS vrss ON vrqs.id=vrss.id_video_source
    GROUP BY ae.id_anime) AS src ON al.id=src.id_anime
    WHERE src.total_req_sources >= al.total_eps AND al.inserted_eps='0'
    LIMIT 3000`
  );
  // console.log(animeLists);
  // console.log(mysql.format("INSERT INTO episodes (numEpisode, source360p, source480p, source720p, animeId) VALUES ?", [result]));
  animeLists.forEach(async (anime, idx) => {
    console.log("FOR EACH IDX", idx);
    setTimeout(async () => {
      console.log("TIMEOUT", idx);
      const result = await episodeAnimes(anime.id);      
      const animeId = anime.id;
      const sqlString = "INSERT INTO episodes (numEpisode, source360p, source480p, source720p, animeId) VALUES ?";
      console.log(mysql.format(sqlString, [result]));
      const connRemote = await connectToDatabase(confRemote);
      const addedEpisodes = await queryDatabase(
        connRemote,
        sqlString,
        [result],
      );
      if (addedEpisodes.affectedRows >= 1) {
        const connLocal = await connectToDatabase(confLocal);
        console.log(mysql.format(
          "UPDATE anime_lists SET inserted_eps=? WHERE id=?",
          [['1'],[animeId]],
        ));
        await queryDatabase(
          connLocal,
          "UPDATE anime_lists SET inserted_eps=? WHERE id=?",
          [['1'],[animeId]]
        );
      } else {
        console.log("GAGAL PROSES INSERT", anime.id);
      }
    }, (idx * 1000))
  });
    // animeLists.forEach(async (anime, idx) => {
    //   setTimeout(async () => {
    //     console.log(anime.id);
    //     const { idApi } = await postAPI(anime.link);
    //     const animeId = anime.id;
    //     const connInsert = await connectToDatabase();
    //     await queryDatabase(
    //       connInsert,
    //       "UPDATE anime_lists SET inserted_eps=? WHERE id=?",
    //       [[idApi],[animeId]]
    //     );
    //     console.log(mysql.format(
    //       "UPDATE anime_lists SET inserted_eps=? WHERE id=?",
    //       [[idApi],[animeId]],
    //     ));
    //   }, (idx * 20000))
    // });
}

main();