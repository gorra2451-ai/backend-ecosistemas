// Solo Docker local del proyecto. Metadatos simulados; limpieza en finally.
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
const contenedor = 'supabase_db_backend_ecosistemas'
function sql(texto) {
  return new Promise((resolve, reject) => {
    const p = spawn('docker', ['exec', '-i', contenedor, 'psql', '-U', 'postgres', '-X', '-qAt',
      '-v', 'ON_ERROR_STOP=1'], { windowsHide: true })
    let salida = '', error = ''
    p.stdout.on('data', x => { salida += x })
    p.stderr.on('data', x => { error += x })
    p.on('error', reject)
    p.on('close', code => code === 0 ? resolve(salida.trim()) : reject(new Error(error)))
    p.stdin.end("set lock_timeout='8s'; set statement_timeout='15s';\n" + texto)
  })
}
const usuario = randomUUID(), a = randomUUID(), b = randomUUID(), archivoReporte = randomUUID()
const suscripcion = randomUUID()
try {
  await sql(`insert into auth.users(id,aud,role) values ('${usuario}','authenticated','authenticated');
    insert into public.suscripciones_push(id,perfil_id,endpoint,p256dh,auth,celda)
    values ('${suscripcion}','${usuario}','https://push.example.test/${suscripcion}',
      repeat('A',87),repeat('B',22),public.celda_mapa(public.punto(20.93,-103.69)));
    insert into public.reportes(id,perfil_id,tipo,pasan_carros,ubicacion,estado) values
      ('${a}','${usuario}','calle',true,public.punto(20.93,-103.69),'activo'),
      ('${b}','${usuario}','calle',true,public.punto(20.93001,-103.69001),'activo'),
      ('${archivoReporte}','${usuario}','calle',true,public.punto(20.98,-103.69),'pendiente');
    delete from public.avisos_push where suscripcion_id='${suscripcion}';`)
  await Promise.all([a, b].map(id => sql(`begin;
    update public.reportes set estado='resuelto' where id='${id}';
    select pg_sleep(0.6); commit;`)))
  const avisos = await sql(`select count(*) from public.avisos_push
    where suscripcion_id='${suscripcion}' and tipo='zona_resuelta';`)
  if (avisos !== '1') throw new Error(`Se esperó una resolución concurrente; llegaron ${avisos}.`)
  const subidas = await Promise.allSettled(Array.from({ length: 4 }, () => sql(`begin;
    set local role authenticated;
    select set_config('request.jwt.claims','{"sub":"${usuario}","role":"authenticated"}',true);
    insert into storage.objects(bucket_id,name,owner_id,metadata)
    values ('evidencias','${archivoReporte}/${randomUUID()}.png','${usuario}',
      '{"mimetype":"image/png","size":1000}');
    select pg_sleep(0.4); commit;`)))
  const total = await sql(`select count(*) from storage.objects
    where bucket_id='evidencias' and name like '${archivoReporte}/%';`)
  if (total !== '3' || subidas.filter(r => r.status === 'fulfilled').length !== 3) {
    throw new Error(`El límite concurrente debía permitir tres archivos; hubo ${total}.`)
  }
  for (const r of subidas) if (r.status === 'rejected' && !/row-level security/.test(r.reason.message)) throw r.reason
} finally {
  // Solo metadatos sintéticos sin archivo binario, en este contenedor local.
  await sql(`begin; set local storage.allow_delete_query='true';
    delete from storage.objects where bucket_id='evidencias' and name like '${archivoReporte}/%';
    delete from public.reportes where id in ('${a}','${b}','${archivoReporte}');
    delete from auth.users where id='${usuario}'; commit;`)
}
console.log('OK: dos resoluciones simultáneas crean un aviso; cuatro subidas respetan máximo tres; datos sintéticos eliminados.')
