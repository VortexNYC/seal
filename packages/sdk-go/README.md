# Seal Go SDK

Typed Go client for the Seal API, generated from `apps/docs/openapi.yaml`.

```go
import seal "github.com/VortexNYC/seal/packages/sdk-go"

client, _ := seal.NewClientWithResponses("https://api.seal.nyc/api/v1",
    seal.WithRequestEditorFn(func(ctx context.Context, req *http.Request) error {
        req.Header.Set("Authorization", "Bearer "+apiKey)
        return nil
    }))
```

## Regenerate

```bash
go install github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.5.0
oapi-codegen -generate types,client -package seal -o client.gen.go ../../apps/docs/openapi.yaml
```

Note: the spec is OpenAPI 3.1; oapi-codegen targets 3.0. Generated code builds and covers all operations — re-check on spec upgrades.
