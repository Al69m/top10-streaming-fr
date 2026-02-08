import { addonBuilder, serveHTTP } from "stremio-addon-sdk";
import fetch from "node-fetch";

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const RPDB_API_KEY = process.env.RPDB_API_KEY;

const catalogs = [
    {
        id: "netflix_top10",
        name: "Netflix Top 10",
        type: "movie"
    },
    {
        id: "prime_top10",
        name: "Prime Video Top 10",
        type: "movie"
    },
    {
        id: "disney_top10",
        name: "Disney+ Top 10",
        type: "movie"
    },
    {
        id: "netflix_series_top10",
        name: "Netflix Top 10 Séries",
        type: "series"
    },
    {
        id: "prime_series_top10",
        name: "Prime Video Top 10 Séries",
        type: "series"
    },
    {
        id: "disney_series_top10",
        name: "Disney+ Top 10 Séries",
        type: "series"
    }
];

async function fetchTop10(source) {
    const urls = {
        netflix: "https://raw.githubusercontent.com/krish-diego/top10-streaming/main/netflix.json",
        prime: "https://raw.githubusercontent.com/krish-diego/top10-streaming/main/prime.json",
        disney: "https://raw.githubusercontent.com/krish-diego/top10-streaming/main/disney.json"
    };

    const res = await fetch(urls[source]);
    return res.json();
}

async function searchTMDB(title, type) {
    const url = `https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
        title
    )}&language=fr-FR`;

    const res = await fetch(url);
    const data = await res.json();
    return data.results?.[0];
}

async function fetchRPDB(imdbId) {
    const res = await fetch(
        `https://api.ratingposterdb.com/${RPDB_API_KEY}/imdb/${imdbId}`
    );
    return await res.json();
}

const builder = new addonBuilder({
    id: "top10-streaming-fr",
    version: "1.0.0",
    name: "Top 10 Streaming FR",
    catalogs: catalogs,
    resources: ["catalog"],
    types: ["movie", "series"]
});

builder.defineCatalogHandler(async ({ id, type }) => {
    let source = id.includes("netflix")
        ? "netflix"
        : id.includes("prime")
        ? "prime"
        : "disney";

    const top10 = await fetchTop10(source);

    const list = await Promise.all(
        top10.map(async (item) => {
            const tmdb = await searchTMDB(item.title, type === "movie" ? "movie" : "tv");

            if (!tmdb) return null;

            const imdbId = tmdb.imdb_id || null;
            let rpdb = null;

            if (imdbId) {
                rpdb = await fetchRPDB(imdbId);
            }

            return {
                id: `${type}:${tmdb.id}`,
                name: tmdb.title || tmdb.name,
                poster: `https://image.tmdb.org/t/p/w500${tmdb.poster_path}`,
                description: tmdb.overview,
                releaseInfo: tmdb.release_date || tmdb.first_air_date,
                rating: rpdb?.ratings?.imdb || null,
                imdb: rpdb?.ratings?.imdb || null,
                m_percent: rpdb?.ratings?.meta || null,
                t_percent: rpdb?.ratings?.tomato || null
            };
        })
    );

    return {
        metas: list.filter((x) => x !== null)
    };
});

serveHTTP(builder.getInterface(), { port: 7000 });
