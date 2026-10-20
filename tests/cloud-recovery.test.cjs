const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = resolve(__dirname, '..');
const source = path => readFileSync(resolve(root, path), 'utf8');

test('audio waits for a trusted active gesture and handles resume failures', async () => {
  let created = 0;
  let resumed = 0;
  let rejectResume = false;
  const listeners = new Map();
  class AudioContext {
    constructor() { created++; this.state = 'suspended'; }
    async resume() {
      resumed++;
      if (rejectResume) throw new Error('Audio blocked');
      this.state = 'running';
    }
  }
  const context = vm.createContext({
    window: { AudioContext },
    navigator: { userActivation: { isActive: false } },
    document: { addEventListener: (name, listener) => listeners.set(name, listener) },
  });
  vm.runInContext(source('assets/js/features/notifications.js'), context);
  vm.runInContext('avsBeep()', context);
  assert.equal(created, 0);
  await listeners.get('pointerdown')({ isTrusted: true });
  assert.equal(created, 0);
  context.navigator.userActivation.isActive = true;
  await listeners.get('pointerdown')({ isTrusted: false });
  assert.equal(created, 0);
  await listeners.get('keydown')({ isTrusted: true });
  assert.equal(created, 1);
  assert.equal(resumed, 1);
  assert.equal(vm.runInContext('avsAudio().state', context), 'running');
  vm.runInContext("avsCtx.state='suspended'", context);
  vm.runInContext('avsBeep()', context);
  assert.equal(resumed, 1);
  rejectResume = true;
  await listeners.get('pointerdown')({ isTrusted: true });
  assert.equal(vm.runInContext('avsAudio()', context), null);
  rejectResume = false;
  await listeners.get('pointerup')({ isTrusted: true });
  assert.equal(vm.runInContext('avsAudio().state', context), 'running');
});

test('a failed clinic load keeps the app locked and retries reads without another login', async () => {
  const elements = new Map();
  const calls = [];
  const control = () => ({ value: '', checked: false, disabled: false, focus() {}, addEventListener() {} });
  const lock = {
    innerHTML: '',
    querySelector(selector) {
      if (selector === 'input') return this.innerHTML.includes('id="cloudEmail"') ? elements.get('cloudEmail') : null;
      if (!elements.has(selector)) elements.set(selector, control());
      return elements.get(selector);
    },
  };
  elements.set('app', { innerHTML: '', style: {} });
  elements.set('lock', lock);
  elements.set('cloudEmail', { ...control(), value: 'synthetic@example.invalid' });
  elements.set('cloudPassword', { value: 'synthetic' });
  elements.set('cloudKeep', { checked: true });
  let failLoad = true;
  const database = { p: [{ id: 1 }] };
  const member = { id: 'user', active: true, admin: false };
  const context = vm.createContext({
    OralCloud: {
      enabled: true, config: {}, keep: true,
      restoreSession: async () => null,
      login: async () => { calls.push('login'); },
      request: async () => [{ clinic_id: 'clinic', user_id: 'user', nome: 'Synthetic' }],
    },
    OralCloudData: {
      members: async () => [member], prepareDefaults() {},
      load: async () => {
        calls.push('load');
        if (failLoad) throw Object.assign(new Error('canceling statement due to statement timeout'), { code: '57014' });
        return database;
      },
    },
    $: name => elements.get(name), toast() {}, pmCardHtml() {}, bkHtml() {},
    clearTimeout() {}, idleT: null, topCl: () => ({ marca: 'Synthetic', sub: '' }),
    esc: text => text, location: { hash: '' }, window: { addEventListener() {} },
    A: {}, AUTH: { users: [] }, lastSaved: null, LOCKED: true, db: { initial: true }, migrate: value => value,
    unlock() { context.LOCKED = false; calls.push('unlock'); },
    document: {
      createElement: () => ({ setAttribute() {}, replaceChildren() {}, appendChild() {} }),
      body: { appendChild() {} },
    },
  });
  vm.runInContext(source('assets/js/supabase/integration.js'), context);
  await context.authBoot();
  const beforeLoad = context.db;
  await elements.get('form').onsubmit({ preventDefault() {} });
  assert.equal(context.LOCKED, true);
  assert.equal(context.db, beforeLoad);
  assert.match(lock.innerHTML, /Seu acesso foi autenticado/);
  assert.match(lock.innerHTML, /Tentar carregar novamente/);
  assert.equal(calls.filter(call => call === 'load').length, 1);
  failLoad = false;
  await elements.get('form').onsubmit({ preventDefault() {} });
  assert.equal(calls.filter(call => call === 'login').length, 1);
  assert.equal(calls.filter(call => call === 'load').length, 2);
  assert.equal(context.LOCKED, false);
  assert.equal(context.db, database);
});

test('the adapter preserves attachments during no-op saves and patient edits', async () => {
  const changes = [];
  const payload = {
    revision: '42',
    tables: {
      patients: [
        { id: 'patients', parent_id: null, slot: 'p', position: -1, kind: 'array', dados: null },
        { id: '[null,"p",["id",1]]', parent_id: null, slot: 'p', position: 0, kind: 'object', dados: { id: 1, nome: 'Synthetic' } },
      ],
      patient_files: [
        { id: 'files', parent_id: '[null,"p",["id",1]]', slot: 'arquivos', position: -1, kind: 'array', dados: null },
        { id: 'file', parent_id: '[null,"p",["id",1]]', slot: 'arquivos', position: 0, kind: 'object', dados: { id: 2, data: 'data:application/pdf;base64,AAAA' } },
      ],
    },
    access: {
      patients: { read: true, admin: true, write: { p: true } },
      patient_files: { read: true, admin: true, write: { arquivos: true } },
    },
  };
  const context = vm.createContext({ window: {
    OralCloud: {
      enabled: true, clinicId: 'clinic',
      request: async (path, options) => {
        assert.equal(path.endsWith('/clinic_load'), false);
        if (path.endsWith('clinic_load_start')) return { protocol: 2, revision: '42', access: payload.access };
        if (path.endsWith('clinic_load_page')) return { revision: '42', rows: payload.tables[options.body.p_table] || [], next: null };
        changes.push(options.body);
        return { revision: '43' };
      },
    },
  } });
  vm.runInContext(source('assets/js/supabase/data.js'), context);
  const adapter = context.window.OralCloudData;
  const database = await adapter.load();
  await adapter.save(database);
  assert.equal(changes[0].p_changes.length, 0);
  database.p[0].nome = 'Updated';
  await adapter.save(database);
  assert.equal(changes[1].p_changes.length, 1);
  assert.equal(changes[1].p_changes[0].table, 'patients');
  assert.equal(database.p[0].arquivos, undefined);
});

test('failed or inconsistent pages invalidate the writable baseline without monolithic fallback', async () => {
  let broken = false;
  let inconsistent = false;
  const calls = [];
  const context = vm.createContext({ window: { OralCloud: {
    enabled: true, clinicId: 'clinic',
    request: async (path, options) => {
      const name = path.split('/').pop();
      calls.push(name);
      assert.notEqual(name, 'clinic_load');
      if (name === 'clinic_load_start') return { protocol: 2, revision: '7', access: { patients: { read: true } } };
      if (name === 'clinic_load_page') {
        if (broken && options.body.p_table === 'patients') throw Object.assign(new Error('Timeout'), { code: '57014' });
        return { revision: inconsistent ? '8' : '7', rows: [], next: null };
      }
      return { revision: '7' };
    },
  } } });
  vm.runInContext(source('assets/js/supabase/data.js'), context);
  const adapter = context.window.OralCloudData;
  await adapter.load();
  broken = true;
  await assert.rejects(adapter.load(), error => error.code === '57014');
  await assert.rejects(adapter.save({ p: [] }), error => error.code === 'LOAD_REQUIRED');
  broken = false; inconsistent = true;
  await assert.rejects(adapter.load(), error => error.code === 'INVALID_RESPONSE');
  assert.equal(calls.includes('clinic_apply'), false);
});

test('bounded protocol preserves data, authorization, file operations and export', {
  skip: !process.env.PGLITE_MODULE && 'Set PGLITE_MODULE to an isolated @electric-sql/pglite installation',
}, async () => {
  const { PGlite } = await import(process.env.PGLITE_MODULE);
  const database = new PGlite();
  try {
    await database.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key, email text);
      create function auth.uid() returns uuid language sql stable as
        'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
    `);
    await database.exec(source('supabase/migrations/202610140001_relational_clinics.sql'));
    await database.exec(`
      create function private.original_clinic_load(p_clinic uuid) returns jsonb
        language plpgsql security definer set search_path=pg_catalog as
        ${await database.query("select quote_literal(prosrc) as body from pg_proc where oid='public.clinic_load(uuid)'::regprocedure").then(result => result.rows[0].body)};
      insert into auth.users values ('00000000-0000-0000-0000-000000000001','synthetic@example.invalid');
      insert into public.clinics(id,nome,revision) values
        ('00000000-0000-0000-0000-000000000010','Synthetic clinic',42),
        ('00000000-0000-0000-0000-000000000020','Other clinic',7);
      insert into public.clinic_members(clinic_id,user_id,admin) values
        ('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001',true);
      select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
      insert into public.patients(clinic_id,id,slot,position,kind,dados) values
        ('00000000-0000-0000-0000-000000000010','patient','p',0,'object','{"id":1,"nome":"Synthetic","secret":"hidden"}');
      insert into public.patient_files(clinic_id,id,parent_id,slot,position,kind,dados)
        select '00000000-0000-0000-0000-000000000010','file-'||number,'patient','arquivos',number,'object',
          jsonb_build_object('id',number,'data','data:application/pdf;base64,'||repeat('A',4096))
        from generate_series(0,99) number;
      insert into public.patient_files(clinic_id,id,parent_id,slot,position,kind,dados) values
        ('00000000-0000-0000-0000-000000000010','signature','patient','sign',-1,'value','"data:image/png;base64,AAAA"'),
        ('00000000-0000-0000-0000-000000000010','evolution-signature','patient','evolSign',-1,'value','"data:image/png;base64,BBBB"');
      insert into public.clinic_settings(clinic_id,id,slot,position,kind,dados)
        select '00000000-0000-0000-0000-000000000010',slot_name,slot_name,0,'value','{"custom":true}'
        from unnest(array['cl','hc','meta','avs','unknown-setting']) slot_name;
    `);
    const before = await database.query("select proacl::text as grants from pg_proc where oid='public.clinic_load(uuid)'::regprocedure");
    await database.exec(source('supabase/migrations/202610200001_optimize_clinic_load.sql'));
    const after = await database.query("select proacl::text as grants, prosecdef as definer, proconfig as config from pg_proc where oid='public.clinic_load(uuid)'::regprocedure");
    assert.equal(after.rows[0].grants, before.rows[0].grants);
    assert.equal(after.rows[0].definer, true);
    assert.deepEqual(after.rows[0].config, ['search_path=pg_catalog']);
    const compare = async () => {
      const result = await database.query(`select
        public.clinic_load('00000000-0000-0000-0000-000000000010') =
        private.original_clinic_load('00000000-0000-0000-0000-000000000010') as equal`);
      assert.equal(result.rows[0].equal, true);
    };
    await compare();
    const permissions = [null, {}, { ag: 'view' }, { pac: 'view', 'pac.dados': 'none', 'pac.anam': 'view', 'pac.odo': 'none' },
      { pac: 'edit', 'pac.arquivos': 'edit', pf: 'view', vd: 'view', hc: 'view', bk: 'view' }];
    for (const perms of permissions) {
      await database.query('update public.clinic_members set admin=false,perms=$1::jsonb', [perms === null ? null : JSON.stringify(perms)]);
      await compare();
    }
    await database.exec(source('supabase/diagnostics/clinic_load.sql'));
    await database.exec(source('supabase/migrations/202610200001_optimize_clinic_load.sql'));
    await compare();
    await database.exec(source('supabase/migrations/202610200002_bounded_clinic_reads.sql'));
    const clinic = '00000000-0000-0000-0000-000000000010';
    const start = (await database.query('select public.clinic_load_start($1) as payload', [clinic])).rows[0].payload;
    assert.equal(start.protocol, 2);
    assert.equal(start.revision, '42');
    assert.equal(start.tables, undefined);
    const page = (await database.query("select public.clinic_load_page($1,42,'patients',null) as payload", [clinic])).rows[0].payload;
    assert.equal(page.rows[0].id, 'patient');
    await assert.rejects(database.query("select public.clinic_load_page($1,42,'patient_files',null)", [clinic]), error => error.code === '22023');
    await assert.rejects(database.query("select public.clinic_load_page($1,41,'patients',null)", [clinic]), error => error.code === '40001');
    const grants = await database.query("select has_function_privilege('anon','public.clinic_load_start(uuid)','execute') as anonymous, has_function_privilege('authenticated','public.clinic_load_start(uuid)','execute') as member");
    assert.equal(grants.rows[0].anonymous, false);
    assert.equal(grants.rows[0].member, true);
    await database.exec('update public.clinic_members set admin=true');
    const parent = JSON.stringify([null, 'p', ['id', 1]]);
    await database.exec('begin');
    await database.query('update public.patient_files set parent_id=$1', [parent]);
    await database.query("update public.patients set id=$1 where id='patient'", [parent]);
    const storedFiles = (await database.query('select id,slot,position,dados from public.patient_files')).rows;
    for (const row of storedFiles) {
      const id = row.slot === 'arquivos' ? JSON.stringify([parent, row.slot, ['id', row.dados.id]]) : JSON.stringify([parent, row.slot]);
      await database.query('update public.patient_files set id=$1 where id=$2', [id, row.id]);
    }
    await database.exec('commit');
    await database.query("insert into public.patients(clinic_id,id,slot,position,kind,dados) values($1,$2,'p',-1,'array','null')", [clinic, JSON.stringify([null, 'p'])]);
    await database.query("insert into public.patient_files(clinic_id,id,parent_id,slot,position,kind,dados) values($1,$2,$3,'arquivos',-1,'array','null')", [clinic, JSON.stringify([parent, 'arquivos']), parent]);
    await database.query("insert into public.clinic_settings(clinic_id,id,slot,position,kind,dados) values($1,$2,'large-imported-setting',0,'value',$3::jsonb)",
      [clinic, JSON.stringify([null, 'large-imported-setting']), JSON.stringify({ data: 'Z'.repeat(600000) })]);
    const network = [];
    const context = vm.createContext({ window: { OralCloud: {
      enabled: true, clinicId: clinic,
      request: async (path, options) => {
        const name = path.split('/').pop();
        assert.notEqual(name, 'clinic_load');
        network.push({ name, body: options.body });
        const fields = Object.entries(options.body);
        const parameters = fields.map(([, value]) => value && typeof value === 'object' ? JSON.stringify(value) : value);
        const argumentsSql = fields.map(([key], index) => `${key} => $${index + 1}`).join(',');
        return (await database.query(`select public.${name}(${argumentsSql}) as payload`, parameters)).rows[0].payload;
      },
    } } });
    vm.runInContext(source('assets/js/supabase/data.js'), context);
    const adapter = context.window.OralCloudData;
    const clinical = await adapter.load();
    assert.equal(clinical.p.length, 1);
    assert.equal(clinical.p[0].arquivos, undefined);
    assert.equal(network.some(call => call.name === 'clinic_files_page'), false);
    assert.equal(network.filter(call => call.name === 'clinic_row_chunk').every(call => call.body.p_table !== 'patient_files'), true);
    assert.equal(clinical['large-imported-setting'].data.length, 600000);
    await adapter.save(clinical);
    const descriptors = await adapter.files(1);
    assert.equal(descriptors.length, 103);
    assert.equal(descriptors.filter(row => row.slot === 'arquivos' && row.position >= 0).every(row => !('data' in row.dados)), true);
    const fileDescriptor = descriptors.find(row => row.slot === 'arquivos' && row.position >= 0);
    const actualFile = await adapter.file(1, fileDescriptor.id);
    assert.match(actualFile.dados.data, /^data:application\/pdf;base64,/);
    clinical.p[0].sign = 'data:image/png;base64,READ_ONLY_CACHE';
    clinical.p[0].arquivos = [{ id: 0, data: actualFile.dados.data }];
    await adapter.save(clinical);
    assert.equal(network.findLast(call => call.name === 'clinic_apply').body.p_changes.length, 0);
    delete clinical.p[0].arquivos;
    await adapter.changeFile(1, 'append', { file: { id: 1234, nome: 'New.pdf', tipo: 'application/pdf', data: 'data:application/pdf;base64,CCCC' } });
    await adapter.changeFile(1, 'signature', { slot: 'sign', values: { sign: 'data:image/png;base64,DDDD', signDate: '2026-10-20', signTermo: 'Verified term' } });
    const exported = await adapter.exportData(clinical);
    assert.equal(exported.p[0].arquivos.length, 101);
    assert.equal(exported.p[0].sign, 'data:image/png;base64,DDDD');
    assert.equal(exported.p[0].signTermo, 'Verified term');
    assert.equal(clinical.p[0].arquivos, undefined);
    const newDescriptor = (await adapter.files(1)).find(row => row.dados?.id === 1234);
    await adapter.changeFile(1, 'delete', { row_id: newDescriptor.id });
    assert.equal((await adapter.exportData(clinical)).p[0].arquivos.length, 100);
    const backup = await adapter.exportData(clinical);
    await adapter.restoreData(backup);
    const reloaded = await adapter.load();
    assert.equal((await adapter.exportData(reloaded)).p[0].arquivos.length, 100);
    assert.equal((await adapter.exportData(reloaded)).p[0].signTermo, 'Verified term');
    const allGrants = await database.query("select proname,has_function_privilege('anon',oid,'execute') as anonymous from pg_proc where proname in ('clinic_load_start','clinic_load_page','clinic_files_page','clinic_row_chunk','clinic_file_apply')");
    assert.equal(allGrants.rows.every(row => !row.anonymous), true);
    await database.exec('update public.clinics set revision=revision+1');
    await assert.rejects(adapter.files(1), error => error.code === '40001');
    await assert.rejects(database.query("select public.clinic_load_page($1,42,'unknown_table',null)", [clinic]), error => ['40001', '22023'].includes(error.code));
    const shell = await database.query(`select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false)`);
    assert.equal(shell.rows.length, 1);
    await database.query('update public.clinic_members set admin=false,perms=$1::jsonb', [JSON.stringify({ ag: 'view' })]);
    const currentRevision = (await database.query('select revision::text from public.clinics where id=$1', [clinic])).rows[0].revision;
    await assert.rejects(database.query("select public.clinic_row_chunk($1,$2,'patient_files',$3,0)", [clinic,currentRevision,fileDescriptor.id]), error => error.code === '42501');
    await assert.rejects(database.query("select public.clinic_load_page($1,$2,'unknown_table',null)", [clinic,currentRevision]), error => error.code === '22023');
    const restricted = (await database.query("select public.clinic_load('00000000-0000-0000-0000-000000000010') as payload")).rows[0].payload;
    assert.deepEqual(restricted.tables.patients.find(row => row.kind === 'object').dados, { id: 1, nome: 'Synthetic' });
    assert.deepEqual(restricted.tables.patient_files, []);
    await assert.rejects(database.query("select public.clinic_load('00000000-0000-0000-0000-000000000020')"), error => error.code === '42501');
    await database.exec('update public.clinic_members set active=false');
    await assert.rejects(database.query("select public.clinic_load('00000000-0000-0000-0000-000000000010')"), error => error.code === '42501');
    await database.exec("select set_config('request.jwt.claim.sub','',false)");
    await assert.rejects(database.query("select public.clinic_load('00000000-0000-0000-0000-000000000010')"), error => error.code === '42501');
  } finally {
    await database.close();
  }
});