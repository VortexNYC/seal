# vortex-api-seal

Typed Python client for the Seal API, generated from `apps/docs/openapi.yaml`.

```python
from seal_api_client import Client
from seal_api_client.api.documents import list_documents

client = Client(base_url="https://api.seal.nyc/api/v1", token=api_key)
```

## Regenerate

```bash
uvx openapi-python-client generate --path ../../apps/docs/openapi.yaml --output-path . --meta uv --overwrite
```

PyPI package name is `vortex-api-seal`; the import package is `seal_api_client`.
