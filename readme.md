# Fund Data Cache

This is a simple Express app that uses Redis to cache data. The app exposes the route:

- `/fund/:fundname`: Accepts a `fundname` parameter and checks if the value of `fundname` exists in Redis. If it exists, returns the cached value. Otherwise, creates a new Redis record with `fundname` as the key.

## Installation

1. Clone the repository: `git clone https://github.com/<username>/<repository-name>.git`
2. Install dependencies: `npm install`

## Usage

1. Start the app: `npm start`
2. Open http://localhost:3000/ in your web browser to confirm the app is running.
3. To retrieve data for a specific fund, visit http://localhost:3000/fund/:fundname in your browser.

## Configuration

The app connects to Redis using environment variables. The following environment variables can be set to configure the Redis connection:

- `REDIS_HOST`: The Redis server hostname.
- `REDIS_PORT`: The Redis server port number.
- `REDIS_USERNAME`: The Redis server password.
- `REDIS_PASSWORD`: The Redis server password.