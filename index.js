import express from "express";
import fetch from "node-fetch";
import { addonBuilder } from "stremio-addon-sdk";
import path from "path";
import { fileURLToPath } from "url";

// === CONFIG ===
const TMDB_KEY = process.env.TMDB_KEY;
const RPDB_KEY = process.env.RPDB_KEY;
const REPO = "Al69m/top10-streaming-fr";  // <<< IMPORTANT

// === INIT ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const builder = new addonBuilder({
	id: "top10.streaming.fr",
	version: "1.0.0",
	name: "Top 10 Streaming FR",
	description: "Top 10 quotidien provenant de FlixPatrol — Netflix, Prime, Disney, HBO, Apple, Paramount.",
	catalogs: [
		{ type: "movie", id: "netflix-movies", name: "Netflix Top Films" },
		{ type: "series", id: "netflix-series", name: "Netflix Top Séries" },

		{ type: "movie", id: "prime-movies", name: "Prime Video Top Films" },
		{ type: "series", id: "prime-series", name: "Prime Video Top Séries" },

		{ type: "movie", id: "disney-movies", name: "Disney+ Top Films" },
		{ type: "series", id: "disney-series", name: "Disney+ Top Séries" },

		{ type: "movie", id: "hbo-movies", name: "HBO Max Top Films" },
		{ type: "series", id: "hbo-series", name: "HBO Max Top Séries" },

		{ type: "movie", id: "apple-movies", name: "Apple TV+ Top Films" },
		{ type: "series", id: "apple-series", name: "Apple TV+ Top Séries" },

		{ type: "movie", id: "paramount-movies", name: "Paramount+ Top Films" },
		{ type: "series", id: "paramount-series", name: "Paramount+ Top Séries" },
	]
});

// === FUNCTION → Load JSON raw from GitHub ===
async function loadJSON(file) {
	const url = `https://raw.githubusercontent.com/${REPO}/main/data/${file}.json`;
	const res = await fetch(url);

	if (!res.ok) {
		console.log("JSON introuvable :", url);
		return [];
	}

	return res.json();
}

// === FUNCTION → Convert JSON into Stremio meta item ===
async function convertItem(item) {
	const tmdbUrl = `https://api.themoviedb.org/3/${item.type}/${item.tmdb}?api_key=${TMDB_KEY}&language=fr-FR`;
	const tmdbRes = await fetch(tmdbUrl);
	const tmdb = tmdbRes.ok ? await tmdbRes.json() : null;

	let poster = null;
	if (tmdb && tmdb.poster_path)
		poster = `https://image.tmdb.org/t/p/w500${tmdb.poster_path}`;

	// === RPDB (notes) ===
	let rpdb = null;
	try {
		const rpdbUrl = `https://api.ratingposterdb.com/${RPDB_KEY}/${item.tmdb}`;
		const r = await fetch(rpdbUrl);
		rpdb = r.ok ? await r.json() : null;
	} catch (e) {}

	let description = tmdb && tmdb.overview ? tmdb.overview : "";

	// add RPDB ratings if available
	if (rpdb) {
		description =
			`⭐ IMDB: ${rpdb.imdb_rating}\n🍅 Rotten: ${rpdb.rt_score}%\n🟩 Meta: ${rpdb.meta_score}%\n\n` +
			description;
	}

	return {
		id: item.tmdb.toString(),
		type: item.type,
		name: tmdb ? (tmdb.title || tmdb.name) : item.title,
		poster: poster,
		description: description
	};
}

// === CATALOG HANDLER ===
builder.defineCatalogHandler(async ({ id }) => {
	const data = await loadJSON(id);

	const items = await Promise.all(
		data.map(async item => convertItem(item))
	);

	return { metas: items };
});

// === ADDON HTTP SERVER ===
const addonInterface = builder.getInterface();
app.get("/manifest.json", (_, res) => res.json(addonInterface.manifest));
app.get("/:resource/:type/:id", addonInterface.get);
app.get("/", (_, res) => res.send("Top 10 Streaming FR — Addon actif."));

app.listen(7000, () => console.log("Addon prêt sur le port 7000"));
