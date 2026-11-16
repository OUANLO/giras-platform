import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import test from 'node:test'
// Source modules have Next.js extensionless imports; load their exact contents
// without depending on Next.js, a live database, credentials or emails.
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const focalUrl = moduleUrl(await readFile(new URL('../src/lib/focal-scope.js', import.meta.url), 'utf8'))
const load = async file => import(moduleUrl((await readFile(new URL(file, import.meta.url), 'utf8')).replaceAll("'./focal-scope'", JSON.stringify(focalUrl))))
const { createFocalClient } = await load('../src/lib/focal-client.js')
const access = await load('../src/lib/access-scope.js')
const focal = { id: 'f', username: 'f@cnam.ci', type_utilisateur: 'Point focal', statut: 'Actif', structure: 'C', structures_point_focal: ['A', 'B'], peut_creer_projets: 'Oui' }
function fixture() {
  const db = {
    users: [{ ...focal }, { id: 'u', username: 'u@cnam.ci', structure: 'A', type_utilisateur: 'User', createur: focal.username }, { id: 'x', username: 'x@cnam.ci', structure: 'C' }],
    structures: ['A', 'B', 'C'].map(code_structure => ({ code_structure })),
    actions: ['A', 'B', 'C'].map((code_structure, i) => ({ id: i+1, code_action: i+1, code_structure, code_groupe: 'SHARED' })),
    indicateurs: ['A', 'B', 'C'].map((code_structure, i) => ({ id: i+1, code_indicateur: i+1, code_structure, groupes: ['SHARED'] })),
    action_occurrences: [1,2,3].map(i => ({ id: i, code_occurrence: i, code_action: i, tx_avancement: 10 })),
    indicateur_occurrences: [1,2,3].map(i => ({ id: i, code_indicateur: i, val_indicateur: 10 })),
    taches: [1,2,3].map(i => ({ id: i, code_occurrence: i })),
    groupe_actions: [{ id: 1, code_groupe: 'SHARED', gestionnaires: ['other'] }, { id: 2, code_groupe: 'EMPTY', gestionnaires: [focal.username] }],
    groupe_indicateurs: [{ id: 1, code_groupe: 'SHARED', gestionnaires: ['other'] }],
    membres_groupe: [{ id: 1, code_groupe: 'SHARED', membre: 'u@cnam.ci' }],
    risques: [1,2,3].map(i => ({ id: i, code_risque: i, code_structure: ['A','B','C'][i-1] })),
    risques_probabilites: [1,2,3].map(i => ({ id: i, code_risque: i })),
    periodes_evaluation: [{ id: 1, statut: 'Ouverte' }], logs: [{ id: 1 }], fichiers_cartographie: [{ id: 1 }]
  }
  const raw = { from(table) {
    let predicates = [], operation, payload, single = false, start = 0, end = Infinity
    const q = {
      select() { return q }, order() { return q },
      eq(k,v) { predicates.push(r => r[k] === v); return q },
      in(k,vs) { predicates.push(r => vs.map(String).includes(String(r[k]))); return q },
      range(a,b) { start=a; end=b; return q },
      maybeSingle() { single=true; return q }, single() { single=true; return q },
      update(p) { operation='update'; payload=p; return q },
      insert(p) { operation='insert'; payload=p; return q },
      delete() { operation='delete'; return q },
      then(resolve,reject) { return Promise.resolve().then(() => {
        let data = (db[table] || []).filter(r => predicates.every(p => p(r))).slice(start,end+1)
        if (operation === 'update') data.forEach(r => Object.assign(r,payload))
        if (operation === 'delete') db[table] = db[table].filter(r => !data.includes(r))
        if (operation === 'insert') { data=Array.isArray(payload)?payload:[payload]; (db[table] ||= []).push(...data) }
        return { data: structuredClone(single ? data[0] || null : data), error: null }
      }).then(resolve,reject) }
    }; return q
  } }
  return { db, raw, client: createFocalClient(raw, raw, focal) }
}
test('A/B visible, C excluded despite own home structure or responsible assignment', () => {
  assert.equal(access.canAccessAction(focal,{code_structure:'A'}),true)
  assert.equal(access.canAccessIndicator(focal,{code_structure:'B'}),true)
  assert.equal(access.canAccessRisk(focal,{code_structure:'C'}),false)
  assert.equal(access.canAccessAction(focal,{code_structure:'C',occ_responsable:focal.username}),false)
  assert.equal(access.isPrivilegedUser(focal),false)
})
for (const table of ['actions','indicateurs','action_occurrences','indicateur_occurrences','taches','risques','risques_probabilites']) {
  test(`${table}: server reads/exports restricted to both assigned structures`, async () => {
    const { client }=fixture(); const r=await client.from(table).select('*'); assert.equal(r.error,null);assert.deepEqual(r.data.map(x=>x.id),[1,2])
  })
}
test('direct out-of-scope mutation and move-in attack denied; in-scope progress saved', async () => {
  const {client,db}=fixture()
  assert.ok((await client.from('actions').update({code_structure:'A'}).eq('id',3)).error)
  assert.ok((await client.from('action_occurrences').update({tx_avancement:90}).eq('id',3)).error)
  assert.equal((await client.from('action_occurrences').update({tx_avancement:60}).eq('id',2)).error,null)
  assert.equal(db.action_occurrences[1].tx_avancement,60);assert.equal(db.action_occurrences[2].tx_avancement,10)
  assert.equal((await client.from('indicateur_occurrences').update({val_indicateur:75}).eq('id',1)).error,null)
})
test('members/managers immutable without manager role, allowed when manager',async()=>{
  const {client,db}=fixture()
  assert.ok((await client.from('groupe_actions').update({gestionnaires:[focal.username]}).eq('id',1)).error)
  assert.ok((await client.from('groupe_indicateurs').update({gestionnaires:[focal.username]}).eq('id',1)).error)
  assert.ok((await client.from('membres_groupe').delete().eq('id',1)).error)
  const other=fixture();other.db.groupe_indicateurs[0].gestionnaires=[focal.username]
  assert.equal((await other.client.from('membres_groupe').delete().eq('id',1)).error,null)
  assert.equal(db.membres_groupe.length,1)
})
test('empty scope fails closed; fresh database permissions override cookie',async()=>{
  const {raw,db}=fixture();db.users[0].structures_point_focal=[]
  assert.deepEqual((await createFocalClient(raw,raw,focal).from('actions').select('*')).data,[])
  db.users[0].statut='Inactif'
  assert.ok((await createFocalClient(raw,raw,focal).from('actions').select('*')).error)
})
test('own password can change without allowing self-promotion',async()=>{
  const {raw}=fixture(); const c=createFocalClient(raw,raw,focal,'/api/users/change-password')
  assert.equal((await c.from('users').update({password:'hash',modificateur:focal.username}).eq('id','f')).error,null)
  assert.ok((await c.from('users').update({type_utilisateur:'Super admin'}).eq('id','f')).error)
})
test('global administration mutations and privilege escalation denied',async()=>{
  const {client}=fixture()
  assert.ok((await client.from('periodes_evaluation').update({statut:'Fermée'}).eq('id',1)).error)
  assert.ok((await client.from('users').update({type_utilisateur:'Admin'}).eq('id','u')).error)
  assert.ok((await client.from('users').insert({username:'new',structure:'A',type_utilisateur:'Point focal',structures_point_focal:['C']})).error)
  assert.deepEqual((await client.from('logs').select('*')).data,[])
  assert.deepEqual((await client.from('fichiers_cartographie').select('*')).data,[])
})
test('existing roles retain the original client',()=>{
  const {raw}=fixture(); for(const type_utilisateur of ['User','Manager','Admin','Super admin','Super manager'])assert.equal(createFocalClient(raw,raw,{type_utilisateur}),raw)
})
test('more than 1000 scoped records are all returned', async()=>{
  const {client,db}=fixture()
  db.actions = Array.from({length:1205},(_,i)=>({id:i+1,code_action:i+1,code_structure:'A'}))
  assert.equal((await client.from('actions').select('*')).data.length,1205)
})
test('home dashboard can resolve the structure of an occurrence without a separate action list',()=>{
  assert.equal(access.canAccessActionOccurrence(focal,{code_action:1,code_structure:'B'}),true)
  assert.equal(access.canAccessActionOccurrence(focal,{code_action:1,code_structure:'C'}),false)
})
test('risk identification and analysis mutations denied even to focal risk managers',async()=>{
  const {client,raw,db}=fixture();db.groupe_actions[0].gestionnaires=[focal.username]
  assert.ok((await client.from('risques').update({impact:4}).eq('id',1)).error)
  assert.ok((await client.from('risques').delete().eq('id',1)).error)
  const analysis=createFocalClient(raw,raw,focal,'/api/risques/probabilite')
  assert.ok((await analysis.from('risques_probabilites').update({probabilite:4}).eq('id',1)).error)
})
test('historical cartography available only through download route, without write permissions',async()=>{
  const {raw,db}=fixture();db.users[0].acces_risque='Oui'
  const download=createFocalClient(raw,raw,focal,'/api/cartographie/fichier')
  assert.equal((await download.from('fichiers_cartographie').select('*')).data.length,1)
  assert.ok((await download.from('fichiers_cartographie').delete().eq('id',1)).error)
  assert.deepEqual((await createFocalClient(raw,raw,focal,'/api/archive').from('fichiers_cartographie').select('*')).data,[])
})
test('cartography storage signs downloads but never uploads or removes files',async()=>{
  const {raw,db}=fixture();db.users[0].acces_risque='Oui'
  let signed=0
  raw.storage={from:()=>({createSignedUrl:async()=>{signed++;return {data:{signedUrl:'https://example.invalid/signed'},error:null}},list:async()=>({data:[],error:null})})}
  const download=createFocalClient(raw,raw,focal,'/api/cartographie/fichier')
  assert.equal((await download.storage.from('cartographies').createSignedUrl('periodes/2025/file.pdf',600)).error,null)
  assert.ok((await download.storage.from('cartographies').remove(['file.pdf'])).error)
  const upload=createFocalClient(raw,raw,focal,'/api/cartographie/upload-url')
  assert.ok((await upload.storage.from('cartographies').createSignedUploadUrl('file.pdf')).error)
  assert.equal(signed,1)
})
