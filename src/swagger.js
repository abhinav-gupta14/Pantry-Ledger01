import swaggerJSDoc from 'swagger-jsdoc';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Restaurant Pantry Ledger API',
      version: '1.0.0',
      description: 'Inventory, supplier, purchase order, and recipe APIs for a restaurant pantry management system.'
    },
    servers: [{ url: '/' }]
  },
  apis: ['./src/routes/*.js', './src/app.js']
};

export const swaggerSpec = swaggerJSDoc(swaggerOptions);
