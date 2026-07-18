// test_dataset.js - Puebla la base con datos de prueba (usar DESPUÉS de db_config.js)

const dbName = "campus_parking";
db = db.getSiblingDB(dbName);

["sedes", "zonas", "usuarios", "vehiculos", "parqueos"].forEach((c) => db.getCollection(c).deleteMany({}));

// ===== SEDES (3) =====
const sedeGuatemala = new ObjectId();
const sedeQuetzaltenango = new ObjectId();
const sedeAntigua = new ObjectId();

const sedes = [
  { _id: sedeGuatemala, nombre: "Campus Parking Zona Viva", ciudad: "Ciudad de Guatemala", direccion: "12 Calle 1-25, Zona 10", telefono: "22334455", capacidad_total: 220, tipos_vehiculo_permitidos: ["carro", "moto", "bicicleta", "camion"], estado: "activa" },
  { _id: sedeQuetzaltenango, nombre: "Campus Parking Xela Centro", ciudad: "Quetzaltenango", direccion: "4a Calle 12-30, Zona 1", telefono: "77123456", capacidad_total: 150, tipos_vehiculo_permitidos: ["carro", "moto", "bicicleta"], estado: "activa" },
  { _id: sedeAntigua, nombre: "Campus Parking Antigua Colonial", ciudad: "Antigua Guatemala", direccion: "5a Avenida Norte 10", telefono: "78123456", capacidad_total: 120, tipos_vehiculo_permitidos: ["carro", "moto", "bicicleta"], estado: "activa" }
];
db.sedes.insertMany(sedes);

// ===== ZONAS (5 por sede = 15) =====
function generarZonas(sedeId, prefijo, config) {
  return config.map((z) => ({
    _id: new ObjectId(),
    sede_id: sedeId,
    codigo: z.codigo,
    nombre: `${prefijo} - Zona ${z.codigo}`,
    tipo_vehiculo_permitido: z.tipos,
    capacidad_maxima: z.capacidad,
    cupos_disponibles: z.capacidad, // se ajusta al final según parqueos activos
    tarifa_hora: z.tarifa,
    estado: "activa"
  }));
}

const zonasGuatemala = generarZonas(sedeGuatemala, "Zona Viva", [
  { codigo: "A", tipos: ["carro"], capacidad: 60, tarifa: 12.5 },
  { codigo: "B", tipos: ["carro"], capacidad: 50, tarifa: 12.5 },
  { codigo: "C", tipos: ["moto"], capacidad: 40, tarifa: 6.0 },
  { codigo: "D", tipos: ["bicicleta"], capacidad: 30, tarifa: 3.0 },
  { codigo: "E", tipos: ["camion"], capacidad: 15, tarifa: 20.0 }
]);
const zonasQuetzaltenango = generarZonas(sedeQuetzaltenango, "Xela Centro", [
  { codigo: "A", tipos: ["carro"], capacidad: 45, tarifa: 10.0 },
  { codigo: "B", tipos: ["carro"], capacidad: 35, tarifa: 10.0 },
  { codigo: "C", tipos: ["moto"], capacidad: 30, tarifa: 5.0 },
  { codigo: "D", tipos: ["bicicleta"], capacidad: 25, tarifa: 2.5 },
  { codigo: "E", tipos: ["carro", "moto"], capacidad: 15, tarifa: 8.0 }
]);
const zonasAntigua = generarZonas(sedeAntigua, "Antigua Colonial", [
  { codigo: "A", tipos: ["carro"], capacidad: 35, tarifa: 15.0 },
  { codigo: "B", tipos: ["carro"], capacidad: 25, tarifa: 15.0 },
  { codigo: "C", tipos: ["moto"], capacidad: 25, tarifa: 7.0 },
  { codigo: "D", tipos: ["bicicleta"], capacidad: 20, tarifa: 3.5 },
  { codigo: "E", tipos: ["carro", "moto"], capacidad: 15, tarifa: 10.0 }
]);

const zonas = [...zonasGuatemala, ...zonasQuetzaltenango, ...zonasAntigua];
db.zonas.insertMany(zonas);

// ===== USUARIOS: 2 administradores + 10 empleados + 15 clientes =====
const administradores = [
  { _id: new ObjectId(), nombre: "Mariana López", cedula: "1000000001", email: "mariana.lopez@campusparking.com", telefono: "50211110001", rol: "administrador", password_hash: "$2b$12$hashAdmin1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", fecha_registro: new Date("2023-01-10T08:00:00Z"), estado: "activo" },
  { _id: new ObjectId(), nombre: "Carlos Estrada", cedula: "1000000002", email: "carlos.estrada@campusparking.com", telefono: "50211110002", rol: "administrador", password_hash: "$2b$12$hashAdmin2XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", fecha_registro: new Date("2023-01-10T08:05:00Z"), estado: "activo" }
];

// Quita tildes/acentos para poder construir correos válidos (a-z sin ñ/tildes)
function quitarAcentos(texto) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const nombresEmpleados = ["Ana Ramírez", "Luis Morales", "Sofía Cabrera", "José Ramos", "Diana Pineda", "Ricardo Valdez", "Paola Girón", "Manuel Chávez", "Karla Solís", "Fernando Aguilar"];
const sedesArr = [sedeGuatemala, sedeQuetzaltenango, sedeAntigua];
const empleados = nombresEmpleados.map((nombre, i) => ({
  _id: new ObjectId(),
  nombre: nombre,
  cedula: `2000000${String(i + 1).padStart(3, "0")}`,
  email: `${quitarAcentos(nombre.toLowerCase()).split(" ")[0]}.${quitarAcentos(nombre.toLowerCase()).split(" ")[1]}@campusparking.com`,
  telefono: `5022222${String(1000 + i)}`,
  rol: "empleado",
  sede_id: sedesArr[i % 3], // distribuidos 4/3/3 entre las 3 sedes
  password_hash: `$2b$12$hashEmpleado${i + 1}XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`,
  fecha_registro: new Date(2023, 1, 15 + i),
  estado: "activo"
}));

const nombresClientes = ["Andrea Castillo", "Bryan Osorio", "Claudia Reyes", "David Ixchop", "Elena Say", "Francisco Tzoc", "Gabriela Marroquín", "Hugo Fuentes", "Irene Batz", "Jorge Cifuentes", "Katherine Roldán", "Marco Sic", "Nancy Argueta", "Oscar Chacón", "Paula Xitumul"];
const clientes = nombresClientes.map((nombre, i) => ({
  _id: new ObjectId(),
  nombre: nombre,
  cedula: `3000000${String(i + 1).padStart(3, "0")}`,
  email: `${quitarAcentos(nombre.toLowerCase()).split(" ")[0]}.${quitarAcentos(nombre.toLowerCase()).split(" ")[1]}@gmail.com`,
  telefono: `5033333${String(1000 + i)}`,
  rol: "cliente",
  password_hash: `$2b$12$hashCliente${i + 1}XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`,
  fecha_registro: new Date(2023, 2, 1 + i),
  estado: "activo"
}));

db.usuarios.insertMany([...administradores, ...empleados, ...clientes]);

// ===== VEHICULOS (30): 14 carros, 8 motos, 5 bicicletas, 3 camiones =====
const marcasPorTipo = {
  carro: ["Toyota", "Hyundai", "Kia", "Mazda", "Chevrolet"],
  moto: ["Yamaha", "Honda", "Suzuki", "Bajaj"],
  bicicleta: ["Trek", "Giant", "Specialized"],
  camion: ["Isuzu", "Hino", "Freightliner"]
};
const coloresDisponibles = ["Blanco", "Negro", "Gris", "Rojo", "Azul", "Plata"];
const tiposDistribuidos = [...Array(14).fill("carro"), ...Array(8).fill("moto"), ...Array(5).fill("bicicleta"), ...Array(3).fill("camion")];

const vehiculos = tiposDistribuidos.map((tipo, i) => {
  const cliente = clientes[i % clientes.length];
  const marca = marcasPorTipo[tipo][i % marcasPorTipo[tipo].length];
  return {
    _id: new ObjectId(),
    placa: `${tipo === "bicicleta" ? "BIC" : "P"}${String(100 + i)}${tipo.charAt(0).toUpperCase()}`,
    tipo: tipo,
    marca: marca,
    modelo: 2016 + (i % 9),
    color: coloresDisponibles[i % coloresDisponibles.length],
    cliente_id: cliente._id,
    fecha_registro: new Date(2023, 3, 1 + (i % 28))
  };
});
db.vehiculos.insertMany(vehiculos);

// ===== PARQUEOS (50): 10 activos (sin salida) + 40 finalizados =====
function zonasCompatibles(sedeId, tipo) {
  return zonas.filter((z) => String(z.sede_id) === String(sedeId) && z.tipo_vehiculo_permitido.includes(tipo));
}

const ahora = new Date();
const parqueos = [];
const TOTAL_PARQUEOS = 50;
const CANTIDAD_ACTIVOS = 10;

for (let i = 0; i < TOTAL_PARQUEOS; i++) {
  const vehiculo = vehiculos[i % vehiculos.length];
  const sedeId = sedesArr[i % sedesArr.length];
  let zonasPosibles = zonasCompatibles(sedeId, vehiculo.tipo);
  let sedeFinal = sedeId;

  if (zonasPosibles.length === 0) {
    for (const s of sedesArr) {
      const alt = zonasCompatibles(s, vehiculo.tipo);
      if (alt.length > 0) { sedeFinal = s; zonasPosibles = alt; break; }
    }
  }
  const zona = zonasPosibles[i % zonasPosibles.length];

  const diasAtras = i % 45; // distribuye en los últimos 45 días
  const horaEntrada = new Date(ahora.getTime() - diasAtras * 24 * 60 * 60 * 1000 - (i % 12) * 60 * 60 * 1000);
  const esActivo = i < CANTIDAD_ACTIVOS;

  let horaSalida = null, tiempoTotalMinutos = null, costoTotal = null;
  if (!esActivo) {
    const duracionMinutos = 30 + (i % 10) * 45;
    horaSalida = new Date(horaEntrada.getTime() + duracionMinutos * 60 * 1000);
    tiempoTotalMinutos = duracionMinutos;
    costoTotal = Math.round((duracionMinutos / 60) * zona.tarifa_hora * 100) / 100;
  }

  parqueos.push({
    _id: new ObjectId(),
    vehiculo_id: vehiculo._id,
    cliente_id: vehiculo.cliente_id,
    sede_id: sedeFinal,
    zona_id: zona._id,
    tipo_vehiculo: vehiculo.tipo,
    hora_entrada: horaEntrada,
    hora_salida: horaSalida,
    tiempo_total_minutos: tiempoTotalMinutos,
    costo_total: costoTotal,
    estado: esActivo ? "activo" : "finalizado"
  });
}
db.parqueos.insertMany(parqueos);

// Ajusta cupos_disponibles de cada zona según los parqueos que quedaron activos
const conteoActivosPorZona = {};
parqueos.filter((p) => p.estado === "activo").forEach((p) => {
  const key = String(p.zona_id);
  conteoActivosPorZona[key] = (conteoActivosPorZona[key] || 0) + 1;
});
Object.keys(conteoActivosPorZona).forEach((zonaIdStr) => {
  const zona = zonas.find((z) => String(z._id) === zonaIdStr);
  const ocupados = conteoActivosPorZona[zonaIdStr];
  db.zonas.updateOne({ _id: zona._id }, { $set: { cupos_disponibles: Math.max(zona.capacidad_maxima - ocupados, 0) } });
});

print(">>> RESUMEN:");
print(`sedes: ${db.sedes.countDocuments()} | zonas: ${db.zonas.countDocuments()} | usuarios: ${db.usuarios.countDocuments()} | vehiculos: ${db.vehiculos.countDocuments()} | parqueos: ${db.parqueos.countDocuments()} (activos: ${db.parqueos.countDocuments({ estado: "activo" })})`);
print("\n>>> test_dataset.js ejecutado con éxito.\n");