# Fund Data Cache

This is a simple Express app that uses local cache to cache data from an API. The app exposes the route:

- `/fund/:fundname`: Accepts a `fundname` parameter and checks if the value of `fundname` exists in local cache. If it exists, returns the cached value. Otherwise, creates a new local cache record with `fundname` as the key.

Only fund names that are listed set will return a valid response. Anything else will return not found.

## Installation

1. Clone the repository: `git clone https://github.com/<username>/<repository-name>.git`
2. Install dependencies: `npm install`

## Usage

1. Start the app: `npm start`
2. Open http://localhost:3000/ in your web browser to confirm the app is running.
3. To retrieve data for a specific fund, visit http://localhost:3000/fund/:fundname in your browser.

## Configuration

The app communicates with the IHS API using environment variables . The following environment variables can be set to configure the IHS API connection:

- `IHS_HOST`: The Redis server hostname.
- `IHS_NAMESPACE`: The Redis server port number.
- `IHS_USERNAME`: The Redis server password.
- `IHS_PASSWORD`: The Redis server password.

You also need to set what fund codes are acceptable. Separate multiple codes by a comma

- `VALID_CODES`: Comma separated string of valid fund codes.

