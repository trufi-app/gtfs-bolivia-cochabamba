const path = require('path');
const osmToGeojson = require('osm-public-transport-export');
const geojsonToGtfs = require('geojson-to-gtfs')
const loadCsv = require('csv-load-sync');
const routesInfo = loadCsv(path.join(__dirname, 'definitions', 'routes-info.csv'));
const carTypes = loadCsv(path.join(__dirname, 'definitions', 'car-types.csv'));
const outputPath = path.join(__dirname, 'output');

// Lookup maps
const lineLookup = new WeakMap();
const lineToType = {};
const lineToAgency = {};
const lineToSpeed = {};
const lineToColor = {};
routesInfo.forEach(info => {
  const carType = carTypes.find(car => car.type === info.type);

  lineToType[info.name] = info.type;
  lineToAgency[info.name] = info.agency;
  lineToSpeed[info.name] = carType.speed;
  lineToColor[info.name] = carType.color;
});
const agencyNameToId = {};
let agencyId = 1;

// Config
const osmExportConfig = {
  bounds: {
    south: -17.57727,  // minimum latitude
    west:  -66.376555, // minimum longitude
    north: -17.276198, // maximum latitude
    east:  -65.96397,  // maximum longitude
  },
  stopNameSeparator: ' y ',
  stopNameFallback: 'innominada',
};

const gtfsConfig = (stopMapping) => ({
  prepareGeojsonFeature: (feature) => {
    const name = feature.properties.name
      ? feature.properties.name.trim()
      : feature.properties.route.trim();
    const matches = name.match(/\b([1-9][0-9]{0,}(-?[A-Z])?|[A-Z]+)\b/);
    const line = matches ? matches[1] : name;

    lineLookup.set(feature, line);
  },
  agencyId: (feature) => {
    const line = lineLookup.get(feature);
    const name = lineToAgency[line];
    let id = agencyNameToId[name];

    if (id) {
      return id;
    }

    id = agencyId++;

    if (name) {
      agencyNameToId[name] = id;
    }

    return id;
  },
  agencyName: (feature) => {
    const line = lineLookup.get(feature);
    const name = lineToAgency[line] || 'UNNAMED';

    return name;
  },
  agencyUrl: "https://www.trufi.app",
  stopName: (coords, coordsIndex, feature) => {
    const nodeId = feature.geometry.nodes[coordsIndex];
    return stopMapping[nodeId];
  },
  routeShortName: (feature) => lineLookup.get(feature),
  routeLongName: (feature) => {
    const line = lineLookup.get(feature);
    const type = lineToType[line];
    const description = feature.properties.route
      ? feature.properties.route.trim()
      : feature.properties.line.trim();

    return `${description} (${type})`;
  },
  routeColor: (feature) => {
    const line = lineLookup.get(feature);
    const color = lineToColor[line] || '000000';

    return color;
  },
  vehicleSpeed: (feature) => {
    const line = lineLookup.get(feature);
    const speed = lineToSpeed[line] || 25;

    return speed;
  }
});

// Convert
osmToGeojson(osmExportConfig).then(data => {
  geojsonToGtfs(data.geojson, outputPath, gtfsConfig(data.stops));  
});
