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

