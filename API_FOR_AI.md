# Log Explorer API - Guide for AI Agents

Multi-tenant log exploration API for discovering and searching logs from Splunk Cloud and other providers.

## Base URL

```
http://localhost:8003/api/v1
```

## Core Concepts

- **Organization**: Top-level tenant container
- **Index**: Log repository/index (e.g., `prod_g2`, `staging_logs`)
- **Source**: Service/log source within an index (e.g., `payment-fraud-state-manager`)
- **Used Indexes**: Important indexes marked by users (check `used_indexes` in org details)

## Quick Workflow

1. Get organization → Check `used_indexes` for important indexes
2. List indexes → Get available log repositories
3. Search sources → Find services matching a pattern
4. Search logs → Query logs by index, source, and terms

## Key APIs

### 1. Get Organization (Check Used Indexes)

```
GET /organizations/{org_id}
```

**Response**: Includes `used_indexes: ["prod_g2", "prod_restaurant"]` - prioritize these indexes first.

### 2. List Indexes

```
GET /organizations/{org_id}/indexes
```

**Response**: `[{id, name, description, synced_at}]`

### 3. List Sources for Index

```
GET /organizations/{org_id}/indexes/{index_id}/sources
```

**Response**: `[{id, name, total_count, last_event_at, repository_id}]`

### 4. Search Sources (Regex)

```
POST /organizations/{org_id}/sources/search
Body: { "search": "payment fraud", "repository_id": "<optional>" }
```

**Behavior**: Space-separated terms = OR search. Supports `*` wildcard. Returns matches with `repository_name` and `repository_id`.

**Example**:
```json
{
  "search": "payment*",
  "repository_id": "abc-123"
}
```

### 5. Search Logs

```
POST /organizations/{org_id}/search
Body: {
  "index": "prod_g2",
  "source": "payment-fraud",  // optional, auto-wrapped with wildcards
  "query": ["ERROR", "failed"],  // optional array, each quoted
  "from_time": "2026-02-08T10:00:00Z",
  "to_time": "2026-02-08T11:00:00Z",
  "max_results": 100  // default 100, max 1000
}
```

**Response**: `{ "data": [log_entry_dict[]] }`

**Notes**:
- `index` is required
- `source` is auto-wrapped: `"payment-fraud"` → `source="*payment-fraud*"`
- `query` terms are quoted: `["ERROR"]` → `"ERROR"`
- Time range max: 7 days
- Uses async job flow (never hangs)

## Using Used Indexes

```python
# 1. Get org and check used_indexes
org = GET /organizations/{org_id}
important = org.used_indexes  # ["prod_g2", "prod_restaurant"]

# 2. Prioritize these indexes when exploring
for index_name in important:
    indexes = GET /organizations/{org_id}/indexes
    index = find_by_name(indexes, index_name)
    # Explore this index first
```

## Example Workflow

```python
# 1. Get organization
org = GET /organizations/{org_id}
used_indexes = org.used_indexes  # ["prod_g2"]

# 2. Search for payment sources
sources = POST /organizations/{org_id}/sources/search
          Body: {"search": "payment"}

# 3. Search logs
logs = POST /organizations/{org_id}/search
        Body: {
          "index": "prod_g2",
          "source": sources.matches[0].name,
          "query": ["ERROR"],
          "from_time": "2026-02-08T10:00:00Z",
          "to_time": "2026-02-08T11:00:00Z",
          "max_results": 100
        }
```

## Tips

- **Check `used_indexes` first** - these are the important indexes
- **Use source search** to find relevant services before searching logs
- **Narrow time ranges** - smaller ranges are faster
- **Use `source` filter** - much faster than searching entire index
- **Set `max_results` appropriately** - default 100 is usually enough

## Error Codes

- `404`: Organization/index/source not found
- `400`: Invalid request (e.g., time range > 7 days)
- `502`: Provider connection failed
- `504`: Search timeout (narrow time range or add source filter)
