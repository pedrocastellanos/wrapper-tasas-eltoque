const rateValueSchema = {
  type: "object",
  required: ["currency", "cup"],
  properties: {
    currency: { type: "string", example: "USD" },
    cup: { type: "number", format: "float", example: 760 }
  }
};

const dailyRatesSchema = {
  type: "object",
  required: ["rateDate", "fetchedAt", "source", "sourceUrl", "rates"],
  properties: {
    rateDate: { type: "string", format: "date", example: "2026-10-02" },
    fetchedAt: { type: "string", format: "date-time" },
    source: { type: "string", enum: ["elTOQUE"] },
    sourceUrl: { type: "string", format: "uri" },
    rates: { type: "array", items: { $ref: "#/components/schemas/RateValue" } }
  }
};

const errorSchema = {
  type: "object",
  required: ["error"],
  properties: {
    error: { type: "string", example: "No hay tasas almacenadas todavía." }
  }
};

export const swaggerDocument = {
  openapi: "3.0.3",
  info: {
    title: "elTOQUE Rates API",
    version: "1.0.0",
    description: "API pública para consultar las tasas del mercado informal publicadas por elTOQUE."
  },
  servers: [{ url: "/" }],
  tags: [{ name: "Rates", description: "Consulta y actualización de tasas" }],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Comprueba el estado de la API",
        responses: {
          "200": {
            description: "Servicio disponible",
            content: { "application/json": { schema: { type: "object", properties: { status: { type: "string", example: "ok" }, service: { type: "string", example: "eltoque-rates-api" } } } } }
          }
        }
      }
    },
    "/api/rates": {
      get: {
        tags: ["Rates"],
        summary: "Obtiene las tasas más recientes almacenadas",
        responses: {
          "200": { description: "Tasas más recientes", content: { "application/json": { schema: { $ref: "#/components/schemas/DailyRates" } } } },
          "404": { description: "No existen tasas almacenadas", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }
        }
      }
    },
    "/api/rates/date/{date}": {
      get: {
        tags: ["Rates"],
        summary: "Obtiene las tasas de una fecha",
        parameters: [{ $ref: "#/components/parameters/Date" }],
        responses: {
          "200": { description: "Tasas de la fecha", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/DailyRates" }, { type: "object", properties: { cached: { type: "boolean" } } }] } } } },
          "502": { description: "Error consultando la fuente oficial", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }
        }
      }
    },
    "/api/rates/{currency}": {
      get: {
        tags: ["Rates"],
        summary: "Obtiene la tasa más reciente de una moneda",
        parameters: [{ $ref: "#/components/parameters/Currency" }],
        responses: {
          "200": { description: "Tasa de la moneda", content: { "application/json": { schema: { $ref: "#/components/schemas/RateValue" } } } },
          "404": { description: "Tasa no encontrada", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }
        }
      }
    },
    "/api/rates/{currency}/{date}": {
      get: {
        tags: ["Rates"],
        summary: "Obtiene la tasa de una moneda en una fecha",
        parameters: [{ $ref: "#/components/parameters/Currency" }, { $ref: "#/components/parameters/Date" }],
        responses: {
          "200": { description: "Tasa de la moneda", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/RateValue" }, { type: "object", properties: { cached: { type: "boolean" } } }] } } } },
          "404": { description: "Tasa no encontrada", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "502": { description: "Error consultando la fuente oficial", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }
        }
      }
    },
    "/api/rates/refresh": {
      post: {
        tags: ["Rates"],
        summary: "Fuerza la consulta a la fuente oficial y actualiza las tasas del día",
        responses: {
          "200": { description: "Tasas consultadas y captura almacenada actualizada (cached: false)", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/DailyRates" }, { type: "object", properties: { cached: { type: "boolean", example: false } } }] } } } },
          "502": { description: "Error consultando la fuente oficial", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }
        }
      }
    }
  },
  components: {
    parameters: {
      Date: { name: "date", in: "path", required: true, description: "Fecha en formato YYYY-MM-DD", schema: { type: "string", format: "date", example: "2026-10-02" } },
      Currency: { name: "currency", in: "path", required: true, description: "Código de moneda, por ejemplo USD, EUR o MLC", schema: { type: "string", example: "USD" } }
    },
    schemas: {
      RateValue: rateValueSchema,
      DailyRates: dailyRatesSchema,
      Error: errorSchema
    }
  }
};
