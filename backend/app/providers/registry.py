from app.providers.base import BaseLogProvider
from app.providers.splunk.provider import SplunkCloudProvider

PROVIDER_MAP: dict[str, type[BaseLogProvider]] = {
    "splunk_cloud": SplunkCloudProvider,
}


def get_provider(provider_type: str, connection_config: dict) -> BaseLogProvider:
    """Factory: instantiate the right provider for a given connection.

    Args:
        provider_type: e.g. "splunk_cloud"
        connection_config: dict with host_url, auth_type, credentials, config
    """
    cls = PROVIDER_MAP.get(provider_type)
    if cls is None:
        raise ValueError(f"Unsupported provider type: {provider_type}")
    return cls(**connection_config)
