# Fund Data API

This is a Node.js application that provides an API for retrieving fund data from an external service. The application is built using the Express framework and utilizes several npm packages for various functionalities.

## Installation

To install and run the application, follow these steps:

1. Clone the repository or download the source code.
2. Navigate to the project directory.
3. Install the dependencies by running the following command:
   ```
   npm install
   ```
4. Set up the required environment variables by creating a `.env` file in the project directory. The following environment variables are required:
   - `IHS_HOST`: The host URL of the IHS service.
   - `IHS_NAMESPACE`: The namespace of the IHS service.
   - `IHS_USERNAME`: The username for authentication with the IHS service.
   - `IHS_PASSWORD`: The password for authentication with the IHS service.
   - `VALID_CODES`: A comma-separated list of valid fund codes.

## Usage

Once the installation and configuration are complete, you can start the application by running the following command:

```
npm start
```

The application will start a server and listen on the specified port (default: 3000). You can access the API endpoints using a tool like Postman or by making HTTP requests from your application.

### Endpoints

- `GET /`: Returns a JSON response indicating that the server is running.

- `GET /fund/:fundname`: Retrieves the latest fund data for the specified `fundname`. This endpoint will try to respond with a value from the local cache or will make a call to the IHS API.

  - The `fundname` parameter should be replaced with the actual fund code you want to retrieve data for.

  - The response will include information about the fund, such as the provider, fund ticker, ISIN, price, timestamp, status, and message.

## Authentication and Caching

The application uses authentication to access the external fund data service. It authenticates the user by obtaining an API key from the service and caching it for subsequent requests. The API key is automatically refreshed periodically.

Caching is implemented to improve performance and reduce the load on the external service. Fund data retrieved from the external service is cached for a short period (2 minutes by default). Subsequent requests for the same fund within the caching period will be served from the cache instead of making another request to the external service.

## Dependencies

The following npm packages are used in this application:

- `express`: A fast and minimalist web framework for Node.js.
- `node-cache`: A simple in-memory caching library.
- `response-time`: Middleware for adding response time header to HTTP responses.
- `axios`: A promise-based HTTP client for making API requests.
- `node-cron`: A library for scheduling periodic tasks.
- `moment-timezone`: A library for working with dates and times.
- `cors`: Middleware for enabling Cross-Origin Resource Sharing (CORS) in the application.
- `dotenv`: Loads environment variables from a `.env` file into `process.env`.

## Configuration

The application relies on environment variables for configuration. The required environment variables are listed above in the installation section. Make sure to set these variables in the `.env` file before running the application.

## Error Handling

The application includes error handling middleware to handle common errors and provide appropriate responses. If an endpoint is not found (404 error), or if an internal server error occurs (500 error), the middleware will respond with a JSON object containing the error message.

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).