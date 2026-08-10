import 'dotenv/config'
import Joi, * as joi from 'joi';


interface EnvVars {

    PORT: number;
    DB_HOST: string;
    DB_USERNAME: string;
    DB_PASSWORD: string;
    REVIEW_DB_NAME: string;
    REVIEW_DB_PORT: number;
    NATS_SERVERS: string[];


}

const envsSchema = Joi.object({
    PORT: joi.number().required(),
    DB_HOST: joi.string().required(),
    REVIEW_DB_PORT: joi.number().required(),
    DB_USERNAME: joi.string().required(),
    DB_PASSWORD: joi.string().required(),
    REVIEW_DB_NAME: joi.string().required(),
    NATS_SERVERS: joi.array().items(joi.string()).required(),
}).unknown(true);

const { error, value } = envsSchema.validate({ ...process.env, NATS_SERVERS: process.env.NATS_SERVERS?.split(',') });

if (error) {
    throw new Error(`Config validation error: ${error.message}`)
}

const envVars: EnvVars = value;

export const envs = {
    port: envVars.PORT,
    dbHost: envVars.DB_HOST,
    dbPort: envVars.REVIEW_DB_PORT,
    dbUsername: envVars.DB_USERNAME,
    dbPassword: envVars.DB_PASSWORD,
    dbName: envVars.REVIEW_DB_NAME,
    natsServers: envVars.NATS_SERVERS,
};




