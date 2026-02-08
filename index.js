// ==============================
//  Top 10 Streaming FR Scraper
//  FlixPatrol → TMDB → RPDB
//  Génération JSON Stremio
// ==============================

const fs = require("fs");
const axios = require("axios");

// ---------- CONFIG ----------
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const RPDB_API_KEY = process.env.RPDB_API_KEY;

const PLATFORMS = [
    "netflix",
    "prime",
    "disney",
    "hbo",
    "paramount",
    "apple"
];

// FlixPatrol base URL
const FLIX_URL = "https://flixpatrol.com/top10/streaming/france/";

// Create directory if needed
if (!fs.existsSync("data")) {
    fs.mkdirSync("data");
}


// -----------------------------------------
// Fetch FlixPatrol Top 10 for each platform
// -----------------------------------------
async function fetchFlixTop(platform, category) {
    const url = `${FLIX_URL}?platform=${platform}&type=${category}`;

    try {
        const res = await axios.get(url);
        const html = res.data;

        // Extract titles using simple regex
        const matches = [...html.matchAll(/class="title">([^<]+)<\/a>/g)];

        return matches.slice(0, 10).map(m => m[1]);
    } catch (err) {
        console.error("Error scraping FlixPatrol:", platform, category, err);
        return [];
    }
}


// -----------------------------------------
// TMDB Search (Poster, Overview, IDs)
// -----------------------------------------
async function tmdbSearch(title, isMovie) {
    const type = isMovie ? "movie" : "tv";
    try {
        const url = `https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(title)}`;
        const res = await axios.get(url);

        if (!res.data.results.length) return null;

        const item = res.data.results[0];

        return {
            id: item.id,
            title: item.title || item.name,
            overview: item.overview,
            poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
            year: (item.release_date || item.first_air_date || "").split("-")[0],
            type
        };

    } catch (err) {
        console.error("TMDB search error:", title);
        return null;
    }
}


// -----------------------------------------
// RPDB Ratings
// -----------------------------------------
async function fetchRPDBRating(title) {
    try {
        const url = `https://api.ratingposterdb.com/${RPDB_API_KEY}/search?term=${encodeURIComponent(title)}`;
        const res = await axios.get(url);

        if (!res.data.length) return null;

        const item = res.data[0];

        return {
            imdb: item.imdb_rating || null,
            tomato: item.rt_rating || null,
            meta: item.meta_rating || null
        };

    } catch (err) {
        console.error("RPDB error:", title);
        return null;
    }
}


// -----------------------------------------
// Build full metadata for each title
// -----------------------------------------
async function buildItem(title, isMovie) {
    const tmdb = await tmdbSearch(title, isMovie);
    if (!tmdb) return null;

    const rating = await fetchRPDBRating(title);

    return {
        id: tmdb.id,
        name: tmdb.title,
        poster: tmdb.poster,
        overview: tmdb.overview,
        year: tmdb.year,
        type: tmdb.type,
        rating
    };
}


// -----------------------------------------
// Main scraping loop
// -----------------------------------------
async function run() {
    console.log("Scraping Top 10 FR...");

    for (const platform of PLATFORMS) {
        console.log(`→ PLATFORM: ${platform}`);

        // Movies
        const movieTitles = await fetchFlixTop(platform, "movies");
        const movieData = [];
        for (const t of movieTitles) {
            const item = await buildItem(t, true);
            if (item) movieData.push(item);
        }
        fs.writeFileSync(`data/${platform}-movies.json`, JSON.stringify(movieData, null, 2));

        // Series
        const seriesTitles = await fetchFlixTop(platform, "series");
        const seriesData = [];
        for (const t of seriesTitles) {
            const item = await buildItem(t, false);
            if (item) seriesData.push(item);
        }
        fs.writeFileSync(`data/${platform}-series.json`, JSON.stringify(seriesData, null, 2));
    }

    console.log("✔ DONE — JSON files updated.");
}

run();
