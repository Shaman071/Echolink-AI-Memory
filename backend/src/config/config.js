const Joi = require('@hapi/joi');
require('dotenv').config();

const envVarsSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3001),
  MONGODB_URI: Joi.string().required().description('MongoDB connection URI'),
  JWT_SECRET: Joi.string().required().description('JWT secret key'),
  JWT_EXPIRE: Joi.string().default('7d').description('JWT expiration time'),
  JWT_COOKIE_EXPIRE: Joi.number().default(30).description('JWT cookie expire days'),
  MAX_FILE_SIZE: Joi.number().default(52428800).description('Max file size in bytes (50MB)'),
  UPLOAD_PATH: Joi.string().default('./uploads').description('File upload directory'),
  FRONTEND_URL: Joi.string().default('http://localhost:3000').description('Frontend URL for CORS'),
  OPENAI_API_KEY: Joi.string().allow('').description('OpenAI API key'),
  EMBEDDING_SERVICE_URL: Joi.string().default('http://localhost:5000').description('Embedding service URL'),
  REDIS_URL: Joi.string().allow('').description('Optional Redis URL for job queue and circuit-breaker persistence'),
  LOG_LEVEL: Joi.string().default('info').description('Log level'),
}).unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  mongoose: {
    url: envVars.MONGODB_URI,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    expire: envVars.JWT_EXPIRE,
    cookieExpire: envVars.JWT_COOKIE_EXPIRE,
  },
  upload: {
    maxFileSize: envVars.MAX_FILE_SIZE,
    uploadPath: envVars.UPLOAD_PATH,
  },
  frontendUrl: envVars.FRONTEND_URL,
  openai: {
    apiKey: envVars.OPENAI_API_KEY,
  },
  embeddingService: {
    url: envVars.EMBEDDING_SERVICE_URL,
  },
  logLevel: envVars.LOG_LEVEL,
};
