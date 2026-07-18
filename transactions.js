// transactions.js - Transacción entre "parqueos" y "zonas" (requiere Replica Set)

const dbName = "campus_parking";
db = db.getSiblingDB(dbName);

// ============================================================
// Registrar INGRESO: inserta en "parqueos" + descuenta cupo en "zonas"
// ============================================================
function registrarIngresoConTransaccion(vehiculoId, zonaId, horaEntrada) {
  const session = db.getMongo().startSession({ readPreference: { mode: "primary" } });
  const sesionDb = session.getDatabase(dbName);
  let parqueoCreado = null;

  try {
    session.startTransaction({ readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });

    const vehiculo = sesionDb.vehiculos.findOne({ _id: vehiculoId });
    if (!vehiculo) throw new Error(`El vehículo ${vehiculoId} no existe.`);

    const zona = sesionDb.zonas.findOne({ _id: zonaId });
    if (!zona) throw new Error(`La zona ${zonaId} no existe.`);
    if (zona.estado !== "activa") throw new Error(`La zona ${zona.codigo} no está activa.`);
    if (!zona.tipo_vehiculo_permitido.includes(vehiculo.tipo)) throw new Error(`La zona ${zona.codigo} no admite '${vehiculo.tipo}'.`);

    // PASO A: descontar cupo de forma atómica ($gt:0 evita condiciones de carrera)
    const resultadoZona = sesionDb.zonas.updateOne(
      { _id: zonaId, cupos_disponibles: { $gt: 0 } },
      { $inc: { cupos_disponibles: -1 } },
    );
    if (resultadoZona.modifiedCount === 0) throw new Error(`No hay cupos disponibles en la zona ${zona.codigo}.`);

    // PASO B: insertar el parqueo activo
    const nuevoParqueo = {
      _id: new ObjectId(),
      vehiculo_id: vehiculo._id,
      cliente_id: vehiculo.cliente_id,
      sede_id: zona.sede_id,
      zona_id: zona._id,
      tipo_vehiculo: vehiculo.tipo,
      hora_entrada: horaEntrada,
      hora_salida: null,
      tiempo_total_minutos: null,
      costo_total: null,
      estado: "activo"
    };
    sesionDb.parqueos.insertOne(nuevoParqueo);

    session.commitTransaction(); // confirma ambos cambios de forma atómica
    parqueoCreado = nuevoParqueo;
    print(`✔ Commit: parqueo ${nuevoParqueo._id} creado, cupo de '${zona.codigo}' descontado.`);
  } catch (error) {
    print(`✘ Error: ${error.message} -> abortTransaction() (rollback)`);
    session.abortTransaction();
  } finally {
    session.endSession();
  }
  return parqueoCreado;
}

// ============================================================
// Registrar SALIDA: cierra el parqueo (calcula tiempo/costo) + libera cupo
// ============================================================
function registrarSalidaConTransaccion(parqueoId, horaSalida) {
  const session = db.getMongo().startSession();
  const sesionDb = session.getDatabase(dbName);

  try {
    session.startTransaction({ readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });

    const parqueo = sesionDb.parqueos.findOne({ _id: parqueoId });
    if (!parqueo) throw new Error(`El parqueo ${parqueoId} no existe.`);
    if (parqueo.estado !== "activo") throw new Error(`El parqueo ${parqueoId} ya fue finalizado.`);

    const zona = sesionDb.zonas.findOne({ _id: parqueo.zona_id });
    if (!zona) throw new Error(`La zona ${parqueo.zona_id} no existe.`);

    const minutos = Math.max(Math.round((horaSalida - parqueo.hora_entrada) / 60000), 1);
    const costo = Math.round((minutos / 60) * zona.tarifa_hora * 100) / 100;

    // PASO A: cerrar el parqueo
    sesionDb.parqueos.updateOne(
      { _id: parqueoId },
      { $set: { hora_salida: horaSalida, tiempo_total_minutos: minutos, costo_total: costo, estado: "finalizado" } },
    );

    // PASO B: liberar el cupo (nunca supera capacidad_maxima)
    sesionDb.zonas.updateOne(
      { _id: zona._id, cupos_disponibles: { $lt: zona.capacidad_maxima } },
      { $inc: { cupos_disponibles: 1 } },
    );

    session.commitTransaction();
    print(`✔ Commit: parqueo ${parqueoId} finalizado (${minutos} min, Q${costo}).`);
  } catch (error) {
    print(`✘ Error: ${error.message} -> abortTransaction() (rollback)`);
    session.abortTransaction();
  } finally {
    session.endSession();
  }
}
