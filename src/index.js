#!/usr/bin/env node

const GPX = require("gpx-for-runners");
const osmtogeojson = require("osmtogeojson");
const fs = require("fs").promises;
const arg = require("arg");
const path = require("path");
const { version } = require("../package.json");

const args = arg({
  "--roadTypeMap": String,
  "--help": Boolean,
  "--version": Boolean,

  "-h": "--help",
  "-v": "--version",
});

const main = async () => {
  if (args["--version"]) return console.log(`Version: ${version}`);
  if (args["_"].length < 2 || args["--help"]) return printHelp();

  const gpxInput = await fs.readFile(path.join(".", args["_"][0]));
  const mapInput = await readMapData(path.join(".", args["_"][1]));
  const roadMap =
    args["--roadTypeMap"] &&
    (await fs.readFile(path.join(".", args["--roadTypeMap"])));

  if (!mapInput)
    return console.log(
      "Invalid map extension. Please use .geojson or .osm files."
    );

  console.log(
    JSON.stringify(
      await analyzeRoute(gpxInput.toString("utf-8"), mapInput, {
        roadMap: roadMap && JSON.parse(roadMap.toString("utf-8")),
      }),
      null,
      2
    )
  );
};

const printHelp = () => {
  console.log("Usage: gpx-to-roads <path to gpx> <path to map>");
  console.log("  Accepted map formats: .osm, .geojson");
  console.log("Options:");
  console.log("--help/-h - Shows this menu");
  console.log("--version/-v - Shows tool version");
  console.log(
    "--roadTypeMap - Path to JSON file that maps road names to road types"
  );
};

const readMapData = async (mapPath) => {
  const ext = path.extname(mapPath);
  const fileContentString = (await fs.readFile(mapPath)).toString("utf-8");
  if (ext === ".geojson") return fileContentString;
  if (ext === ".osm") {
    const XMLDOMParser = require("xmldom").DOMParser;
    const xmlDoc = new XMLDOMParser().parseFromString(
      fileContentString,
      "text/xml"
    );
    return osmtogeojson(xmlDoc);
  }
  return null;
};

// Remove unwanted properties, nodes, relations, etc
const sanitizeMapData = (input) => {
  const featureList = input.features;

  return featureList
    .filter(
      (feature) =>
        feature.id.startsWith("way/") &&
        feature.geometry.type === "LineString" &&
        feature.properties.name
    )
    .map((feature) => ({
      name: feature.properties.name,
      coordinates: feature.geometry.coordinates,
    }));
};

/**
 * https://stackoverflow.com/a/1501725/5758191
 */
const distToSegment = (p1, p2, p) => {
  const sqr = (x) => {
    return x * x;
  };
  const dist2 = ([x1, y1], [x2, y2]) => {
    return sqr(x1 - x2) + sqr(y1 - y2);
  };
  const distToSegmentSquared = ([x, y], [x1, y1], [x2, y2]) => {
    var l2 = dist2([x1, y1], [x2, y2]);
    if (l2 == 0) return dist2(p, [x1, y1]);
    var t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return dist2([x, y], [x1 + t * (x2 - x1), y1 + t * (y2 - y1)]);
  };
  return Math.sqrt(distToSegmentSquared(p, p1, p2));
};

const getClosestRoad = (point, map) => {
  // Loop through each road
  const distanceToRoad = map
    .reduce(
      (acc, v) => [
        ...acc,
        // Loop through each road segment
        ...v.coordinates
          .map((coord, i, arr) =>
            arr[i + 1]
              ? {
                  name: v.name,
                  coord,
                  d: distToSegment(coord, arr[i + 1], point),
                }
              : null
          )
          .slice(0, -1),
      ],
      []
    )
    .sort((a, b) => a.d - b.d);
  //console.log(distanceToRoad);
  return distanceToRoad[0].name;
};

const getRoadType = (name, roadMap) => {
  const type = Object.entries(roadMap).find(([k]) => name.includes(k));
  return type ? type[1] : name;
};

const analyzeRoute = async (gpxInput, mapInput, { roadMap = {} }) => {
  const map = sanitizeMapData(
    typeof mapInput === "object" ? mapInput : JSON.parse(mapInput)
  );
  const gpx = new GPX(gpxInput);
  const trackpoints = [...gpx.trackpoints];

  const statsByRoadType = trackpoints.reduce((acc, v, i, arr) => {
    if (i === 0) return acc;

    const roadType = getRoadType(getClosestRoad([v.lon, v.lat], map), roadMap);
    const distanceDelta = gpx.calcDistanceBetweenPoints(arr[i - 1], v);
    const timeDelta =
      new Date(v.time).getTime() - new Date(arr[i - 1].time).getTime();

    // TODO target node 14 and use ?. and ?? operators
    if (!acc[roadType])
      return {
        ...acc,
        [roadType]: { distance: distanceDelta, time: timeDelta },
      };
    return {
      ...acc,
      [roadType]: {
        distance: acc[roadType].distance + distanceDelta,
        time: acc[roadType].time + timeDelta,
      },
    };
  }, {});

  const statsInMeters = Object.entries(statsByRoadType).reduce(
    (acc, [k, v]) => ({
      ...acc,
      [k]: { ...v, distance: Math.round(v.distance * 1000) },
    }),
    {}
  );
  return statsInMeters;
};

main();
