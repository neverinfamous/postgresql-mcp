docker cp c:\Users\chris\Desktop\postgres-mcp\test-database\test-resources.sql postgres-server:/tmp/ && docker exec postgres-server psql -U postgres -d postgres -f /tmp/test-resources.sql
