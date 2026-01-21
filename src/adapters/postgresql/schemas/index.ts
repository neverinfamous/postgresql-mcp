/**
 * postgres-mcp - PostgreSQL Zod Schemas
 *
 * Re-exports all input validation schemas from modular files.
 */

// Core tool schemas (queries, tables, indexes, transactions)
export {
  ReadQuerySchema,
  WriteQuerySchema,
  ListTablesSchema,
  DescribeTableSchema,
  CreateTableSchema,
  DropTableSchema,
  GetIndexesSchema,
  CreateIndexSchema,
  BeginTransactionSchema,
  TransactionIdSchema,
  TransactionIdSchemaBase,
  SavepointSchema,
  SavepointSchemaBase,
  ExecuteInTransactionSchema,
  TransactionExecuteSchema,
  TransactionExecuteSchemaBase,
} from "./core.js";

// JSONB operation schemas
export {
  JsonbExtractSchema,
  JsonbSetSchema,
  JsonbContainsSchema,
  JsonbPathQuerySchema,
  JsonbInsertSchema,
  JsonbDeleteSchema,
  // Path normalization functions (for handler use)
  normalizePathToArray,
  normalizePathForInsert,
  normalizePathToString,
  parseJsonbValue,
  stringPathToArray,
  arrayPathToString,
} from "./jsonb.js";

// Text search schemas
export {
  TextSearchSchema,
  TextSearchSchemaBase,
  TrigramSimilaritySchema,
  TrigramSimilaritySchemaBase,
  RegexpMatchSchema,
  RegexpMatchSchemaBase,
  preprocessTextParams,
} from "./text-search.js";

// Performance and explain schemas
export {
  ExplainSchema,
  ExplainSchemaBase,
  preprocessExplainParams,
  IndexStatsSchema,
  TableStatsSchema,
} from "./performance.js";

// Admin operation schemas
export {
  VacuumSchema,
  VacuumSchemaBase,
  AnalyzeSchema,
  AnalyzeSchemaBase,
  ReindexSchema,
  ReindexSchemaBase,
  TerminateBackendSchema,
  TerminateBackendSchemaBase,
  CancelBackendSchema,
  CancelBackendSchemaBase,
} from "./admin.js";

// Monitoring schemas
export {
  DatabaseSizeSchema,
  TableSizesSchema,
  ShowSettingsSchema,
} from "./monitoring.js";

// Backup and export schemas
export {
  CopyExportSchema,
  CopyExportSchemaBase,
  DumpSchemaSchema,
} from "./backup.js";

// Schema management schemas
export {
  CreateSchemaSchema,
  DropSchemaSchema,
  CreateSequenceSchema,
  CreateViewSchema,
} from "./schema-mgmt.js";

// pgvector schemas
export {
  VectorSearchSchema,
  VectorCreateIndexSchema,
  FiniteNumberArray,
} from "./vector.js";

// PostGIS schemas
export {
  // Base schemas for MCP visibility
  GeometryColumnSchemaBase,
  GeometryDistanceSchemaBase,
  PointInPolygonSchemaBase,
  SpatialIndexSchemaBase,
  BufferSchemaBase,
  IntersectionSchemaBase,
  BoundingBoxSchemaBase,
  GeocodeSchemaBase,
  GeoTransformSchemaBase,
  GeoClusterSchemaBase,
  GeometryBufferSchemaBase,
  GeometryIntersectionSchemaBase,
  GeometryTransformSchemaBase,
  // Transformed schemas for handler validation
  GeometryColumnSchema,
  GeometryDistanceSchema,
  PointInPolygonSchema,
  SpatialIndexSchema,
  BufferSchema,
  IntersectionSchema,
  BoundingBoxSchema,
  GeocodeSchema,
  GeoTransformSchema,
  GeoClusterSchema,
  GeometryBufferSchema,
  GeometryIntersectionSchema,
  GeometryTransformSchema,
  // Utility functions
  preprocessPostgisParams,
  preprocessPoint,
  convertToMeters,
} from "./postgis.js";

// Partitioning schemas
export {
  CreatePartitionedTableSchema,
  CreatePartitionSchema,
  AttachPartitionSchema,
  DetachPartitionSchema,
} from "./partitioning.js";

// pg_cron schemas
export {
  CronScheduleSchema,
  CronScheduleSchemaBase,
  CronScheduleInDatabaseSchema,
  CronScheduleInDatabaseSchemaBase,
  CronUnscheduleSchema,
  CronAlterJobSchema,
  CronJobRunDetailsSchema,
  CronCleanupHistorySchema,
  CronCleanupHistorySchemaBase,
} from "./cron.js";

// pg_partman schemas
export {
  PartmanCreateParentSchema,
  PartmanRunMaintenanceSchema,
  PartmanShowPartitionsSchema,
  PartmanCheckDefaultSchema,
  PartmanPartitionDataSchema,
  PartmanRetentionSchema,
  PartmanUndoPartitionSchema,
  PartmanUpdateConfigSchema,
} from "./partman.js";

// Extension schemas (kcache, citext, ltree, pgcrypto)
export {
  // pg_stat_kcache
  KcacheQueryStatsSchema,
  KcacheTopConsumersSchema,
  KcacheDatabaseStatsSchema,
  KcacheResourceAnalysisSchema,
  // citext
  CitextConvertColumnSchema,
  CitextConvertColumnSchemaBase,
  CitextListColumnsSchema,
  CitextAnalyzeCandidatesSchema,
  CitextAnalyzeCandidatesSchemaBase,
  CitextSchemaAdvisorSchema,
  CitextSchemaAdvisorSchemaBase,
  // ltree
  LtreeQuerySchema,
  LtreeQuerySchemaBase,
  LtreeSubpathSchema,
  LtreeSubpathSchemaBase,
  LtreeLcaSchema,
  LtreeMatchSchema,
  LtreeMatchSchemaBase,
  LtreeListColumnsSchema,
  LtreeConvertColumnSchema,
  LtreeConvertColumnSchemaBase,
  LtreeIndexSchema,
  LtreeIndexSchemaBase,
  // pgcrypto
  PgcryptoHashSchema,
  PgcryptoHmacSchema,
  PgcryptoEncryptSchema,
  PgcryptoEncryptSchemaBase,
  PgcryptoDecryptSchema,
  PgcryptoDecryptSchemaBase,
  PgcryptoRandomBytesSchema,
  PgcryptoGenSaltSchema,
  PgcryptoCryptSchema,
} from "./extensions.js";
