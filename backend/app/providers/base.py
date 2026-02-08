from abc import ABC, abstractmethod


class BaseLogProvider(ABC):
    """Abstract base class for log provider integrations."""

    @abstractmethod
    async def test_connection(self) -> dict:
        """Test connectivity. Returns {"success": bool, "message": str, "details": dict|None}."""
        ...

    @abstractmethod
    async def sync_repositories(self) -> list[dict]:
        """Fetch all log repositories (indexes/indices) from provider."""
        ...

    @abstractmethod
    async def sync_sources_for_repository(self, repository_name: str) -> list[dict]:
        """Fetch all sources for a specific repository/index.

        Returns list of dicts with keys: name, total_count, last_event_at, first_event_at, config.
        """
        ...

    @abstractmethod
    async def sync_applications(self) -> list[dict]:
        """Fetch all applications (apps/plugins) from provider."""
        ...

    async def sync_saved_queries(self) -> list[dict]:
        """Optional. Returns empty list by default."""
        return []

    @abstractmethod
    async def sync_dashboards(self) -> list[dict]:
        """Fetch all dashboards/views from provider."""
        ...

    @abstractmethod
    async def execute_search(
        self,
        query: str,
        time_range: str = "-15m",
        repositories: list[str] | None = None,
        max_results: int = 100,
    ) -> dict:
        """Execute a search query. Returns {"success": bool, "results": list[dict], ...}."""
        ...
