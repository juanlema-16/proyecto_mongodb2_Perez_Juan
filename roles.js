// roles.js - Roles de MongoDB (RBAC) y usuarios de ejemplo
// Ejecutar conectado a una cuenta con privilegios de userAdmin/userAdminAnyDatabase

const dbName = "campus_parking";
db = db.getSiblingDB(dbName);

function crearORecrearRol(nombreRol, definicion) {
  try { db.dropRole(nombreRol); } catch (e) {}
  db.createRole(definicion);
  print(`✔ Rol "${nombreRol}" creado.`);
}

// ===== ROL: administrador -> acceso total =====
crearORecrearRol("administrador", {
  role: "administrador",
  privileges: [
    { resource: { db: dbName, collection: "usuarios" }, actions: ["find", "insert", "update", "remove"] },
    { resource: { db: dbName, collection: "vehiculos" }, actions: ["find", "insert", "update", "remove"] },
    { resource: { db: dbName, collection: "sedes" }, actions: ["find", "insert", "update", "remove"] },
    { resource: { db: dbName, collection: "zonas" }, actions: ["find", "insert", "update", "remove"] },
    { resource: { db: dbName, collection: "parqueos" }, actions: ["find", "insert", "update", "remove"] }
  ],
  roles: [{ role: "dbAdmin", db: dbName }]
});

// ===== ROL: empleado_sede -> lectura de clientes/vehículos, escribe parqueos y zonas (cupos) =====
crearORecrearRol("empleado_sede", {
  role: "empleado_sede",
  privileges: [
    { resource: { db: dbName, collection: "usuarios" }, actions: ["find"] },
    { resource: { db: dbName, collection: "vehiculos" }, actions: ["find"] },
    { resource: { db: dbName, collection: "sedes" }, actions: ["find"] },
    { resource: { db: dbName, collection: "zonas" }, actions: ["find", "update"] },
    { resource: { db: dbName, collection: "parqueos" }, actions: ["find", "insert", "update"] }
  ],
  roles: []
});

// ===== ROL: cliente_app -> solo lectura (su info se filtra en la app por cliente_id) =====
crearORecrearRol("cliente_app", {
  role: "cliente_app",
  privileges: [
    { resource: { db: dbName, collection: "sedes" }, actions: ["find"] },
    { resource: { db: dbName, collection: "zonas" }, actions: ["find"] },
    { resource: { db: dbName, collection: "parqueos" }, actions: ["find"] },
    { resource: { db: dbName, collection: "vehiculos" }, actions: ["find"] }
  ],
  roles: []
});




