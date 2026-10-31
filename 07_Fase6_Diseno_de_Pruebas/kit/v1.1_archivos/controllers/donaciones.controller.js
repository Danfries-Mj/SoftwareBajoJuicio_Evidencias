import {
    obtenerDonacionesService,
    obtenerDonacionPorIdService,
    crearDonacionService,
    aprobarDonacionService,
    rechazarDonacionService,
    eliminarDonacionService,
    puedeGestionarDonacion
} from '../services/donaciones.service.js';
import { crearNotificacionService } from '../services/notificaciones.service.js';

export const listarDonaciones = async(req, res) => {
    try {
        const { estado } = req.query;

        const filtros = { estado };

        if (req.usuario.rol === 'Laico') {
            filtros.id_usuario = req.usuario.id_usuario;
        }

        const donaciones = await obtenerDonacionesService(filtros, req.usuario);

        res.json({
            mensaje: 'Listado de donaciones',
            total: donaciones.length,
            donaciones
        });
    } catch (error) {
        res.status(500).json({
            mensaje: 'Error al listar donaciones',
            error: error.message
        });
    }
};

export const buscarDonacionPorId = async(req, res) => {
    try {
        const id = Number(req.params.id);

        const donacion = await obtenerDonacionPorIdService(id);

        if (!donacion) {
            return res.status(404).json({
                mensaje: 'Donación no encontrada'
            });
        }

        res.json({
            mensaje: 'Donación encontrada',
            donacion
        });
    } catch (error) {
        res.status(500).json({
            mensaje: 'Error al buscar donación',
            error: error.message
        });
    }
};

export const registrarDonacion = async(req, res) => {
    try {
        const { id_capilla, fecha, monto, id_documento, id_fondo } = req.body;

        if (!fecha || monto === undefined) {
            return res.status(400).json({
                mensaje: 'Los campos fecha y monto son obligatorios'
            });
        }

        if (!id_documento) {
            return res.status(400).json({
                mensaje: 'La foto del comprobante es obligatoria'
            });
        }

        if (Number(monto) < 5) {
            return res.status(400).json({
                mensaje: 'El monto mínimo de donación es $5.00'
            });
        }

        const donacion = await crearDonacionService({
            id_usuario: req.usuario.id_usuario, id_capilla, fecha, monto, id_documento, id_fondo
        });

        res.status(201).json({
            mensaje: 'Donación registrada correctamente, queda pendiente de validación',
            donacion
        });
    } catch (error) {
        res.status(400).json({
            mensaje: 'Error al registrar donación',
            error: error.message
        });
    }
};

export const aprobarDonacion = async(req, res) => {
    try {
        const id = Number(req.params.id);

        const donacionActual = await obtenerDonacionPorIdService(id);

        if (!donacionActual) {
            return res.status(404).json({
                mensaje: 'Donación no encontrada'
            });
        }

        if (!puedeGestionarDonacion(req.usuario, donacionActual)) {
            return res.status(403).json({
                mensaje: 'No tiene permisos para gestionar esta donación'
            });
        }

        // DEF-01: solo una donación Pendiente puede aprobarse (evita ingresos duplicados).
        if (donacionActual.estado !== 'Pendiente') {
            return res.status(409).json({
                mensaje: `La donación ya fue resuelta (estado: ${donacionActual.estado})`
            });
        }

        const donacion = await aprobarDonacionService(id, req.usuario.id_usuario);

        await crearNotificacionService(
            donacion.id_usuario,
            'Donación aprobada',
            `Tu donación de $${Number(donacion.monto).toFixed(2)} fue aprobada. ¡Gracias por tu aporte!`
        );

        res.json({
            mensaje: 'Donación aprobada correctamente',
            donacion
        });
    } catch (error) {
        res.status(500).json({
            mensaje: 'Error al aprobar donación',
            error: error.message
        });
    }
};

export const rechazarDonacion = async(req, res) => {
    try {
        const id = Number(req.params.id);

        const donacionActual = await obtenerDonacionPorIdService(id);

        if (!donacionActual) {
            return res.status(404).json({
                mensaje: 'Donación no encontrada'
            });
        }

        if (!puedeGestionarDonacion(req.usuario, donacionActual)) {
            return res.status(403).json({
                mensaje: 'No tiene permisos para gestionar esta donación'
            });
        }

        // DEF-01: solo una donación Pendiente puede rechazarse.
        if (donacionActual.estado !== 'Pendiente') {
            return res.status(409).json({
                mensaje: `La donación ya fue resuelta (estado: ${donacionActual.estado})`
            });
        }

        const donacion = await rechazarDonacionService(id, req.usuario.id_usuario);

        await crearNotificacionService(
            donacion.id_usuario,
            'Donación rechazada',
            `Tu donación de $${Number(donacion.monto).toFixed(2)} fue rechazada. Si crees que es un error, acércate a la parroquia.`
        );

        res.json({
            mensaje: 'Donación rechazada correctamente',
            donacion
        });
    } catch (error) {
        res.status(500).json({
            mensaje: 'Error al rechazar donación',
            error: error.message
        });
    }
};

export const borrarDonacion = async(req, res) => {
    try {
        const id = Number(req.params.id);

        const donacion = await eliminarDonacionService(id);

        if (!donacion) {
            return res.status(404).json({
                mensaje: 'Donación no encontrada'
            });
        }

        res.json({
            mensaje: 'Donación eliminada correctamente',
            donacion
        });
    } catch (error) {
        res.status(500).json({
            mensaje: 'Error al eliminar donación',
            error: error.message
        });
    }
};
