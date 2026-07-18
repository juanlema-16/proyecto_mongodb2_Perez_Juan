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

// ===== VEHICULOS =====
crearColeccion("vehiculos", {
  $jsonSchema: {
    bsonType: "object",
    required: ["placa", "tipo", "cliente_id", "fecha_registro"],
    properties: {
      _id: { bsonType: "objectId" },
      placa: { bsonType: "string", minLength: 4, maxLength: 10 },
      tipo: { enum: ["carro", "moto", "bicicleta", "camion"] },
      marca: { bsonType: "string", maxLength: 50 },
      modelo: { bsonType: ["string", "int"] },
      color: { bsonType: "string", maxLength: 30 },
      cliente_id: { bsonType: "objectId" },
      fecha_registro: { bsonType: "date" }
    }
  }
});

// ===== SEDES =====
crearColeccion("sedes", {
  $jsonSchema: {
    bsonType: "object",
    required: ["nombre", "ciudad", "direccion", "capacidad_total", "tipos_vehiculo_permitidos", "estado"],
    properties: {
      _id: { bsonType: "objectId" },
      nombre: { bsonType: "string", minLength: 3, maxLength: 100 },
      ciudad: { bsonType: "string", minLength: 2, maxLength: 60 },
      direccion: { bsonType: "string", maxLength: 150 },
      telefono: { bsonType: "string", pattern: "^[0-9]{7,15}$" },
      capacidad_total: { bsonType: "int", minimum: 1 },
      tipos_vehiculo_permitidos: {
        bsonType: "array",
        minItems: 1,
        items: { enum: ["carro", "moto", "bicicleta", "camion"] }
      },
      estado: { enum: ["activa", "inactiva"] }
    }
  }
});

// ===== ZONAS (pertenecen a una sede) =====
crearColeccion("zonas", {
  $jsonSchema: {
    bsonType: "object",
    required: ["sede_id", "codigo", "tipo_vehiculo_permitido", "capacidad_maxima", "cupos_disponibles", "tarifa_hora", "estado"],
    properties: {
      _id: { bsonType: "objectId" },
      sede_id: { bsonType: "objectId" },
      codigo: { bsonType: "string", maxLength: 10 },
      nombre: { bsonType: "string", maxLength: 60 },
      tipo_vehiculo_permitido: {
        bsonType: "array",
        minItems: 1,
        items: { enum: ["carro", "moto", "bicicleta", "camion"] }
      },
      capacidad_maxima: { bsonType: "int", minimum: 1 },
      cupos_disponibles: { bsonType: "int", minimum: 0 },
      tarifa_hora: { bsonType: ["double", "int"], minimum: 0 },
      estado: { enum: ["activa", "inactiva"] }
    }
  }
});

// ===== PARQUEOS (ingresos/salidas de vehículos) =====
crearColeccion("parqueos", {
  $jsonSchema: {
    bsonType: "object",
    required: ["vehiculo_id", "cliente_id", "sede_id", "zona_id", "tipo_vehiculo", "hora_entrada", "estado"],
    properties: {
      _id: { bsonType: "objectId" },
      vehiculo_id: { bsonType: "objectId" },
      cliente_id: { bsonType: "objectId" },
      sede_id: { bsonType: "objectId" },
      zona_id: { bsonType: "objectId" },
      tipo_vehiculo: { enum: ["carro", "moto", "bicicleta", "camion"] },
      hora_entrada: { bsonType: "date" },
      hora_salida: { bsonType: ["date", "null"] },       // null mientras está activo
      tiempo_total_minutos: { bsonType: ["int", "null"], minimum: 0 },
      costo_total: { bsonType: ["double", "int", "null"], minimum: 0 },
      estado: { enum: ["activo", "finalizado"] }
    }
  }
});

// ===== ÍNDICES =====
db.usuarios.createIndex({ cedula: 1 }, { unique: true, name: "ux_usuarios_cedula" });
db.usuarios.createIndex({ email: 1 }, { unique: true, name: "ux_usuarios_email" });
db.usuarios.createIndex({ rol: 1, estado: 1 }, { name: "ix_usuarios_rol_estado" });
db.usuarios.createIndex({ sede_id: 1 }, { name: "ix_usuarios_sede" });

db.vehiculos.createIndex({ placa: 1 }, { unique: true, name: "ux_vehiculos_placa" });
db.vehiculos.createIndex({ cliente_id: 1 }, { name: "ix_vehiculos_cliente" });
db.vehiculos.createIndex({ tipo: 1 }, { name: "ix_vehiculos_tipo" });

db.sedes.createIndex({ nombre: 1 }, { unique: true, name: "ux_sedes_nombre" });
db.sedes.createIndex({ ciudad: 1 }, { name: "ix_sedes_ciudad" });

db.zonas.createIndex({ sede_id: 1, codigo: 1 }, { unique: true, name: "ux_zonas_sede_codigo" });
db.zonas.createIndex({ sede_id: 1, estado: 1 }, { name: "ix_zonas_sede_estado" });

db.parqueos.createIndex({ vehiculo_id: 1 }, { name: "ix_parqueos_vehiculo" });
db.parqueos.createIndex({ cliente_id: 1, hora_entrada: -1 }, { name: "ix_parqueos_cliente_fecha" });
db.parqueos.createIndex({ sede_id: 1, zona_id: 1, estado: 1 }, { name: "ix_parqueos_sede_zona_estado" });
db.parqueos.createIndex({ sede_id: 1, hora_entrada: -1 }, { name: "ix_parqueos_sede_fecha" });
db.parqueos.createIndex({ estado: 1 }, { name: "ix_parqueos_estado" });
db.parqueos.createIndex({ sede_id: 1, tipo_vehiculo: 1 }, { name: "ix_parqueos_sede_tipo" });

print("\n>>> db_config.js ejecutado con éxito.\n");