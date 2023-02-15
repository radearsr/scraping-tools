const { PrismaClient } = require("@prisma/client");
const mysql = require("mysql");
const { currentFormatDate } = require("./DateService");
const prisma = new PrismaClient();

const pool = mysql.createPool({
  host: "103.148.76.246",
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
    connection.release();
    resolve(result); 
  });
}));

(async () => {
  const conn = await connectToDatabase(pool);
  const episodesMysql = await queryDatabase(conn, "SELECT op.id, op.numEpisode, op.link, mongodb FROM otakudesu_player_episode_default AS op JOIN otakudesu_detail AS od ON op.animeId=od.listId where op.done='0' limit 2");
  episodesMysql.forEach((episode, idx) => {
    setTimeout(async () => {
      console.log(`[${currentFormatDate()}] Mulai Insert Mongo`);
      const insertEps = await prisma.episodes.create({
        data: {
          numEpisode: episode.numEpisode,
          source360p: episode.link,
          source480p: "-",
          source720p: "-",
          result360p: "-",
          result480p: "-",
          result720p: "-",
          published: true,
          animeId: episode.mongodb,
        }
      });
      if (insertEps.animeId !== null) {
        const conUpt = await connectToDatabase(pool);
        const updateSql = await queryDatabase(conUpt, "update otakudesu_player_episode_default set done=? where id=?", [["1"], [episode.id]]);
        console.log(updateSql);
        console.log(`[${currentFormatDate()}] Berhasil Update`);
      } else {
        console.log("Hasil Null");
        console.log(insertEps)
      }
    }, idx * 2000);
  });
})()