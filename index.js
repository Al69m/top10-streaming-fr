import fetch from "node-fetch";
import express from "express";
import cors from "cors";

const TMDB_KEY = process.env.TMDB_API_KEY;
const RPDB_KEY = process.env.RPDB_API_KEY;

const app = express();
app.use(cors());

const PLATFORMS = {
    "netflix": "netflix",
    "prime": "amazon-prime",
    "disney": "disney-plus",
    "max": "hbo-max",
    "paramount": "paramount-plus",
    "apple": "apple-tv"
};

async function scrapeFlixPatrol(platform) {
    const url = `https://flixpatrol.com/top10/${platform}/france/`;

    const html = await (await fetch(url)).text();

    const titles = [...html.matchAll(/chart-table.*?movie\/(.*?)\/".*?title="(.*?)"/gs)]
        .slice(0, 10)
        .map(m => ({
            slug: m[1],
            title: m[2]
        }));

    return titles;
}

async function getTMDBData(title, type = "movie") {
    const query = encodeURIComponent(title);
    const url = `https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_KEY}&language=fr-FR&query=${query}`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data.results || data.results.length === 0) return null;

    const item = data.results[0];

    return {
        id: `tt${item.id}`,
        name: item.title || item.name,
        poster: item.poster_path ? "https://image.tmdb.org/t/p/w500" + item.poster_path : null,
        description: item.overview || "",
        year: (item.release_date || item.first_air_date || "").slice(0, 4)
    };
}

async function getRPDBData(title) {
    const url = `https://api.ratingposterdb.com/${RPDB_KEY}/search/title/${encodeURIComponent(title)}?limit=1`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data || !data[0]) return null;

    return {
        imdb: data[0].imdb_rating || null,
        tomato: data[0].rotten_tomatoes_score || null,
        media: data[0].meta_score || null
    };
}

async function createCatalog(platform, type) {
    const flixList = await scrapeFlixPatrol(PLATFORMS[platform]);
    const metaList = [];

    for (let item of flixList) {
        const tmdb = await getTMDBData(item.title, type);
        if (!tmdb) continue;

        const rpdb = await getRPDBData(item.title);

        metaList.push({
            id: tmdb.id,
            type,
            name: tmdb.name,
            poster: tmdb.poster,
            description: tmdb.description,
            releaseInfo: tmdb.year,
            rating: rpdb ? `⭐ ${rpdb.imdb}/10 | 🍅 ${rpdb.tomato}% | m ${rpdb.media}%` : "",
        });
    }

    return metaList;
}

app.get("/catalog/:id", async (req, res) => {
    const id = req.params.id;

    const [platform, category] = id.split("-");
    const type = category === "movies" ? "movie" : "series";

    const metas = await createCatalog(platform, type);

    res.json({ metas });
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
    console.log("Addon Top 10 Streaming FR en ligne sur port " + PORT);
});
