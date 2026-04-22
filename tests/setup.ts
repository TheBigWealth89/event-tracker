import path from 'path';
import dotenv from 'dotenv';

// Load .env.test
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });
