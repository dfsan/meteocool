import 'ol/ol.css';

import OSM from 'ol/source/OSM';
import {fromLonLat} from 'ol/proj.js';
import TileJSON from 'ol/source/TileJSON.js';
import TileLayer from 'ol/layer/Tile.js';
import {Style, Fill, Stroke} from 'ol/style';
import CircleStyle from 'ol/style/Circle';
import {Map, View, Geolocation, Feature} from 'ol';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import io from 'socket.io-client';

// Register service work if available
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}

var view = new View({
  center: fromLonLat([10.447683, 51.163375]),
  zoom: 6,
  minzoom: 5
});

const map = new Map({
	target: 'map',
	layers: [
		new TileLayer({
			source: new OSM()
		}),

	],
	view: view
});

var geolocation = new Geolocation({
  // enableHighAccuracy must be set to true to have the heading value.
  trackingOptions: {
    enableHighAccuracy: true
  },
  projection: view.getProjection()
});

geolocation.setTracking(true);

// update the HTML page when the position changes.
geolocation.on('change', function() {
  console.log('/dev/null');
});

// handle geolocation error.
geolocation.on('error', function(error) {
  console.log('could not get location data, doing nothing like it\'s 1990');
});

var accuracyFeature = new Feature();
geolocation.on('change:accuracyGeometry', function() {
  accuracyFeature.setGeometry(geolocation.getAccuracyGeometry());
});

var positionFeature = new Feature();
positionFeature.setStyle(new Style({
  image: new CircleStyle({
    radius: 6,
    fill: new Fill({
      color: '#3399CC'
    }),
    stroke: new Stroke({
      color: '#fff',
      width: 2
    })
  })
}));

geolocation.on('change:position', function() {
  var coordinates = geolocation.getPosition();
  positionFeature.setGeometry(coordinates ?
    new Point(coordinates) : null);
  map.getView().animate({center: coordinates, zoom: 10});
});

new VectorLayer({
  map: map,
  source: new VectorSource({
    features: [accuracyFeature, positionFeature]
  })
});


if (process.env.NODE_ENV === 'production') {
	var tileUrl = 'https://a.tileserver.unimplemented.org/data/raa01-wx_10000-latest-dwd-wgs84_transformed.json';
	var websocketUrl = 'https://unimplemented.org/tile';
} else {
	var tileUrl = 'http://localhost:8070/data/raa01-wx_10000-latest-dwd-wgs84_transformed.json';
	var websocketUrl = 'http://localhost:8071/tile';
}

var reflectivityOpacity = 0.7;

var currentLayer = new TileLayer({
			source: new TileJSON({
				url: tileUrl,
				crossOrigin: 'anonymous'
			}),
			opacity: reflectivityOpacity
		});
map.addLayer(currentLayer);
// we can now later call removeLayer(currentLayer), then update it with the new
// tilesource and then call addLayer again.
const socket = io.connect(websocketUrl);

socket.on('connect', () => console.log('websocket connected'));
socket.on('map_update', function(data){
	console.log(data);
	var newLayer = new TileLayer({
			source: new TileJSON({
				tileJSON: data,
				crossOrigin: 'anonymous'
			}),
			opacity: reflectivityOpacity
		});
	// first add & fetch the new layer, then remove the old one to avoid
	// having no layer at all at some point.
	map.addLayer(newLayer);
	map.removeLayer(currentLayer);
	currentLayer = newLayer;
});
