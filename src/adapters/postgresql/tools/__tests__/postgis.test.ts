/**
 * postgres-mcp - PostGIS Extension Tools Unit Tests
 * 
 * Tests for geospatial operations (12 tools total).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PostgresAdapter } from '../../PostgresAdapter.js';
import { createMockPostgresAdapter, createMockRequestContext } from '../../../../__tests__/mocks/index.js';
import { getPostgisTools } from '../postgis/index.js';

describe('PostGIS Tools', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let mockContext: ReturnType<typeof createMockRequestContext>;
    let tools: ReturnType<typeof getPostgisTools>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        mockContext = createMockRequestContext();
        tools = getPostgisTools(mockAdapter as unknown as PostgresAdapter);
    });

    const findTool = (name: string) => tools.find(t => t.name === name);

    describe('pg_postgis_create_extension', () => {
        it('should create PostGIS extension', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

            const tool = findTool('pg_postgis_create_extension');
            const result = await tool!.handler({}, mockContext) as { success: boolean; message: string };

            expect(result.success).toBe(true);
            expect(result.message).toContain('PostGIS');
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('CREATE EXTENSION IF NOT EXISTS postgis')
            );
        });
    });

    describe('pg_geometry_column', () => {
        it('should add geometry column with defaults', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

            const tool = findTool('pg_geometry_column');
            const result = await tool!.handler({
                table: 'locations',
                column: 'geom'
            }, mockContext) as { success: boolean; srid: number; type: string };

            expect(result.success).toBe(true);
            expect(result.srid).toBe(4326);
            expect(result.type).toBe('GEOMETRY');
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('AddGeometryColumn')
            );
        });

        it('should add geometry column with custom settings', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

            const tool = findTool('pg_geometry_column');
            await tool!.handler({
                table: 'regions',
                column: 'boundary',
                srid: 3857,
                type: 'POLYGON',
                schema: 'geo'
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining("'geo'")
            );
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('3857')
            );
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining("'POLYGON'")
            );
        });
    });

    describe('pg_point_in_polygon', () => {
        it('should find polygons containing a point', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [
                    { id: 1, name: 'Zone A', geometry_text: 'POLYGON(...)' }
                ]
            });

            const tool = findTool('pg_point_in_polygon');
            const result = await tool!.handler({
                table: 'zones',
                column: 'geom',
                point: { lat: 40.7128, lng: -74.0060 }
            }, mockContext) as { containingPolygons: unknown[]; count: number };

            expect(result.count).toBe(1);
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('ST_Contains'),
                [-74.0060, 40.7128]
            );
        });
    });

    describe('pg_distance', () => {
        it('should find nearby geometries', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [
                    { id: 1, name: 'Store 1', distance_meters: 150 },
                    { id: 2, name: 'Store 2', distance_meters: 300 }
                ]
            });

            const tool = findTool('pg_distance');
            const result = await tool!.handler({
                table: 'stores',
                column: 'location',
                point: { lat: 40.7128, lng: -74.0060 },
                limit: 5
            }, mockContext) as { results: unknown[]; count: number };

            expect(result.count).toBe(2);
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('ST_Distance'),
                [-74.0060, 40.7128]
            );
        });

        it('should filter by max distance', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

            const tool = findTool('pg_distance');
            await tool!.handler({
                table: 'stores',
                column: 'location',
                point: { lat: 40.7128, lng: -74.0060 },
                maxDistance: 1000
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('<= 1000'),
                expect.anything()
            );
        });
    });

    describe('pg_buffer', () => {
        it('should create buffer zones', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ id: 1, buffer_geojson: '{"type":"Polygon",...}' }]
            });

            const tool = findTool('pg_buffer');
            const result = await tool!.handler({
                table: 'locations',
                column: 'geom',
                distance: 500
            }, mockContext) as { results: unknown[] };

            expect(result.results).toHaveLength(1);
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('ST_Buffer'),
                [500]
            );
        });

        it('should apply where clause', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

            const tool = findTool('pg_buffer');
            await tool!.handler({
                table: 'locations',
                column: 'geom',
                distance: 100,
                where: "type = 'store'"
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining("type = 'store'"),
                expect.anything()
            );
        });
    });

    describe('pg_intersection', () => {
        it('should find intersecting geometries with GeoJSON', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ id: 1 }, { id: 2 }]
            });

            const tool = findTool('pg_intersection');
            const result = await tool!.handler({
                table: 'parcels',
                column: 'boundary',
                geometry: '{"type":"Polygon","coordinates":[[[-74,40],[-74,41],[-73,41],[-73,40],[-74,40]]]}'
            }, mockContext) as { intersecting: unknown[]; count: number };

            expect(result.count).toBe(2);
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('ST_GeomFromGeoJSON'),
                expect.anything()
            );
        });

        it('should find intersecting geometries with WKT', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

            const tool = findTool('pg_intersection');
            await tool!.handler({
                table: 'parcels',
                column: 'boundary',
                geometry: 'POLYGON((-74 40, -74 41, -73 41, -73 40, -74 40))'
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('ST_GeomFromText'),
                expect.anything()
            );
        });
    });

    describe('pg_bounding_box', () => {
        it('should find geometries in bounding box', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ id: 1 }, { id: 2 }, { id: 3 }]
            });

            const tool = findTool('pg_bounding_box');
            const result = await tool!.handler({
                table: 'points',
                column: 'geom',
                minLng: -74.1,
                minLat: 40.7,
                maxLng: -73.9,
                maxLat: 40.8
            }, mockContext) as { results: unknown[]; count: number };

            expect(result.count).toBe(3);
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('ST_MakeEnvelope'),
                [-74.1, 40.7, -73.9, 40.8]
            );
        });
    });

    describe('pg_spatial_index', () => {
        it('should create GiST spatial index', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

            const tool = findTool('pg_spatial_index');
            const result = await tool!.handler({
                table: 'locations',
                column: 'geom'
            }, mockContext) as { success: boolean; index: string };

            expect(result.success).toBe(true);
            expect(result.index).toContain('idx_locations_geom');
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('USING GIST')
            );
        });

        it('should use custom index name', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

            const tool = findTool('pg_spatial_index');
            await tool!.handler({
                table: 'locations',
                column: 'geom',
                name: 'custom_spatial_idx'
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('"custom_spatial_idx"')
            );
        });
    });

    // Advanced PostGIS Tools

    describe('pg_geocode', () => {
        it('should create point from coordinates', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{
                    geojson: '{"type":"Point","coordinates":[-74.0060,40.7128]}',
                    wkt: 'POINT(-74.0060 40.7128)'
                }]
            });

            const tool = findTool('pg_geocode');
            const result = await tool!.handler({
                lat: 40.7128,
                lng: -74.0060
            }, mockContext) as { geojson: string; wkt: string };

            expect(result.geojson).toContain('Point');
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('ST_MakePoint'),
                [-74.0060, 40.7128, 4326]
            );
        });

        it('should use custom SRID', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [{}] });

            const tool = findTool('pg_geocode');
            await tool!.handler({
                lat: 40.7128,
                lng: -74.0060,
                srid: 3857
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.anything(),
                [-74.0060, 40.7128, 3857]
            );
        });
    });

    describe('pg_geo_transform', () => {
        it('should transform geometry between SRIDs', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ transformed_geojson: '{}', transformed_wkt: 'POINT(...)' }]
            });

            const tool = findTool('pg_geo_transform');
            const result = await tool!.handler({
                table: 'locations',
                column: 'geom',
                fromSrid: 4326,
                toSrid: 3857
            }, mockContext) as { fromSrid: number; toSrid: number };

            expect(result.fromSrid).toBe(4326);
            expect(result.toSrid).toBe(3857);
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('ST_Transform')
            );
        });
    });

    describe('pg_geo_index_optimize', () => {
        it('should analyze spatial indexes', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({
                    rows: [{
                        table_name: 'locations',
                        index_name: 'idx_locations_geom',
                        index_size: '10 MB',
                        index_scans: 1000
                    }]
                })
                .mockResolvedValueOnce({
                    rows: [{ table_name: 'locations', row_count: 50000, table_size: '100 MB' }]
                });

            const tool = findTool('pg_geo_index_optimize');
            const result = await tool!.handler({}, mockContext) as {
                spatialIndexes: unknown[];
                recommendations: string[];
            };

            expect(result.spatialIndexes).toHaveLength(1);
            expect(result.recommendations).toBeDefined();
        });

        it('should recommend index for large unindexed tables', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({ rows: [] }) // No indexes
                .mockResolvedValueOnce({
                    rows: [{ table_name: 'big_table', row_count: 100000 }]
                });

            const tool = findTool('pg_geo_index_optimize');
            const result = await tool!.handler({}, mockContext) as { recommendations: string[] };

            expect(result.recommendations.some(r => r.includes('no spatial index'))).toBe(true);
        });
    });

    describe('pg_geo_cluster', () => {
        it('should perform DBSCAN clustering by default', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({
                    rows: [
                        { cluster_id: 0, point_count: 50, centroid: '{}' },
                        { cluster_id: 1, point_count: 30, centroid: '{}' }
                    ]
                })
                .mockResolvedValueOnce({
                    rows: [{ num_clusters: 2, noise_points: 10, total_points: 90 }]
                });

            const tool = findTool('pg_geo_cluster');
            const result = await tool!.handler({
                table: 'points',
                column: 'geom'
            }, mockContext) as { method: string; clusters: unknown[] };

            expect(result.method).toBe('dbscan');
            expect(result.clusters).toHaveLength(2);
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('ST_ClusterDBSCAN')
            );
        });

        it('should perform K-Means clustering', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{}] });

            const tool = findTool('pg_geo_cluster');
            await tool!.handler({
                table: 'points',
                column: 'geom',
                method: 'kmeans',
                numClusters: 5
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('ST_ClusterKMeans')
            );
        });
    });

    it('should export all 12 PostGIS tools', () => {
        expect(tools).toHaveLength(12);
        const toolNames = tools.map(t => t.name);
        // Basic
        expect(toolNames).toContain('pg_postgis_create_extension');
        expect(toolNames).toContain('pg_geometry_column');
        expect(toolNames).toContain('pg_point_in_polygon');
        expect(toolNames).toContain('pg_distance');
        expect(toolNames).toContain('pg_buffer');
        expect(toolNames).toContain('pg_intersection');
        expect(toolNames).toContain('pg_bounding_box');
        expect(toolNames).toContain('pg_spatial_index');
        // Advanced
        expect(toolNames).toContain('pg_geocode');
        expect(toolNames).toContain('pg_geo_transform');
        expect(toolNames).toContain('pg_geo_index_optimize');
        expect(toolNames).toContain('pg_geo_cluster');
    });
});
