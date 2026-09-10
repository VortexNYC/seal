CREATE TABLE mcp_oauth_clients (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  redirect_uris TEXT NOT NULL,
  allowed_scopes TEXT NOT NULL DEFAULT 'mcp',
  token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none',
  grant_types TEXT NOT NULL DEFAULT 'authorization_code',
  response_types TEXT NOT NULL DEFAULT 'code',
  created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
  updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
);

CREATE INDEX mcp_oauth_clients_name_idx ON mcp_oauth_clients(name);

CREATE TABLE mcp_oauth_authorization_codes (
  code TEXT PRIMARY KEY NOT NULL,
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organization(id) ON DELETE CASCADE,
  scopes TEXT,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL,
  state TEXT,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
);

CREATE INDEX mcp_oauth_authorization_codes_client_id_idx ON mcp_oauth_authorization_codes(client_id);
CREATE INDEX mcp_oauth_authorization_codes_user_id_idx ON mcp_oauth_authorization_codes(user_id);
CREATE INDEX mcp_oauth_authorization_codes_expires_at_idx ON mcp_oauth_authorization_codes(expires_at);

CREATE TABLE mcp_oauth_refresh_tokens (
  id TEXT PRIMARY KEY NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organization(id) ON DELETE CASCADE,
  scopes TEXT,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
);

CREATE INDEX mcp_oauth_refresh_tokens_token_hash_idx ON mcp_oauth_refresh_tokens(token_hash);
CREATE INDEX mcp_oauth_refresh_tokens_user_id_idx ON mcp_oauth_refresh_tokens(user_id);
CREATE INDEX mcp_oauth_refresh_tokens_client_id_idx ON mcp_oauth_refresh_tokens(client_id);
