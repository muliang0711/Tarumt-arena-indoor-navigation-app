# Arena administration

Two pages: `/` for navigation statistics, `/live` for all active users on the App's 2D map. Place names and coordinates are generated from the Flutter catalog and canonical map bundle.

## Local Docker demo

From the parent `tarumt-nav-app` directory:

```sh
bash dev/admin-local.sh up
node dev/verify-admin-local.mjs
```

Open http://localhost:3100. The complete backend and 100 simulated users run in Docker. On the map, **10 / 20 / 30 / All** limits the displayed markers only. See `../deploy/ADMIN-LOCAL.md` for simulator controls and teardown.

## Development

Node.js >=22.13.0 is required. Run `npm ci` if dependencies are missing. Configure the following in an ignored `.dev.vars` file for the local Worker preview:

```dotenv
PRESENCE_API_BASE_URL=http://127.0.0.1:18080
ANALYTICS_API_BASE_URL=http://127.0.0.1:19092
```

Run `npm run dev -- --port 3100` after stopping the Docker `admin-web` service to release that port. `npm run build` builds the site; `npm test` checks both server-rendered pages. The Docker production server uses runtime environment variables from Compose. Hosting metadata and existing social images remain available for a later Sites deployment.

Statistics use Malaysia calendar days and Monday-based weeks. Counts are navigation starts, not unique people. Rankings suppress destinations with fewer than five starts. The live page never substitutes fabricated actors when the backend is unavailable.
