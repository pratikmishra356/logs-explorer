"""Map raw Splunk API responses to provider-agnostic dicts for DB storage."""

from datetime import datetime, timezone


def _now() -> datetime:
    return datetime.now(timezone.utc)


def map_index(entry: dict) -> dict:
    """Map a Splunk /data/indexes entry -> log_repository dict."""
    content = entry.get("content", {})
    return {
        "name": entry.get("name", ""),
        "external_id": entry.get("name", ""),
        "description": content.get("description", ""),
        "config": {
            "datatype": content.get("datatype"),
            "max_data_size": content.get("maxDataSize"),
            "total_event_count": content.get("totalEventCount"),
            "current_db_size_mb": content.get("currentDBSizeMB"),
            "min_time": content.get("minTime"),
            "max_time": content.get("maxTime"),
            "frozen_time_period": content.get("frozenTimePeriodInSecs"),
        },
        "synced_at": _now(),
    }


def map_sourcetype(entry: dict) -> dict:
    """Map a Splunk /data/props/sourcetypes entry -> log_source dict."""
    content = entry.get("content", {})
    return {
        "name": entry.get("name", ""),
        "external_id": entry.get("name", ""),
        "category": content.get("category", ""),
        "config": {
            "description": content.get("description"),
            "pulldown_type": content.get("pulldown_type"),
            "disabled": content.get("disabled"),
        },
        "synced_at": _now(),
    }


def map_app(entry: dict) -> dict:
    """Map a Splunk /apps/local entry -> application dict."""
    content = entry.get("content", {})
    return {
        "name": entry.get("name", ""),
        "label": content.get("label", ""),
        "version": content.get("version", ""),
        "external_id": entry.get("name", ""),
        "config": {
            "description": content.get("description"),
            "author": content.get("author"),
            "visible": content.get("visible"),
            "disabled": content.get("disabled"),
            "configured": content.get("configured"),
        },
        "synced_at": _now(),
    }


def map_saved_search(entry: dict) -> dict:
    """Map a Splunk /saved/searches entry -> saved_query dict."""
    content = entry.get("content", {})
    # Extract the app namespace from the entry's acl
    acl = entry.get("acl", {})
    return {
        "name": entry.get("name", ""),
        "query_string": content.get("search", ""),
        "description": content.get("description", ""),
        "schedule": content.get("cron_schedule", ""),
        "external_id": entry.get("name", ""),
        "config": {
            "is_scheduled": content.get("is_scheduled"),
            "alert_type": content.get("alert_type"),
            "dispatch_earliest_time": content.get("dispatch.earliest_time"),
            "dispatch_latest_time": content.get("dispatch.latest_time"),
            "disabled": content.get("disabled"),
            "app": acl.get("app"),
        },
        "synced_at": _now(),
        "_app_name": acl.get("app"),  # used to link to application
    }


def map_dashboard(entry: dict) -> dict:
    """Map a Splunk /data/ui/views entry -> dashboard dict."""
    content = entry.get("content", {})
    acl = entry.get("acl", {})
    return {
        "name": entry.get("name", ""),
        "label": content.get("label", entry.get("name", "")),
        "description": content.get("description", ""),
        "external_id": entry.get("name", ""),
        "config": {
            "is_visible": content.get("isVisible"),
            "disabled": content.get("disabled"),
            "app": acl.get("app"),
            "dashboard_type": content.get("eai:type"),
        },
        "synced_at": _now(),
        "_app_name": acl.get("app"),  # used to link to application
    }


def map_search_result(result: dict) -> dict:
    """Map a Splunk search export result -> SearchResult dict."""
    return {
        "time": result.get("_time"),
        "source": result.get("source"),
        "sourcetype": result.get("sourcetype"),
        "host": result.get("host"),
        "index": result.get("index"),
        "raw": result.get("_raw"),
        "fields": {k: v for k, v in result.items() if not k.startswith("_")},
    }
