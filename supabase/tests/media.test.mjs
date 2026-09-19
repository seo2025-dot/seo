/**
 * Pruebas del pipeline de imágenes y del almacenamiento local (sin base de datos).
 *   npx tsx supabase/tests/media.test.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { almacenamientoLocal, leerLocal, rutaSegura } from "@/lib/media/almacenamiento";
import { validarArchivoCliente } from "@/lib/media/config";
import { detectarFormato, ErrorImagen, procesarImagen } from "@/lib/media/procesar";

let ok = 0;
let fallos = 0;
const test = async (nombre, fn) => {
  try {
    await fn();
    ok++;
    console.log("  ✓", nombre);
  } catch (e) {
    fallos++;
    console.log("  ✗", nombre, "\n     ", String(e.message).split("\n")[0]);
  }
};
const rechaza = async (buffer, codigo) => {
  try {
    await procesarImagen(buffer);
  } catch (e) {
    assert.ok(e instanceof ErrorImagen, `error inesperado: ${e}`);
    assert.equal(e.codigo, codigo);
    return;
  }
  throw new Error(`se esperaba el error ${codigo}`);
};

const lienzo = (ancho, alto, canales = 3) =>
  sharp({ create: { width: ancho, height: alto, channels: canales, background: canales === 4 ? { r: 200, g: 60, b: 90, alpha: 0.5 } : { r: 200, g: 60, b: 90 } } });

console.log("Procesado de imágenes");
await test("JPG/PNG/WebP válidos se aceptan y salen como WebP con el tamaño correcto", async () => {
  for (const [nombre, buf] of [
    ["jpeg", await lienzo(2000, 3000).jpeg().toBuffer()],
    ["png", await lienzo(1200, 900, 4).png().toBuffer()],
    ["webp", await lienzo(800, 1000).webp().toBuffer()],
  ]) {
    const r = await procesarImagen(buf);
    const m1 = await sharp(r.completa).metadata();
    const m2 = await sharp(r.miniatura).metadata();
    assert.equal(m1.format, "webp", nombre);
    assert.equal(m2.format, "webp", nombre);
    assert.equal(r.mime, "image/webp");
    assert.ok(m1.width <= 1600 && m1.height <= 2000, `${nombre}: ${m1.width}x${m1.height}`);
    assert.deepEqual([m2.width, m2.height], [320, 400], nombre);
    assert.equal(r.ancho, m1.width);
    assert.equal(r.bytes, r.completa.length);
    assert.ok(r.miniatura.length < r.completa.length, "la miniatura debe pesar menos");
  }
});
await test("no amplía imágenes pequeñas y respeta la proporción al reducir", async () => {
  const p = await procesarImagen(await lienzo(500, 700).jpeg().toBuffer());
  assert.deepEqual([p.ancho, p.alto], [500, 700]);
  const g = await procesarImagen(await lienzo(3200, 4000).jpeg().toBuffer());
  assert.deepEqual([g.ancho, g.alto], [1600, 2000]);
});
await test("PRIVACIDAD: elimina los metadatos EXIF (autor, cámara, GPS)", async () => {
  const conExif = await lienzo(800, 800)
    .withExif({ IFD0: { Copyright: "SECRETO-COPYRIGHT", Artist: "Nombre Real" } })
    .jpeg()
    .toBuffer();
  assert.ok((await sharp(conExif).metadata()).exif, "la imagen de prueba debería tener EXIF");
  assert.ok(conExif.includes(Buffer.from("SECRETO-COPYRIGHT")), "el texto secreto debería estar en el original");
  const r = await procesarImagen(conExif);
  assert.equal((await sharp(r.completa).metadata()).exif, undefined);
  assert.equal((await sharp(r.miniatura).metadata()).exif, undefined);
  assert.equal(r.completa.includes(Buffer.from("SECRETO-COPYRIGHT")), false);
  assert.equal(r.completa.includes(Buffer.from("Nombre Real")), false);
});
await test("corrige la orientación EXIF (foto de móvil girada) antes de descartarla", async () => {
  const girada = await lienzo(600, 400).withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const r = await procesarImagen(girada);
  assert.deepEqual([r.ancho, r.alto], [400, 600]);
});

console.log("\nRechazos");
await test("archivo vacío", () => rechaza(Buffer.alloc(0), "vacio"));
await test("más de 5 MB", () => rechaza(Buffer.alloc(5 * 1024 * 1024 + 1, 0xff), "demasiado_grande"));
await test("GIF, SVG, PDF, HTML y texto plano (aunque se llamen .jpg)", async () => {
  await rechaza(Buffer.from("GIF89a\x01\x00\x01\x00", "latin1"), "formato_no_permitido");
  await rechaza(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), "formato_no_permitido");
  await rechaza(Buffer.from("%PDF-1.7 ..."), "formato_no_permitido");
  await rechaza(Buffer.from("<html><script>alert(1)</script></html>"), "formato_no_permitido");
  await rechaza(Buffer.from("esto no es una imagen"), "formato_no_permitido");
  await rechaza(await lienzo(400, 400).gif().toBuffer(), "formato_no_permitido");
});
await test("cabecera JPEG válida pero contenido corrupto o truncado", async () => {
  const buena = await lienzo(1200, 1200).jpeg().toBuffer();
  await rechaza(buena.subarray(0, Math.floor(buena.length / 3)), "corrupta");
  await rechaza(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]), "corrupta");
});
await test("PNG con cabecera correcta y datos basura", () =>
  rechaza(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(300, 1)]), "corrupta"));
await test("demasiado pequeña (lado corto < 300 px)", async () => {
  await rechaza(await lienzo(100, 100).jpeg().toBuffer(), "muy_pequena");
  await rechaza(await lienzo(299, 2000).jpeg().toBuffer(), "muy_pequena");
  await procesarImagen(await lienzo(300, 300).jpeg().toBuffer()); // el límite exacto es válido
});
await test("bomba de descompresión: PNG de 64 megapíxeles que pesa muy poco", async () => {
  const bomba = await lienzo(8000, 8000).png({ compressionLevel: 9 }).toBuffer();
  assert.ok(bomba.length < 5 * 1024 * 1024, `la bomba pesa ${bomba.length} bytes: debe caber bajo el límite de 5 MB`);
  await rechaza(bomba, "muy_grande_en_pixeles");
});
await test("detectarFormato usa el contenido, no la extensión", async () => {
  assert.equal(detectarFormato(await lienzo(10, 10).jpeg().toBuffer()), "jpeg");
  assert.equal(detectarFormato(await lienzo(10, 10).png().toBuffer()), "png");
  assert.equal(detectarFormato(await lienzo(10, 10).webp().toBuffer()), "webp");
  assert.equal(detectarFormato(Buffer.from("RIFFxxxxWAVE")), null);
});
await test("validación previa del navegador", () => {
  assert.equal(validarArchivoCliente({ type: "image/jpeg", size: 1000, name: "a.jpg" }), null);
  assert.match(validarArchivoCliente({ type: "image/gif", size: 1000, name: "a.gif" }), /Formato/);
  assert.match(validarArchivoCliente({ type: "image/png", size: 6 * 1024 * 1024, name: "a.png" }), /5 MB/);
  assert.match(validarArchivoCliente({ type: "image/png", size: 0, name: "a.png" }), /vacío/);
});
await test("rendimiento: procesar una foto de 12 megapíxeles tarda menos de 2 s", async () => {
  const foto = await lienzo(4000, 3000).jpeg({ quality: 90 }).toBuffer();
  const t0 = Date.now();
  await procesarImagen(foto);
  const ms = Date.now() - t0;
  console.log(`      (${ms} ms)`);
  assert.ok(ms < 2000, `${ms} ms`);
});

console.log("\nAlmacenamiento local");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "media-test-"));
await test("guardar, leer y borrar", async () => {
  const a = almacenamientoLocal(dir);
  await a.guardar("uid-1/fotos/a.webp", Buffer.from("hola"), "image/webp");
  assert.equal((await leerLocal(dir, "uid-1/fotos/a.webp")).toString(), "hola");
  await a.borrar(["uid-1/fotos/a.webp", "uid-1/fotos/no-existe.webp"]);
  assert.equal(await leerLocal(dir, "uid-1/fotos/a.webp"), null);
});
await test("SEGURIDAD: rechaza rutas con path traversal, absolutas o con caracteres extraños", async () => {
  const a = almacenamientoLocal(dir);
  for (const mala of ["../fuera.txt", "a/../../fuera.txt", "/etc/passwd", "C:/Windows/x", "a\\..\\..\\b", "a//b", "a/./b", "", ".oculto", "a b.webp", "a%2e%2e/b"]) {
    await assert.rejects(a.guardar(mala, Buffer.from("x"), "image/webp"), /no válida|fuera del directorio/, `debería rechazar «${mala}»`);
    assert.throws(() => rutaSegura(mala));
  }
  assert.equal(await leerLocal(dir, "../fuera.txt").catch(() => "error"), "error");
  assert.equal(fs.existsSync(path.join(dir, "..", "fuera.txt")), false);
});

fs.rmSync(dir, { recursive: true, force: true });
console.log(`\n${ok} pruebas OK, ${fallos} con fallo`);
process.exit(fallos ? 1 : 0);
