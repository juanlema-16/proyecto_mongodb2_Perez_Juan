// aggregations.js - Consultas analíticas (ejecutar después de db_config.js y test_dataset.js)

const dbName = "campus_parking";
db = db.getSiblingDB(dbName);

// ============================================================
// CONSULTA 1: Parqueos registrados por sede en el último mes
// ============================================================
const haceUnMes = new Date();
haceUnMes.setDate(haceUnMes.getDate() - 30);

const parqueosUltimoMes = db.parqueos.aggregate([
  { $match: { hora_entrada: { $gte: haceUnMes } } },
  { $group: { _id: "$sede_id", total_parqueos: { $sum: 1 } } },
  { $lookup: { from: "sedes", localField: "_id", foreignField: "_id", as: "sede" } },
  { $unwind: "$sede" },
  { $project: { _id: 0, sede: "$sede.nombre", ciudad: "$sede.ciudad", total_parqueos: 1 } },
  { $sort: { total_parqueos: -1 } }
]).toArray();
print("\n1) Parqueos por sede (último mes):");
printjson(parqueosUltimoMes);

// ============================================================
// CONSULTA 2: Zona más ocupada de cada sede
// ============================================================
const zonasMasOcupadas = db.parqueos.aggregate([
  { $group: { _id: { sede_id: "$sede_id", zona_id: "$zona_id" }, total_parqueos: { $sum: 1 } } },
  { $sort: { total_parqueos: -1 } },
  { $group: { _id: "$_id.sede_id", zona_top_id: { $first: "$_id.zona_id" }, total_parqueos: { $first: "$total_parqueos" } } },
  { $lookup: { from: "sedes", localField: "_id", foreignField: "_id", as: "sede" } },
  { $lookup: { from: "zonas", localField: "zona_top_id", foreignField: "_id", as: "zona" } },
  { $unwind: "$sede" },
  { $unwind: "$zona" },
  { $project: { _id: 0, sede: "$sede.nombre", zona_mas_ocupada: "$zona.codigo", total_parqueos: 1 } },
  { $sort: { sede: 1 } }
]).toArray();
print("\n2) Zona más ocupada por sede:");
printjson(zonasMasOcupadas);

// ============================================================
// CONSULTA 3: Ingreso total generado por sede
// ============================================================
const ingresoPorSede = db.parqueos.aggregate([
  { $match: { estado: "finalizado", costo_total: { $ne: null } } },
  { $group: { _id: "$sede_id", ingreso_total: { $sum: "$costo_total" }, cantidad_parqueos_facturados: { $sum: 1 } } },
  { $lookup: { from: "sedes", localField: "_id", foreignField: "_id", as: "sede" } },
  { $unwind: "$sede" },
  { $project: { _id: 0, sede: "$sede.nombre", ingreso_total: { $round: ["$ingreso_total", 2] }, cantidad_parqueos_facturados: 1 } },
  { $sort: { ingreso_total: -1 } }
]).toArray();
print("\n3) Ingreso total por sede:");
printjson(ingresoPorSede);

// ============================================================
// CONSULTA 4: Cliente que más ha usado el parqueadero
// ============================================================
const clienteFrecuente = db.parqueos.aggregate([
  { $group: { _id: "$cliente_id", veces_usado: { $sum: 1 } } },
  { $sort: { veces_usado: -1 } },
  { $limit: 1 },
  { $lookup: { from: "usuarios", localField: "_id", foreignField: "_id", as: "cliente" } },
  { $unwind: "$cliente" },
  { $project: { _id: 0, cliente: "$cliente.nombre", cedula: "$cliente.cedula", veces_usado: 1 } }
]).toArray();
print("\n4) Cliente más frecuente:");
printjson(clienteFrecuente);

// ============================================================
// CONSULTA 5: Tipo de vehículo más frecuente por sede
// ============================================================
const tipoMasFrecuente = db.parqueos.aggregate([
  { $group: { _id: { sede_id: "$sede_id", tipo_vehiculo: "$tipo_vehiculo" }, total: { $sum: 1 } } },
  { $sort: { total: -1 } },
  { $group: { _id: "$_id.sede_id", tipo_mas_frecuente: { $first: "$_id.tipo_vehiculo" }, total: { $first: "$total" } } },
  { $lookup: { from: "sedes", localField: "_id", foreignField: "_id", as: "sede" } },
  { $unwind: "$sede" },
  { $project: { _id: 0, sede: "$sede.nombre", tipo_vehiculo_mas_frecuente: "$tipo_mas_frecuente", total_registros: "$total" } },
  { $sort: { sede: 1 } }
]).toArray();
print("\n5) Tipo de vehículo más frecuente por sede:");
printjson(tipoMasFrecuente);

// ============================================================
// CONSULTA 6: Historial de parqueos de un cliente específico
// ============================================================
const cedulaEjemplo = "3000000001"; // cambia esta cédula para consultar otro cliente
const clienteBuscado = db.usuarios.findOne({ cedula: cedulaEjemplo, rol: "cliente" });

const historialCliente = db.parqueos.aggregate([
  { $match: { cliente_id: clienteBuscado._id } },
  { $lookup: { from: "sedes", localField: "sede_id", foreignField: "_id", as: "sede" } },
  { $lookup: { from: "zonas", localField: "zona_id", foreignField: "_id", as: "zona" } },
  { $unwind: "$sede" },
  { $unwind: "$zona" },
  { $sort: { hora_entrada: -1 } },
  { $project: { _id: 0, fecha_entrada: "$hora_entrada", fecha_salida: "$hora_salida", sede: "$sede.nombre", zona: "$zona.codigo", tipo_vehiculo: 1, tiempo_total_minutos: 1, costo_total: 1, estado: 1 } }
]).toArray();
print(`\n6) Historial de parqueos de: ${clienteBuscado.nombre}:`);
printjson(historialCliente);

// ============================================================
// CONSULTA 7: Vehículos parqueados actualmente en cada sede
// ============================================================
const vehiculosActualesPorSede = db.parqueos.aggregate([
  { $match: { estado: "activo" } },
  { $lookup: { from: "vehiculos", localField: "vehiculo_id", foreignField: "_id", as: "vehiculo" } },
  { $lookup: { from: "sedes", localField: "sede_id", foreignField: "_id", as: "sede" } },
  { $unwind: "$vehiculo" },
  { $unwind: "$sede" },
  { $group: { _id: "$sede.nombre", vehiculos_actuales: { $push: { placa: "$vehiculo.placa", tipo: "$vehiculo.tipo", hora_entrada: "$hora_entrada" } }, total_activos: { $sum: 1 } } },
  { $sort: { _id: 1 } }
]).toArray();
print("\n7) Vehículos parqueados actualmente por sede:");
printjson(vehiculosActualesPorSede);

// ============================================================
// CONSULTA 8: Zonas que han excedido su capacidad en algún día
// (aproximación: ingresos por zona+día vs. capacidad_maxima)
// ============================================================
const zonasExcedidas = db.parqueos.aggregate([
  { $group: { _id: { zona_id: "$zona_id", dia: { $dateTrunc: { date: "$hora_entrada", unit: "day" } } }, ingresos_del_dia: { $sum: 1 } } },
  { $lookup: { from: "zonas", localField: "_id.zona_id", foreignField: "_id", as: "zona" } },
  { $unwind: "$zona" },
  { $match: { $expr: { $gt: ["$ingresos_del_dia", "$zona.capacidad_maxima"] } } },
  { $lookup: { from: "sedes", localField: "zona.sede_id", foreignField: "_id", as: "sede" } },
  { $unwind: "$sede" },
  { $project: { _id: 0, sede: "$sede.nombre", zona: "$zona.codigo", dia: "$_id.dia", ingresos_del_dia: 1, capacidad_maxima: "$zona.capacidad_maxima" } },
  { $sort: { ingresos_del_dia: -1 } }
]).toArray();
print("\n8) Zonas que excedieron su capacidad en algún día:");
printjson(zonasExcedidas.length ? zonasExcedidas : "Ninguna zona excedió su capacidad con el dataset actual.");

print("\n>>> aggregations.js ejecutado con éxito.\n");

