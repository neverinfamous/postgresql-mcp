/**
 * PostGIS Setup Prompt
 * 
 * Complete guide for setting up geospatial operations with PostGIS.
 */

import type { PromptDefinition, RequestContext } from '../../../types/index.js';

export function createSetupPostgisPrompt(): PromptDefinition {
    return {
        name: 'pg_setup_postgis',
        description: 'Complete guide for setting up geospatial operations with PostGIS including spatial types, indexing, and queries.',
        arguments: [
            {
                name: 'useCase',
                description: 'Use case: mapping, distance_calc, spatial_analysis, routing',
                required: false
            }
        ],
        // eslint-disable-next-line @typescript-eslint/require-await
        handler: async (args: Record<string, string>, _context: RequestContext): Promise<string> => {
            const useCase = args['useCase'] ?? 'mapping';

            let content = `# PostGIS Setup Guide - ${useCase.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}

## PostGIS Overview

PostGIS provides:
- 400+ spatial functions
- Spatial indexing (GiST, BRIN, SP-GiST)
- Geometry and Geography data types
- Spatial relationship analysis

## Setup Steps

### 1. Install PostGIS

\`\`\`sql
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT PostGIS_Full_Version();
\`\`\`

### 2. Spatial Data Types

**Geometry (Planar):** For local/regional mapping, uses projected coordinates
**Geography (Spherical):** For global mapping, uses lat/lon (WGS84)

**For ${useCase}:** Use ${useCase === 'mapping' || useCase === 'routing' ? 'Geography for global mapping' : 'Geometry for local analysis'}.

### 3. Create Spatial Table
`;

            if (useCase === 'mapping') {
                content += `
\`\`\`sql
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    location GEOGRAPHY(POINT, 4326),  -- WGS84 (GPS)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO locations (name, location)
VALUES ('San Francisco', ST_GeographyFromText('POINT(-122.4194 37.7749)'));
\`\`\`
`;
            } else if (useCase === 'distance_calc') {
                content += `
\`\`\`sql
CREATE TABLE points_of_interest (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    category VARCHAR(50),
    location GEOGRAPHY(POINT, 4326)
);

-- Find nearest POIs
SELECT name,
    ST_Distance(location, ST_GeographyFromText('POINT(-122.4194 37.7749)')) / 1000 as distance_km
FROM points_of_interest
ORDER BY location <-> ST_GeographyFromText('POINT(-122.4194 37.7749)')
LIMIT 10;
\`\`\`
`;
            } else if (useCase === 'spatial_analysis') {
                content += `
\`\`\`sql
CREATE TABLE regions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    boundary GEOGRAPHY(POLYGON, 4326),
    properties JSONB
);

-- Check if point is within region
SELECT r.name FROM regions r
WHERE ST_Contains(r.boundary::geometry,
    ST_GeographyFromText('POINT(-122.4194 37.7749)')::geometry);
\`\`\`
`;
            } else {
                content += `
\`\`\`sql
CREATE TABLE roads (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    road_type VARCHAR(50),
    geometry GEOGRAPHY(LINESTRING, 4326),
    length_meters FLOAT
);

-- Find roads within 1km
SELECT name, road_type FROM roads
WHERE ST_DWithin(geometry,
    ST_GeographyFromText('POINT(-122.4194 37.7749)'), 1000);
\`\`\`
`;
            }

            content += `
### 4. Create Spatial Index

\`\`\`sql
CREATE INDEX idx_locations_geog ON locations USING GIST (location);
\`\`\`

### 5. Common Spatial Queries

**Distance Queries:**
Use \`pg_geo_distance\`:
\`\`\`
pg_geo_distance(
    table_name: "locations",
    geometry_column: "location",
    reference_point: "POINT(-122.4194 37.7749)",
    max_distance: 10.0,
    distance_unit: "kilometers"
)
\`\`\`

**Containment Queries:**
Use \`pg_geo_within\` to find points within a polygon.

**Buffer Operations:**
Use \`pg_geo_buffer\` to create buffer zones.

### 6. GeoJSON Output

\`\`\`sql
SELECT jsonb_build_object(
    'type', 'Feature',
    'geometry', ST_AsGeoJSON(location)::jsonb,
    'properties', jsonb_build_object('name', name)
) as geojson
FROM locations;
\`\`\`

## Best Practices

1. **Always use spatial indexes** - 100x+ performance improvement
2. **Choose appropriate SRID** - 4326 for global, local SRID for regional
3. **Use geography for distance** - More accurate than geometry for Earth
4. **Validate geometries** - Use ST_IsValid()
5. **VACUUM ANALYZE regularly**

## Common Pitfalls

- ❌ Mixing geometry and geography without casting
- ❌ Not using spatial indexes for large datasets
- ❌ Using wrong SRID for coordinate system
- ❌ Calculating area/distance on lat/lon without geography type

**Pro Tip:** PostGIS is PostgreSQL's GIS superpower - it's the industry standard for spatial databases!`;

            return content;
        }
    };
}
