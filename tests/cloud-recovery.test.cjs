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
        if (path.endsWith('clinic_load')) return payload;
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
  assert.equal(database.p[0].arquivos[0].data, 'data:application/pdf;base64,AAAA');
});

test('clinic_load preserves the original result and authorization', {
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
    const shell = await database.query(`select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false)`);
    assert.equal(shell.rows.length, 1);
    await database.query('update public.clinic_members set perms=$1::jsonb', [JSON.stringify({ ag: 'view' })]);
    const restricted = (await database.query("select public.clinic_load('00000000-0000-0000-0000-000000000010') as payload")).rows[0].payload;
    assert.deepEqual(restricted.tables.patients[0].dados, { id: 1, nome: 'Synthetic' });
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