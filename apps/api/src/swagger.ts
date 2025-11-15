/**
 * Swagger/OpenAPI Setup
 * Provides interactive API documentation
 */

import swaggerUi from 'swagger-ui-express';
import yaml from 'yamljs';
import { Express } from 'express';
import path from 'path';

/**
 * Setup Swagger UI for API documentation
 */
export function setupSwagger(app: Express) {
  // Load OpenAPI specification
  const swaggerDocument = yaml.load(
    path.join(__dirname, '../../../docs/openapi.yaml')
  );

  // Swagger UI options
  const options = {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Mycelix Music API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
    },
  };

  // Serve Swagger UI
  app.use('/api-docs', swaggerUi.serve);
  app.get('/api-docs', swaggerUi.setup(swaggerDocument, options));

  // Serve raw OpenAPI spec
  app.get('/api-docs.json', (req, res) => {
    res.json(swaggerDocument);
  });

  app.get('/api-docs.yaml', (req, res) => {
    res.type('text/yaml');
    res.send(yaml.stringify(swaggerDocument, 10));
  });

  console.log('📚 API Documentation available at /api-docs');
}

/**
 * Generate API client code from OpenAPI spec
 * Usage: npm run generate-client
 */
export function generateApiClient() {
  // This would use openapi-generator-cli
  console.log('Generating API client...');
  console.log('Run: npx openapi-generator-cli generate -i docs/openapi.yaml -g typescript-axios -o packages/api-client');
}
