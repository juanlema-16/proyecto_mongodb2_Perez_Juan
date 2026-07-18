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