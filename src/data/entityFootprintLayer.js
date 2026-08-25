import { createLocalGeoJsonLayer } from './localGeojson.js';
import { riskBandColor } from './entityRisk.js';
import { mapFootprintAnalystRecord } from './footprintRecords.js';

/**
 * Entity-footprint layer: the configured group's legal entities on the map,
 * jurisdiction-enriched and PREDICTED-risk-scored server-side by
 * /api/entity-footprint (env-pointed source pack; the committed default is
 * the clearly-fictional Aurora demo group). Rides the bundled-layer factory
 * pointed at the proxy's GeoJSONL route, so pins, stems, ambient cards,
 * click-to-select context, analyst records, and share-link persistence all
 * come from the shared implementation — stem color is the risk band.
 *
 * Pack edits are picked up on the next enable cycle (dataset semantics,
 * same as every factory layer).
 */
const entityFootprintLayer = createLocalGeoJsonLayer({
  id: 'entity-footprint',
  url: '/api/entity-footprint/entities.geojsonl',
  name: 'Entity Footprint',
  color: '#7fd4ff', // Ice blue — the neutral fallback when a risk band is absent
  icon: '⬢',
  source: 'CONFIG PACK · FICTIONAL DEMO by default',
  labels: true,
  labelMax: 100,
  labelGridPx: 140,
  markerColor: (props) => riskBandColor(props?.riskBand),
  analystRecord: mapFootprintAnalystRecord,
});

export default entityFootprintLayer;
