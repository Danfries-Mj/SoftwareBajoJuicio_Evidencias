import pg from 'pg';
import { dbConfig } from '../config/db.config.js';

const { Pool } = pg;

export const pool = new Pool(dbConfig);

// DEF-19: sin este manejador, un corte de la BD emite un evento 'error' no manejado y el proceso termina.
pool.on('error', (error) => {
    console.error('Conexión con PostgreSQL interrumpida; el pool se reconectará en la siguiente consulta:', error.message);
});

export const verificarConexion = async() => {
    try {
        await pool.query('SELECT NOW()');
        console.log('Conectado a PostgreSQL');
    } catch (error) {
        console.error('Error al conectar con PostgreSQL:', error.message);
    }
};