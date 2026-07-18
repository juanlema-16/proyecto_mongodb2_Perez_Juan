// db_config.js - Crea las 5 colecciones con validación $jsonSchema e índices

const dbName = "campus_parking";
db = db.getSiblingDB(dbName);

function crearColeccion(nombre, validator) {
  if (db.getCollectionNames().includes(nombre)) {
    db.getCollection(nombre).drop();
  }
  db.createCollection(nombre, {
    validator: validator,
    validationLevel: "strict",
    validationAction: "error"
  });
  print(`✔ Colección "${nombre}" creada.`);
}

// ===== USUARIOS (administrador | empleado | cliente) =====
crearColeccion("usuarios", {
  $jsonSchema: {
    bsonType: "object",
    required: ["nombre", "cedula", "email", "rol", "estado", "fecha_registro"],
    properties: {
      _id: { bsonType: "objectId" },
      nombre: { bsonType: "string", minLength: 3, maxLength: 100 },
      cedula: { bsonType: "string", pattern: "^[0-9]{6,15}$" },
      email: { bsonType: "string", pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$" },
      telefono: { bsonType: "string", pattern: "^[0-9]{7,15}$" },
      rol: { enum: ["administrador", "empleado", "cliente"] },
      sede_id: { bsonType: "objectId" },
      password_hash: { bsonType: "string" },
      fecha_registro: { bsonType: "date" },
      estado: { enum: ["activo", "inactivo"] }
    },
    // Regla condicional: si rol = "empleado", sede_id es obligatorio
    // (MongoDB no soporta if/then en $jsonSchema, se usa anyOf en su lugar)
    anyOf: [
      { properties: { rol: { enum: ["administrador", "cliente"] } } },
      { properties: { rol: { enum: ["empleado"] } }, required: ["sede_id"] }
    ]
  }
});