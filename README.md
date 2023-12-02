# litefs-fts-demo

To install dependencies:

```bash
bun install
```

To run:

for MacOS users (ref. https://bun.sh/docs/api/sqlite#loadextension)
```
brew install sqlite
export CUSTOM_SQLITE_PATH=$(ls -L $(brew --prefix)/Cellar/sqlite/*/lib/libsqlite3.dylib | head -n 1)
```

```bash
API_KEY=test bun run index.ts
```

This project was created using `bun init` in bun v1.0.14. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.


## Deploy to fly.io

Register on https://fly.io and [set up flyctl](https://fly.io/docs/hands-on/install-flyctl/).

Create an app.

```
fly apps create
```

Edit the app name in [fly.toml](fly.toml).

Generate your API key and set it as a secret.

```
fly secrets set --stage "API_KEY=${YOUR_API_KEY}"
```

Create LiteFS Cluster on fly.io console and set the secret token as a secret.

```
fly secrets set --stage "LITEFS_CLOUD_TOKEN=${SECRET_TOKEN}"
```

Attach Consul to the app for LiteFS.

```
fly consul attach
```

Deploy the app.

```
fly deploy
```
