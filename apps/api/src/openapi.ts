export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Utama Memo System API",
    version: "1.0.0",
    description: "REST API specification for Utama Memo System (UMS)",
  },
  servers: [
    {
      url: "http://localhost:5500/api/v1",
      description: "Development server",
    },
  ],
  paths: {
    "/health": {
      get: {
        summary: "Health Check",
        responses: {
          "200": {
            description: "System healthy",
          },
        },
      },
    },
    "/ready": {
      get: {
        summary: "Readiness Check",
        responses: {
          "200": {
            description: "System and database ready",
          },
          "503": {
            description: "Service unavailable",
          },
        },
      },
    },
  },
};
