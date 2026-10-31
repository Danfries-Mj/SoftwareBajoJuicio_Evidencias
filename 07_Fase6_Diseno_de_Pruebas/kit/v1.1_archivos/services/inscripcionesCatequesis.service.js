import {
    obtenerInscripcionesRepository,
    obtenerInscripcionPorIdRepository,
    crearInscripcionRepository,
    cambiarEstadoInscripcionRepository,
    eliminarInscripcionRepository,
    existeInscripcionAprobadaRepository
} from '../repositories/inscripcionesCatequesis.repository.js';
import { obtenerCertificadoPrerequisitoRepository } from '../repositories/certificados.repository.js';
import { obtenerUsuarioPorIdRepository } from '../repositories/usuarios.repository.js';

const NIVELES_VALIDOS = ['Primera Comunion', 'Confirmacion'];
const MONTO_INSCRIPCION = 5.00;

export const obtenerInscripcionesService = async(filtros) => {
    return await obtenerInscripcionesRepository(filtros);
};

export const obtenerInscripcionPorIdService = async(id) => {
    return await obtenerInscripcionPorIdRepository(id);
};

export const crearInscripcionService = async(datos) => {
    // DEF-02: el pago de catequesis es fijo; no se acepta otro monto enviado por el cliente.
    if (datos.monto !== undefined && datos.monto !== null && Number(datos.monto) !== MONTO_INSCRIPCION) {
        throw new Error(`El monto de la inscripción debe ser $${MONTO_INSCRIPCION.toFixed(2)}`);
    }
    if (!NIVELES_VALIDOS.includes(datos.nivel)) {
        throw new Error(`Nivel inválido. Niveles permitidos: ${NIVELES_VALIDOS.join(', ')}`);
    }

    // No se debe permitir una nueva solicitud de este nivel si el laico ya tiene una
    // aprobada vigente. Se levanta si esa inscripción se rechaza o se elimina.
    const yaAprobada = await existeInscripcionAprobadaRepository(datos.id_laico, datos.nivel);
    if (yaAprobada) {
        throw new Error(`Ya tienes una inscripción de ${datos.nivel} aprobada. No puedes registrar otra mientras siga vigente.`);
    }

    // Tampoco tiene sentido si el laico ya tiene el certificado de este nivel emitido: ya
    // lo recibió, no hay nada que volver a tramitar (el tipo de certificado usa el mismo
    // nombre que el nivel de catequesis, a diferencia de Bautizo -> Bautismo).
    const solicitante = await obtenerUsuarioPorIdRepository(datos.id_laico);
    if (solicitante?.id_persona) {
        const yaEmitido = await obtenerCertificadoPrerequisitoRepository(solicitante.id_persona, datos.nivel);
        if (yaEmitido) {
            throw new Error(`Ya tienes el certificado de ${datos.nivel} emitido. No puedes volver a solicitar este nivel.`);
        }
    }

    return await crearInscripcionRepository({
        id_laico: datos.id_laico,
        nivel: datos.nivel,
        id_capilla: datos.id_capilla,
        monto: MONTO_INSCRIPCION,
        id_documento: datos.id_documento
    });
};

export const aprobarInscripcionService = async(id, idRevisor) => {
    return await cambiarEstadoInscripcionRepository(id, 'Aprobada', idRevisor);
};

export const rechazarInscripcionService = async(id, idRevisor) => {
    return await cambiarEstadoInscripcionRepository(id, 'Rechazada', idRevisor);
};

export const eliminarInscripcionService = async(id) => {
    return await eliminarInscripcionRepository(id);
};
