# GPX to Roads

[![npm](https://img.shields.io/npm/v/gpx-to-roads)](https://www.npmjs.com/package/gpx-to-roads)

Get time and distance spent on each road from a .gpx file. Written in NodeJS.

## How to use

1. Install on your machine using `npm`:

```
npm install -g gpx-to-roads
```

2. Download a map file from OpenStreetMap using their [export tool](https://www.openstreetmap.org/export).
3. Use the following command:

```
gpx-to-roads <gpx file> <map data>
```

Example:

```
gpx-to-roads input.gpx map.osm

{
  "Some Street": {"distance": 30, "time": 14000}
  "Another Street": {"distance": 60, "time": 40000}
}
```

Result is returned in JSON. `distance` is in meters and `time` is in milliseconds.

## Performance

This tool wasn't written with performance in mind. It will most likely struggle with larger GPX files and/or map data.  
PRs to improve performance are extremely welcome!
